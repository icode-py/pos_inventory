"""Store analytics for the Reports page.

All the adding up happens in the database and only totals are sent, so the page stays
fast on a phone over mobile data however many sales a store has. Days and hours follow
the server's TIME_ZONE (Africa/Lagos).
"""
import csv
from datetime import timedelta

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import Coalesce, ExtractHour, TruncDate
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import SaleItem, SaleTransaction
from .permissions import IsManagerOrAdmin, current_store, plan_has_feature

MONEY = DecimalField(max_digits=18, decimal_places=2)
LINE_REVENUE = ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=MONEY)
# Sales made before cost_at_sale existed fall back to the product's current cost
LINE_COST = ExpressionWrapper(
    F('quantity') * Coalesce('cost_at_sale', 'product__cost_price'), output_field=MONEY)
MAX_DAYS = 366
PAYMENT_LABELS = dict(SaleTransaction.PAYMENT_METHODS)
PAGE_SIZE = 25


class ReportThrottle(UserRateThrottle):
    rate = '120/min'


def money(value):
    return round(float(value or 0), 2)


def pct_change(now, before):
    return round((now - before) / before * 100, 1) if before else None


class Scope:
    """The sales and sale lines a report covers, after its date, cashier and product filters."""

    def __init__(self, store, start, end, cashier_id=None, product_id=None, until=None):
        self.start, self.end = start, end
        self.product_id = product_id
        sales = SaleTransaction.objects.filter(store=store, created_at__date__range=(start, end))
        if until:
            sales = sales.filter(created_at__lte=until)
        if cashier_id:
            sales = sales.filter(cashier_id=cashier_id)
        lines = SaleItem.objects.filter(transaction__in=sales)
        if product_id:
            lines = lines.filter(product_id=product_id)
            # pk__in (not a join) so totals aren't counted once per matching line
            sales = sales.filter(pk__in=lines.values('transaction_id'))
        self.sales, self.lines = sales, lines

    def summary(self, with_profit):
        line = self.lines.aggregate(revenue=Sum(LINE_REVENUE), cost=Sum(LINE_COST), items=Sum('quantity'))
        transactions = self.sales.count()
        # The sale total is what was actually paid; with a product filter only that product's lines count
        revenue = money(line['revenue'] if self.product_id else self.sales.aggregate(t=Sum('total_amount'))['t'])
        cost = money(line['cost'])
        result = {
            'revenue': revenue,
            'transactions': transactions,
            'items': int(line['items'] or 0),
            'average_sale': round(revenue / transactions, 2) if transactions else 0,
        }
        if with_profit:
            result.update(cost=cost, profit=round(revenue - cost, 2),
                          margin_pct=round((revenue - cost) / revenue * 100, 1) if revenue else 0)
        return result

    def daily(self, with_profit):
        if self.product_id:
            revenue_by_day = {r['day']: r['v'] for r in self.lines.annotate(
                day=TruncDate('transaction__created_at')).values('day').annotate(v=Sum(LINE_REVENUE))}
        else:
            revenue_by_day = {r['day']: r['v'] for r in self.sales.annotate(
                day=TruncDate('created_at')).values('day').annotate(v=Sum('total_amount'))}
        count_by_day = {r['day']: r['n'] for r in self.sales.annotate(
            day=TruncDate('created_at')).values('day').annotate(n=Count('id'))}
        cost_by_day = {r['day']: r['c'] for r in self.lines.annotate(
            day=TruncDate('transaction__created_at')).values('day').annotate(c=Sum(LINE_COST))} if with_profit else {}

        days = []
        day = self.start
        while day <= self.end:  # every day, so quiet days show as zero instead of vanishing
            revenue = money(revenue_by_day.get(day))
            row = {'date': day.isoformat(), 'revenue': revenue, 'transactions': count_by_day.get(day, 0)}
            if with_profit:
                cost = money(cost_by_day.get(day))
                row.update(cost=cost, profit=round(revenue - cost, 2))
            days.append(row)
            day += timedelta(days=1)
        return days

    def hourly(self):
        if self.product_id:
            rows = self.lines.annotate(h=ExtractHour('transaction__created_at')).values('h').annotate(
                revenue=Sum(LINE_REVENUE), transactions=Count('transaction', distinct=True))
        else:
            rows = self.sales.annotate(h=ExtractHour('created_at')).values('h').annotate(
                revenue=Sum('total_amount'), transactions=Count('id'))
        hours = [{'hour': h, 'revenue': 0, 'transactions': 0} for h in range(24)]
        for r in rows:
            hours[r['h']].update(revenue=money(r['revenue']), transactions=r['transactions'])
        return hours

    def products(self, with_profit):
        rows = self.lines.values('product_id', 'product__name', 'product__category__name').annotate(
            revenue=Sum(LINE_REVENUE), cost=Sum(LINE_COST), units=Sum('quantity'),
            transactions=Count('transaction', distinct=True)).order_by('-revenue')
        return [self._with_profit({
            'id': r['product_id'], 'name': r['product__name'],
            'category': r['product__category__name'] or 'Uncategorized',
            'quantity': r['units'], 'revenue': money(r['revenue']), 'transactions': r['transactions'],
        }, r['cost'], with_profit) for r in rows]

    def categories(self, with_profit):
        rows = self.lines.values('product__category__name').annotate(
            revenue=Sum(LINE_REVENUE), cost=Sum(LINE_COST), units=Sum('quantity'),
            transactions=Count('transaction', distinct=True),
            products=Count('product', distinct=True)).order_by('-revenue')
        return [self._with_profit({
            'name': r['product__category__name'] or 'Uncategorized', 'revenue': money(r['revenue']),
            'quantity': r['units'], 'transactions': r['transactions'], 'products': r['products'],
        }, r['cost'], with_profit) for r in rows]

    def payments(self):
        """Money by channel: cash in the drawer, bank transfers and POS card, plus older sales with no method."""
        recorded = ~Q(payment_method='')
        t = self.sales.aggregate(
            cash=Sum('cash_amount', filter=recorded), transfer=Sum('transfer_amount', filter=recorded),
            card=Sum('card_amount', filter=recorded), unrecorded=Sum('total_amount', filter=Q(payment_method='')))
        counts = dict(self.sales.values_list('payment_method').annotate(n=Count('id')))
        return {
            'cash': money(t['cash']), 'transfer': money(t['transfer']), 'card': money(t['card']),
            'unrecorded': money(t['unrecorded']),
            'counts': {'cash': counts.get('CASH', 0), 'transfer': counts.get('TRANSFER', 0),
                       'card': counts.get('POS', 0), 'split': counts.get('SPLIT', 0),
                       'unrecorded': counts.get('', 0)},
        }

    def cashiers(self):
        items = {r['transaction__cashier_id']: r['n'] for r in
                 self.lines.values('transaction__cashier_id').annotate(n=Sum('quantity'))}
        recorded = ~Q(payment_method='')
        rows = self.sales.values('cashier_id', 'cashier__username', 'cashier__first_name').annotate(
            revenue=Sum('total_amount'), transactions=Count('id'),
            cash=Sum('cash_amount', filter=recorded), transfer=Sum('transfer_amount', filter=recorded),
            card=Sum('card_amount', filter=recorded)).order_by('-revenue')
        result = []
        for r in rows:
            revenue = money(r['revenue'])
            result.append({
                'id': r['cashier_id'],
                'name': r['cashier__first_name'] or r['cashier__username'] or 'Unknown',
                'username': r['cashier__username'],
                'revenue': revenue, 'transactions': r['transactions'],
                'items': items.get(r['cashier_id'], 0),
                'average_sale': round(revenue / r['transactions'], 2) if r['transactions'] else 0,
                'cash': money(r['cash']), 'transfer': money(r['transfer']), 'card': money(r['card']),
            })
        return result

    @staticmethod
    def _with_profit(row, cost, with_profit):
        if with_profit:
            cost = money(cost)
            row.update(cost=cost, profit=round(row['revenue'] - cost, 2),
                       margin_pct=round((row['revenue'] - cost) / row['revenue'] * 100, 1) if row['revenue'] else 0)
        return row


