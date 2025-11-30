# views.py
from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.db.models import Sum, Count
from django.utils.dateparse import parse_date
from django.utils import timezone
from datetime import timedelta
from .permissions import IsManagerOrAdmin, IsCashier, IsCashierOrManager
from .models import Category, Product, SaleTransaction, Staff, Restock, Customer, CustomerTransaction, LoyaltySettings, BulkDiscount
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    SaleTransactionSerializer,
    StaffSerializer,
    RestockSerializer,
    CustomerSerializer,
    CustomerTransactionSerializer,
    LoyaltySettingsSerializer,
    BulkDiscountSerializer
)
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer
from django.db.models.functions import TruncDate


# Custom Throttle Classes
class BurstRateThrottle(UserRateThrottle):
    scope = 'burst'

class SustainedRateThrottle(UserRateThrottle):
    scope = 'sustained'


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    # throttle_classes = [AnonRateThrottle]


class ProductListView(APIView):
    permission_classes = [IsAuthenticated]
    # throttle_classes = [SustainedRateThrottle]

    def get(self, request):
        products = Product.objects.all().prefetch_related('bulk_discounts')
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]
    # throttle_classes = [SustainedRateThrottle]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('bulk_discounts')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    # throttle_classes = [SustainedRateThrottle]


class SaleTransactionViewSet(viewsets.ModelViewSet):
    queryset = SaleTransaction.objects.all().order_by('-created_at')
    serializer_class = SaleTransactionSerializer
    permission_classes = [IsCashierOrManager]
    # throttle_classes = [BurstRateThrottle]

    def perform_create(self, serializer):
        serializer.save(cashier=self.request.user)


class StaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [IsManagerOrAdmin]
    # throttle_classes = [SustainedRateThrottle]


class RestockHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Restock.objects.select_related('product', 'restocked_by').order_by('-restocked_at')
    serializer_class = RestockSerializer
    permission_classes = [IsAuthenticated, IsCashierOrManager]
    # throttle_classes = [SustainedRateThrottle]


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsCashierOrManager])
# @throttle_classes([BurstRateThrottle])
def restock_product(request):
    product_id = request.data.get("product_id")
    quantity = request.data.get("quantity")

    if not product_id or not quantity:
        return Response({"error": "Missing product_id or quantity"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        product = Product.objects.get(id=product_id)
        product.stock += int(quantity)
        product.save()

        # 🔹 Log the restock
        Restock.objects.create(
            product=product,
            quantity_added=int(quantity),
            restocked_by=request.user
        )

        return Response({"message": "Stock updated successfully", "stock": product.stock})
    except Product.DoesNotExist:
        return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsCashierOrManager])
# @throttle_classes([SustainedRateThrottle])
def sales_report(request):
    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")
    cashier_id = request.GET.get("cashier_id")
    product_id = request.GET.get("product_id")

    # Validate date parameters
    if start_date:
        try:
            parse_date(start_date)
        except ValueError:
            return Response({"error": "Invalid start_date format"}, status=status.HTTP_400_BAD_REQUEST)

    if end_date:
        try:
            parse_date(end_date)
        except ValueError:
            return Response({"error": "Invalid end_date format"}, status=status.HTTP_400_BAD_REQUEST)

    sales = SaleTransaction.objects.all()

    # If no cashier_id specified and user is cashier, show only their sales
    if not cashier_id and (request.user.is_cashier and not request.user.is_manager and not request.user.is_admin):
        sales = sales.filter(cashier=request.user)

    if start_date:
        sales = sales.filter(created_at__date__gte=parse_date(start_date))
    if end_date:
        sales = sales.filter(created_at__date__lte=parse_date(end_date))
    if cashier_id:
        sales = sales.filter(cashier__id=cashier_id)

    if product_id:
        sales = sales.filter(items__product__id=product_id).distinct()

    sales_data = SaleTransactionSerializer(sales, many=True).data

    # Daily Totals
    daily_summary = (
        sales.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(total_sales=Count("id"), total_amount=Sum("total_amount"))
        .order_by("day")
    )

    return Response({
        "sales": sales_data,
        "daily_summary": daily_summary
    })


