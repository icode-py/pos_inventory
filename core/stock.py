"""Stock changes that aren't sales or deliveries, plus per-product insight.

An adjustment removes or corrects stock with a reason (damaged, expired, stolen, a shelf
count...), so missing goods are recorded instead of disappearing from the numbers.
"""
import uuid
from datetime import timedelta
from io import BytesIO

from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Max, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import AuditLog, Product, Restock, SaleItem, StockAdjustment
from .permissions import IsManagerOrAdmin, current_store
from .security import write_text_cell

REASONS = dict(StockAdjustment.REASONS)
# Reasons that mean the shop lost the goods (returns to a supplier are refunded/replaced)
LOSS_REASONS = ('DAMAGED', 'EXPIRED', 'STOLEN', 'COUNT', 'OTHER')
MAX_CHANGE = 1_000_000
MAX_LINES = 1000
PAGE_SIZE = 25
LOSS_VALUE = ExpressionWrapper(-F('change') * F('unit_cost'), output_field=DecimalField(max_digits=20, decimal_places=2))


class StockThrottle(UserRateThrottle):
    rate = '60/min'


def _int(value, what):
    if isinstance(value, bool):
        raise ValueError(f'{what} must be a whole number')
    text = str(value).strip()
    if text.startswith('-'):
        digits = text[1:]
        sign = -1
    else:
        digits, sign = text, 1
    if not digits.isdigit():
        raise ValueError(f'{what} must be a whole number')
    return sign * int(digits)


def read_line(raw, number):
    """Return (product_id, change or None, counted or None, reason, note) or raise ValueError."""
    where = f'Item {number}: '
    if not isinstance(raw, dict):
        raise ValueError(where + 'not understood')
    try:
        product_id = _int(raw.get('product_id'), 'product')
        has_change = raw.get('change') not in (None, '')
        has_counted = raw.get('counted') not in (None, '')
        if has_change == has_counted:
            raise ValueError('give either a change or a counted amount')
        change = _int(raw['change'], 'change') if has_change else None
        counted = _int(raw['counted'], 'counted amount') if has_counted else None
    except ValueError as e:
        raise ValueError(where + str(e))
    if change is not None and (change == 0 or abs(change) > MAX_CHANGE):
        raise ValueError(where + 'change must be a whole number other than 0')
    if counted is not None and not 0 <= counted <= MAX_CHANGE:
        raise ValueError(where + 'counted amount must be 0 or more')
    reason = str(raw.get('reason') or ('COUNT' if counted is not None else '')).upper()
    if reason not in REASONS:
        raise ValueError(where + 'choose a reason')
    note = str(raw.get('note') or '').strip()[:200]
    if reason == 'OTHER' and not note:
        raise ValueError(where + 'add a note saying why')
    return product_id, change, counted, reason, note


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([StockThrottle])
def stock_adjustments(request):
    if request.method == 'POST':
        return _adjust(request)
    return _list_adjustments(request)


def _adjust(request):
    """{"items": [{product_id, change | counted, reason, note?}], "count": bool}"""
    store = current_store(request)
    raw_items = request.data.get('items') if isinstance(request.data, dict) else None
    if not isinstance(raw_items, list) or not raw_items:
        return Response({'error': 'Add at least one product'}, status=400)
    if len(raw_items) > MAX_LINES:
        return Response({'error': f'At most {MAX_LINES} products at a time'}, status=400)
    try:
        lines = [read_line(raw, i + 1) for i, raw in enumerate(raw_items)]
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    if len({l[0] for l in lines}) != len(lines):
        return Response({'error': 'A product appears twice. Combine it into one line.'}, status=400)
    count_ref = uuid.uuid4().hex[:12] if any(l[2] is not None for l in lines) else ''

    with transaction.atomic():
        products = {p.id: p for p in Product.objects.select_for_update().filter(store=store, id__in=[l[0] for l in lines])}
        if len(products) != len(lines):
            return Response({'error': 'A product was not found in this store. Refresh and try again.'}, status=404)
        results, unchanged = [], 0
        for product_id, change, counted, reason, note in lines:
            product = products[product_id]
            before = product.stock
            if counted is not None:
                change = counted - before
                if change == 0:
                    unchanged += 1  # the shelf matches the system
                    continue
            after = before + change
            if after < 0:
                transaction.set_rollback(True)
                return Response({'error': f'{product.name}: only {before:,} in stock, cannot remove {-change:,}'}, status=400)
            product.stock = after
            product.save(update_fields=['stock'])
            adj = StockAdjustment.objects.create(
                store=store, product=product, change=change, reason=reason, note=note,
                stock_before=before, stock_after=after, unit_cost=product.cost_price,
                count_ref=count_ref, adjusted_by=request.user)
            AuditLog.objects.create(
                store=store, action='UPDATE', model_name='StockAdjustment', object_id=str(adj.pk),
                object_repr=f'{product.name} {change:+,} ({REASONS[reason]})', changed_by=request.user,
                changes={'stock': {'from': before, 'to': after}, 'reason': REASONS[reason], 'note': note},
            )
            results.append({'product_id': product.id, 'name': product.name, 'change': change,
                            'stock': after, 'value': round(float(change * product.cost_price), 2)})

    if count_ref:
        message = (f'Count saved: {len(results)} product{"s" if len(results) != 1 else ""} corrected, '
                   f'{unchanged} matched')
    elif len(results) == 1:
        r = results[0]
        message = f"{r['name']}: {r['change']:+,} (now {r['stock']:,})"
    else:
        message = f'{len(results)} products adjusted'
    return Response({'message': message, 'items': results, 'unchanged': unchanged, 'count_ref': count_ref})