def read_filters(request):
    """Return (start, end, cashier_id, product_id) or raise ValueError with a reason."""
    today = timezone.localdate()
    start = request.GET.get('start_date')
    end = request.GET.get('end_date')
    def as_date(value):
        try:
            parsed = parse_date(value)
        except ValueError:
            parsed = None
        if not parsed:
            raise ValueError('Dates must look like 2026-11-17')
        return parsed

    end = as_date(end) if end else today
    start = as_date(start) if start else end - timedelta(days=6)
    if start > end:
        raise ValueError('The start date is after the end date')
    if (end - start).days >= MAX_DAYS:
        raise ValueError('Pick a range of one year or less')

    def as_id(name):
        value = request.GET.get(name)
        if value in (None, ''):
            return None
        if not str(value).isdigit():
            raise ValueError(f'{name} must be a number')
        return int(value)

    return start, end, as_id('cashier_id'), as_id('product_id')


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([ReportThrottle])
def store_analytics(request):
    try:
        start, end, cashier_id, product_id = read_filters(request)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    store = current_store(request)
    with_profit = plan_has_feature('margin_analytics', request)

    days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    now = Scope(store, start, end, cashier_id, product_id)
    # A period that ends today is only partly over, so compare it with the previous
    # period up to the same time (today so far vs yesterday up to this hour)
    same_time = end == timezone.localdate()
    until = timezone.now() - timedelta(days=days) if same_time else None
    before = Scope(store, prev_start, prev_end, cashier_id, product_id, until=until)
    summary, previous = now.summary(with_profit), before.summary(with_profit)
    changes = {k: pct_change(summary[k], previous[k])
               for k in ('revenue', 'transactions', 'average_sale', 'items', 'profit') if k in summary}

    return Response({
        'range': {'start': start.isoformat(), 'end': end.isoformat(), 'days': days,
                  'previous_start': prev_start.isoformat(), 'previous_end': prev_end.isoformat(),
                  'same_time': same_time},
        'can_view_profit': with_profit,
        'summary': summary,
        'previous': previous,
        'change_pct': changes,
        'daily': now.daily(with_profit),
        'hourly': now.hourly(),
        'products': now.products(with_profit),
        'categories': now.categories(with_profit),
        'cashiers': now.cashiers(),
        # Payments are per sale, so a product filter can't split them
        'payments': None if product_id else now.payments(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([ReportThrottle])
def analytics_sales(request):
    """One page of the sales list, newest first."""
    try:
        start, end, cashier_id, product_id = read_filters(request)
        page = max(int(request.GET.get('page') or 1), 1)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    sales = Scope(current_store(request), start, end, cashier_id, product_id).sales
    total = sales.count()
    rows = sales.order_by('-created_at').annotate(item_count=Sum('items__quantity')).values(
        'id', 'cashier__username', 'total_amount', 'paid_amount', 'change_given', 'created_at',
        'item_count', 'payment_method', 'cash_amount', 'transfer_amount', 'card_amount')[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    return Response({
        'count': total, 'page': page, 'page_size': PAGE_SIZE,
        'results': [{
            'id': r['id'], 'cashier': r['cashier__username'], 'total_amount': money(r['total_amount']),
            'paid_amount': money(r['paid_amount']), 'change_given': money(r['change_given']),
            'created_at': timezone.localtime(r['created_at']).isoformat(), 'items': r['item_count'] or 0,
            'payment_method': r['payment_method'], 'cash_amount': money(r['cash_amount']),
            'transfer_amount': money(r['transfer_amount']), 'card_amount': money(r['card_amount']),
        } for r in rows],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([ReportThrottle])
def analytics_items_csv(request):
    """Every sold line in the range as a CSV file, built on the server."""
    try:
        start, end, cashier_id, product_id = read_filters(request)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    lines = Scope(current_store(request), start, end, cashier_id, product_id).lines
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="sales_items_{start}_to_{end}.csv"'
    writer = csv.writer(response)
    writer.writerow(['sale_id', 'date', 'time', 'cashier', 'payment', 'product', 'category', 'quantity', 'unit_price', 'line_total'])
    for r in lines.order_by('transaction__created_at').values(
            'transaction_id', 'transaction__created_at', 'transaction__cashier__username',
            'transaction__payment_method', 'product__name',
            'product__category__name', 'quantity', 'price_at_sale').iterator():
        at = timezone.localtime(r['transaction__created_at'])
        writer.writerow([r['transaction_id'], at.date().isoformat(), at.strftime('%H:%M'),
                         r['transaction__cashier__username'],
                         PAYMENT_LABELS.get(r['transaction__payment_method'], 'Not recorded'), r['product__name'],
                         r['product__category__name'] or '', r['quantity'], r['price_at_sale'],
                         round(r['quantity'] * r['price_at_sale'], 2)])
    return response
