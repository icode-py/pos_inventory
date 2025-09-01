from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum, Count
from django.utils.dateparse import parse_date
from datetime import timedelta
from .permissions import IsManagerOrAdmin, IsCashier, IsCashierOrManager
from .models import Category, Product, SaleTransaction, Staff,  Restock
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    SaleTransactionSerializer,
    StaffSerializer,
    RestockSerializer
)
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer
from django.db.models.functions import TruncDate

# Create your views here.


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer



class ProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Product.objects.all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)



class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class SaleTransactionViewSet(viewsets.ModelViewSet):
    queryset = SaleTransaction.objects.all().order_by('-created_at')
    serializer_class = SaleTransactionSerializer
    permission_classes = [IsCashierOrManager]

    def perform_create(self, serializer):
        serializer.save(cashier=self.request.user)

class StaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [IsManagerOrAdmin]


class RestockHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Restock.objects.select_related('product', 'restocked_by').order_by('-restocked_at')
    serializer_class = RestockSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
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
@permission_classes([IsAuthenticated, IsManagerOrAdmin])
def sales_report(request):
    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")
    cashier_id = request.GET.get("cashier_id")
    product_id = request.GET.get("product_id")

    sales = SaleTransaction.objects.all()

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