def _list_adjustments(request):
    store = current_store(request)
    rows = StockAdjustment.objects.filter(store=store).select_related('product', 'adjusted_by').order_by('-created_at', '-id')
    if request.GET.get('product_id', '').isdigit():
        rows = rows.filter(product_id=int(request.GET['product_id']))
    if request.GET.get('reason', '').upper() in REASONS:
        rows = rows.filter(reason=request.GET['reason'].upper())
    try:
        page = max(int(request.GET.get('page') or 1), 1)
    except ValueError:
        page = 1
    total = rows.count()
    return Response({
        'count': total, 'page': page, 'page_size': PAGE_SIZE,
        'results': [_adjustment_row(a) for a in rows[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]],
    })


def _adjustment_row(a):
    return {
        'id': a.id, 'product_id': a.product_id, 'product_name': a.product.name, 'change': a.change,
        'reason': a.reason, 'reason_label': REASONS[a.reason], 'note': a.note,
        'stock_before': a.stock_before, 'stock_after': a.stock_after,
        'value': round(float(a.change * a.unit_cost), 2),
        'by': a.adjusted_by.username if a.adjusted_by else 'Unknown',
        'at': timezone.localtime(a.created_at).isoformat(), 'is_count': bool(a.count_ref),
    }


def stock_loss(store, start, end):
    """Value of stock lost between two local dates, by reason (used by Reports)."""
    rows = StockAdjustment.objects.filter(store=store, created_at__date__range=(start, end), change__lt=0,
                                          reason__in=LOSS_REASONS)
    by_reason = rows.values('reason').annotate(value=Sum(LOSS_VALUE), units=Sum(-F('change')), n=Count('id'))
    reasons = sorted(({'reason': r['reason'], 'label': REASONS[r['reason']], 'value': round(float(r['value'] or 0), 2),
                       'units': r['units'] or 0, 'count': r['n']} for r in by_reason), key=lambda r: -r['value'])
    # Units a count found on the shelf beyond what the system had
    found = StockAdjustment.objects.filter(store=store, created_at__date__range=(start, end), change__gt=0,
                                           reason='COUNT').aggregate(v=Sum(ExpressionWrapper(
                                               F('change') * F('unit_cost'), output_field=DecimalField(max_digits=20, decimal_places=2))))['v']
    return {'total': round(sum(r['value'] for r in reasons), 2), 'by_reason': reasons,
            'count_found_value': round(float(found or 0), 2)}


def product_insights(product):
    """Sales speed, stock outlook and recent stock movements for one product."""
    now = timezone.now()
    since = now - timedelta(days=30)
    lines = SaleItem.objects.filter(product=product)
    recent = lines.filter(transaction__created_at__gte=since).aggregate(
        units=Sum('quantity'), revenue=Sum(ExpressionWrapper(F('quantity') * F('price_at_sale'),
                                                             output_field=DecimalField(max_digits=20, decimal_places=2))))
    last_sold = lines.aggregate(at=Max('transaction__created_at'))['at']
    age_days = max((now - product.created_at).days, 0)
    window = max(min(30, age_days), 1)
    sold = recent['units'] or 0
    daily = sold / window
    restocks = Restock.objects.filter(product=product).select_related('restocked_by').order_by('-restocked_at')[:5]
    adjustments = StockAdjustment.objects.filter(product=product).select_related('adjusted_by', 'product').order_by('-created_at')[:5]
    return {
        'sold_30d': sold,
        'revenue_30d': round(float(recent['revenue'] or 0), 2),
        'daily': round(daily, 2),
        'days_left': round(product.stock / daily, 1) if daily > 0 else None,
        'last_sold': timezone.localtime(last_sold).isoformat() if last_sold else None,
        'restocks': [{
            'quantity': r.quantity_added, 'unit_cost': float(r.unit_cost) if r.unit_cost is not None else None,
            'by': r.restocked_by.username if r.restocked_by else 'Unknown',
            'at': timezone.localtime(r.restocked_at).isoformat(),
        } for r in restocks],
        'adjustments': [_adjustment_row(a) for a in adjustments],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
def count_sheet(request):
    """A printable Excel sheet for counting the shelves, grouped by category."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    store = current_store(request)
    products = Product.objects.filter(store=store, is_archived=False).select_related('category').order_by(
        'category__name', 'name')
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Stock count'
    write_text_cell(ws, 1, 1, f'{store.name} — stock count')
    ws['A1'].font = Font(bold=True, size=14)
    ws['A2'] = f'Printed {timezone.localtime().strftime("%d %b %Y %H:%M")}. Write what is on the shelf, then enter it in Products → Stock count.'
    headers = ['Category', 'Product', 'Barcode', 'Pack size', 'System stock', 'Counted', 'Difference']
    fill = PatternFill(start_color='667EEA', end_color='667EEA', fill_type='solid')
    thin = Side(style='thin', color='BBBBBB')
    for col, h in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col, value=h)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = fill
        cell.alignment = Alignment(horizontal='center')
    for i, p in enumerate(products, start=5):
        values = [p.category.name if p.category else 'Uncategorized', p.name, p.barcode,
                  p.bulk_quantity if p.is_bulk_product and p.bulk_quantity > 1 else '', p.stock, None, None]
        for col, v in enumerate(values, start=1):
            cell = write_text_cell(ws, i, col, v)   # a product named "=..." stays text
            cell.border = Border(top=thin, bottom=thin, left=thin, right=thin)
        ws.cell(row=i, column=7, value=f'=IF(F{i}="","",F{i}-E{i})')
    for col, width in zip('ABCDEFG', (20, 36, 18, 10, 13, 12, 12)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = 'A5'
    ws.print_title_rows = '4:4'
    buffer = BytesIO()
    wb.save(buffer)
    response = HttpResponse(buffer.getvalue(),
                            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="stock_count_{timezone.localdate()}.xlsx"'
    return response
