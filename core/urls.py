from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import CategoryViewSet, ProductViewSet, SaleTransactionViewSet, StaffViewSet, ProductListView, restock_product, sales_report, RestockHistoryViewSet,CustomerViewSet, CustomerTransactionViewSet, LoyaltySettingsViewSet, redeem_loyalty_points,store_today_sales, user_today_performance, BulkDiscountViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'sales', SaleTransactionViewSet)
router.register(r'staff', StaffViewSet)
router.register(r'restock-history', RestockHistoryViewSet, basename='restock-history')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'customer-transactions', CustomerTransactionViewSet, basename='customer-transactions')
router.register(r'loyalty-settings', LoyaltySettingsViewSet, basename='loyalty-settings')
router.register(r'bulk-discounts', BulkDiscountViewSet, basename='bulk-discounts')

urlpatterns = [
    path('', include(router.urls)),
    path('products/', ProductListView.as_view(), name='product-list'),
    path('restock/', restock_product, name='restock_product'),
    path("sales-report/", sales_report, name="sales-report"),
    path("store-today-sales/", store_today_sales, name="store-today-sales"),  # Add this
    path("user-today-performance/", user_today_performance, name="user-today-performance"),
    path("redeem-points/", redeem_loyalty_points, name="redeem-points"),
]