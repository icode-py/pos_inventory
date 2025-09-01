from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import CategoryViewSet, ProductViewSet, SaleTransactionViewSet, StaffViewSet, ProductListView, restock_product, sales_report, RestockHistoryViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'sales', SaleTransactionViewSet)
router.register(r'staff', StaffViewSet)
router.register(r'restock-history', RestockHistoryViewSet, basename='restock-history')

urlpatterns = [
    path('', include(router.urls)),
    path('products/', ProductListView.as_view(), name='product-list'),
    path('restock/', restock_product, name='restock_product'),
    path("sales-report/", sales_report, name="sales-report"),
]