def calculate_sales_stats(sales_queryset):
    """Helper function to calculate sales statistics without code duplication"""
    total_sales = sales_queryset.aggregate(total=Sum('total_amount'))['total'] or 0
    transaction_count = sales_queryset.count()
    average_sale = total_sales / transaction_count if transaction_count > 0 else 0
    
    return {
        'total_sales': float(total_sales),
        'transaction_count': transaction_count,
        'average_sale': float(average_sale)
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
# @throttle_classes([SustainedRateThrottle])
def store_today_sales(request):
    """Get TOTAL store sales for today - for dashboard card"""
    try:
        today = timezone.now().date()
        
        # Always get ALL sales for the store today
        sales_today = SaleTransaction.objects.filter(created_at__date=today)
        
        stats = calculate_sales_stats(sales_today)
        stats['scope'] = 'store_total'
        
        return Response(stats)
    except Exception as e:
        print(f"Error in store_today_sales: {str(e)}")
        return Response({
            'total_sales': 0,
            'transaction_count': 0,
            'average_sale': 0,
            'scope': 'store_total',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
# @throttle_classes([SustainedRateThrottle])
def user_today_performance(request):
    """Get INDIVIDUAL user sales for today - for layout sidebar"""
    try:
        today = timezone.now().date()
        
        # Get sales for today filtered by current user (everyone sees their own sales)
        sales_today = SaleTransaction.objects.filter(
            created_at__date=today,
            cashier=request.user
        )
        
        stats = calculate_sales_stats(sales_today)
        stats['scope'] = 'user_individual'
        
        return Response(stats)
    except Exception as e:
        print(f"Error in user_today_performance: {str(e)}")
        return Response({
            'total_sales': 0,
            'transaction_count': 0,
            'average_sale': 0,
            'scope': 'user_individual',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('-created_at')
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    # throttle_classes = [SustainedRateThrottle]
    
    def get_queryset(self):
        queryset = Customer.objects.all()
        phone = self.request.query_params.get('phone', None)
        name = self.request.query_params.get('name', None)
        
        if phone:
            queryset = queryset.filter(phone__icontains=phone)
        if name:
            queryset = queryset.filter(name__icontains=name)
            
        return queryset


class CustomerTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerTransactionSerializer
    permission_classes = [IsAuthenticated]
    # throttle_classes = [SustainedRateThrottle]
    
    def get_queryset(self):
        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            return CustomerTransaction.objects.filter(customer_id=customer_id).select_related('sale', 'customer').order_by('-created_at')
        return CustomerTransaction.objects.none()


class LoyaltySettingsViewSet(viewsets.ModelViewSet):
    queryset = LoyaltySettings.objects.all()
    serializer_class = LoyaltySettingsSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]
    # throttle_classes = [SustainedRateThrottle]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
# @throttle_classes([BurstRateThrottle])
def redeem_loyalty_points(request):
    customer_id = request.data.get('customer_id')
    points_to_redeem = request.data.get('points_to_redeem')
    
    if not customer_id or not points_to_redeem:
        return Response({"error": "Missing customer_id or points_to_redeem"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        customer = Customer.objects.get(id=customer_id)
        loyalty_settings = LoyaltySettings.objects.filter(is_active=True).first()
        
        if not loyalty_settings:
            return Response({"error": "Loyalty program is not active"}, status=status.HTTP_400_BAD_REQUEST)
        
        if customer.loyalty_points < points_to_redeem:
            return Response({"error": "Insufficient loyalty points"}, status=status.HTTP_400_BAD_REQUEST)
        
        discount_amount = (points_to_redeem * float(loyalty_settings.redemption_rate)) / 100
        
        customer.loyalty_points -= points_to_redeem
        customer.save()
        
        return Response({
            "message": "Points redeemed successfully",
            "discount_amount": discount_amount,
            "remaining_points": customer.loyalty_points
        })
        
    except Customer.DoesNotExist:
        return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)
    

class BulkDiscountViewSet(viewsets.ModelViewSet):
    queryset = BulkDiscount.objects.all()
    serializer_class = BulkDiscountSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]
    # throttle_classes = [SustainedRateThrottle]