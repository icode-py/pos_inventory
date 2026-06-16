from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    CategoryViewSet, ProductViewSet, SaleTransactionViewSet, StaffViewSet,
    ProductListView, restock_product, sales_report, RestockHistoryViewSet,
    CustomerViewSet, CustomerTransactionViewSet, LoyaltySettingsViewSet,
    redeem_loyalty_points, store_today_sales, user_today_performance,
    BulkDiscountViewSet, register_staff,
    AuditedCategoryViewSet, AuditedProductViewSet, AuditLogViewSet,
    low_stock_alerts, download_product_template, bulk_upload_products,
    margin_report, get_store_settings, update_store_settings,
    update_staff, reset_staff_password, delete_staff,
)

router = DefaultRouter()
router.register(r'categories', AuditedCategoryViewSet)
router.register(r'products', AuditedProductViewSet)
router.register(r'sales', SaleTransactionViewSet)
router.register(r'staff', StaffViewSet)
router.register(r'restock-history', RestockHistoryViewSet, basename='restock-history')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'customer-transactions', CustomerTransactionViewSet, basename='customer-transactions')
router.register(r'loyalty-settings', LoyaltySettingsViewSet, basename='loyalty-settings')
router.register(r'bulk-discounts', BulkDiscountViewSet, basename='bulk-discounts')
router.register(r'audit-log', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    # Custom product sub-routes MUST come before include(router.urls)
    # otherwise the router matches products/<pk>/ and swallows them
    path('products/download-template/', download_product_template, name='product-template'),
    path('products/bulk-upload/', bulk_upload_products, name='bulk-upload'),

    path('', include(router.urls)),
    path('restock/', restock_product, name='restock_product'),
    path('sales-report/', sales_report, name='sales-report'),
    path('store-today-sales/', store_today_sales, name='store-today-sales'),
    path('user-today-performance/', user_today_performance, name='user-today-performance'),
    path('redeem-points/', redeem_loyalty_points, name='redeem-points'),
    path('register-staff/', register_staff, name='register-staff'),
    path('low-stock-alerts/', low_stock_alerts, name='low-stock-alerts'),
    path('margin-report/', margin_report, name='margin-report'),
    path('store-settings/', get_store_settings, name='store-settings'),
    path('store-settings/update/', update_store_settings, name='store-settings-update'),
    path('staff/<int:pk>/update/', update_staff, name='update-staff'),
    path('staff/<int:pk>/reset-password/', reset_staff_password, name='reset-staff-password'),
    path('staff/<int:pk>/delete/', delete_staff, name='delete-staff'),
]