"""Restocking: add a delivery of one or more products, and browse what was restocked.

A restock only adds stock. It records what was paid per item so the owner can see
spending on stock, but it never changes a product's prices (that's the Products page).
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import AuditLog, Product, Restock
from .permissions import IsManagerOrAdmin, current_store

MAX_QUANTITY = 100000
MAX_UNIT_COST = Decimal('100000000')
MAX_ITEMS = 100
PAGE_SIZE = 25
SPEND = ExpressionWrapper(F('quantity_added') * F('unit_cost'), output_field=DecimalField(max_digits=20, decimal_places=2))


class RestockThrottle(UserRateThrottle):
    rate = '60/min'


def read_line(raw, number):
    """Check one delivery line; return (product_id, quantity, unit_cost) or raise ValueError."""
    where = f'Item {number}: '
    if not isinstance(raw, dict):
        raise ValueError(where + 'not understood')
    try:
        product_id = int(raw.get('product_id'))
    except (TypeError, ValueError):
        raise ValueError(where + 'choose a product')
    quantity = raw.get('quantity')
    if isinstance(quantity, bool) or not str(quantity).strip().isdigit():
        raise ValueError(where + 'quantity must be a whole number above 0')
    quantity = int(str(quantity).strip())
    if quantity < 1:
        raise ValueError(where + 'quantity must be a whole number above 0')
    if quantity > MAX_QUANTITY:
        raise ValueError(where + f'quantity can be at most {MAX_QUANTITY:,}')
    unit_cost = raw.get('unit_cost')
    if unit_cost in (None, ''):
        unit_cost = None
    else:
        try:
            unit_cost = Decimal(str(unit_cost)).quantize(Decimal('0.01'))
        except (InvalidOperation, ValueError):
            raise ValueError(where + 'cost must be a number')
        if unit_cost < 0 or unit_cost > MAX_UNIT_COST or not unit_cost.is_finite():
            raise ValueError(where + 'cost is not valid')
    return product_id, quantity, unit_cost


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([RestockThrottle])
def restock_product(request):
    """Add stock. Takes {"items": [{product_id, quantity, unit_cost?}, ...]} or a single item."""
    store = current_store(request)
    raw_items = request.data.get('items') if isinstance(request.data, dict) else None
    if raw_items is None:
        raw_items = [request.data]
    if not isinstance(raw_items, list) or not raw_items:
        return Response({'error': 'Add at least one product'}, status=400)
    if len(raw_items) > MAX_ITEMS:
        return Response({'error': f'Restock at most {MAX_ITEMS} products at a time'}, status=400)
    try:
        lines = [read_line(raw, i + 1) for i, raw in enumerate(raw_items)]
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

    # The same product twice in one delivery is added together
    merged = {}
    for product_id, quantity, unit_cost in lines:
        if product_id in merged:
            merged[product_id][0] += quantity
            merged[product_id][1] = unit_cost if unit_cost is not None else merged[product_id][1]
        else:
            merged[product_id] = [quantity, unit_cost]

    with transaction.atomic():
        # Locked so two people restocking (or a sale) at once can't overwrite each other's count
        products = {p.id: p for p in Product.objects.select_for_update().filter(store=store, id__in=merged)}
        missing = [pid for pid in merged if pid not in products]
        if missing:
            return Response({'error': 'A product was not found in this store. Refresh and try again.'}, status=404)
        results = []
        for product_id, (quantity, unit_cost) in merged.items():
            product = products[product_id]
            if product.stock + quantity > 2_147_483_647:
                transaction.set_rollback(True)
                return Response({'error': f'{product.name}: stock would be too high'}, status=400)
            product.stock = F('stock') + quantity
            product.save(update_fields=['stock'])
            product.refresh_from_db(fields=['stock'])
            restock = Restock.objects.create(
                store=store, product=product, quantity_added=quantity, restocked_by=request.user,
                unit_cost=unit_cost, stock_after=product.stock)
            AuditLog.objects.create(
                store=store, action='CREATE', model_name='Restock', object_id=str(restock.pk),
                object_repr=f'{product.name} +{quantity}', changed_by=request.user,
                changes={'product': product.name, 'quantity_added': quantity, 'new_stock': product.stock,
                         'unit_cost': str(unit_cost) if unit_cost is not None else None},
            )
            results.append({'product_id': product.id, 'name': product.name, 'quantity_added': quantity,
                            'stock': product.stock, 'restock_id': restock.id})

    total = sum(r['quantity_added'] for r in results)
    message = (f"{results[0]['name']}: +{total:,} (now {results[0]['stock']:,})" if len(results) == 1
               else f'{len(results)} products restocked, {total:,} items added')
    response = {'message': message, 'items': results}
    if len(results) == 1:
        response['stock'] = results[0]['stock']  # older app versions read this
    return Response(response)


def _money(v):
    return round(float(v or 0), 2)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([RestockThrottle])
def restock_history(request):
    """One page of restocks, newest first, with optional search and dates."""
    store = current_store(request)
    rows = Restock.objects.filter(store=store).select_related('product', 'restocked_by').order_by('-restocked_at', '-id')
    search = (request.GET.get('search') or '').strip()
    if search:
        rows = rows.filter(Q(product__name__icontains=search) | Q(product__barcode__iexact=search))
    try:
        start = parse_date(request.GET['start_date']) if request.GET.get('start_date') else None
        end = parse_date(request.GET['end_date']) if request.GET.get('end_date') else None
    except ValueError:
        return Response({'error': 'Dates must look like 2026-11-17'}, status=400)
    if start:
        rows = rows.filter(restocked_at__date__gte=start)
    if end:
        rows = rows.filter(restocked_at__date__lte=end)
    try:
        page = max(int(request.GET.get('page') or 1), 1)
    except ValueError:
        page = 1
    total = rows.count()
    results = []
    for r in rows[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]:
        cost = r.unit_cost
        results.append({
            'id': r.id, 'product_id': r.product_id, 'product_name': r.product.name,
            'unit': r.product.unit_of_measure, 'quantity_added': r.quantity_added,
            'unit_cost': _money(cost) if cost is not None else None,
            'total_cost': _money(cost * r.quantity_added) if cost is not None else None,
            'stock_after': r.stock_after,
            'restocked_by_username': r.restocked_by.username if r.restocked_by else 'Unknown',
            'restocked_at': timezone.localtime(r.restocked_at).isoformat(),
        })
    return Response({'count': total, 'page': page, 'page_size': PAGE_SIZE, 'results': results})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
@throttle_classes([RestockThrottle])
def restock_summary(request):
    """Headline numbers for the Restock page."""
    store = current_store(request)
    today = timezone.localdate()
    month_start = today.replace(day=1)
    rows = Restock.objects.filter(store=store)
    today_rows = rows.filter(restocked_at__date=today)
    month_rows = rows.filter(restocked_at__date__gte=month_start)
    products = Product.objects.filter(store=store, is_archived=False)
    from .views import low_stock_level
    LOW_STOCK_THRESHOLD = low_stock_level(store)
    return Response({
        'today_restocks': today_rows.count(),
        'today_items': today_rows.aggregate(n=Sum('quantity_added'))['n'] or 0,
        'month_spend': _money(month_rows.aggregate(t=Sum(SPEND))['t']),
        'month_restocks': month_rows.count(),
        'last_30_spend': _money(rows.filter(restocked_at__gte=timezone.now() - timedelta(days=30)).aggregate(t=Sum(SPEND))['t']),
        'out_of_stock': products.filter(stock=0).count(),
        'low_stock': products.filter(stock__gt=0, stock__lte=LOW_STOCK_THRESHOLD).count(),
        'low_stock_threshold': LOW_STOCK_THRESHOLD,
    })
