from django.contrib import admin
from .models import Category, Product, SaleTransaction, SaleItem, Staff, Restock, Customer, CustomerTransaction, LoyaltySettings, BulkDiscount, Store
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
# Register your models here.


class StoreFilteredAdmin(admin.ModelAdmin):
    """Django admin is the platform view: it sees every store, so make the store visible."""
    list_filter = ['store']

    def get_list_display(self, request):
        return ['__str__', 'store']


admin.site.register(Category, StoreFilteredAdmin)
admin.site.register(Product, StoreFilteredAdmin)
admin.site.register(SaleTransaction, StoreFilteredAdmin)
admin.site.register(SaleItem)
admin.site.register(Restock, StoreFilteredAdmin)
admin.site.register(Customer, StoreFilteredAdmin)
admin.site.register(CustomerTransaction)
admin.site.register(LoyaltySettings, StoreFilteredAdmin)

@admin.register(Staff)
class StaffAdmin(UserAdmin):
    model = Staff
    list_display = ['username', 'store', 'email', 'is_cashier', 'is_manager', 'is_admin', 'is_staff', 'is_active']
    list_filter = UserAdmin.list_filter + ('store',)
    
    # These fields will show in the user edit form
    fieldsets = UserAdmin.fieldsets + (
        (_('Custom Roles'), {'fields': ('store', 'is_cashier', 'is_manager', 'is_admin')}),
    )

    # These fields will show in the user creation form
    add_fieldsets = UserAdmin.add_fieldsets + (
        (_('Custom Roles'), {'fields': ('store', 'is_cashier', 'is_manager', 'is_admin')}),
    )


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ['name', 'plan_tier', 'is_active', 'phone', 'email', 'created_at']
    list_filter = ['plan_tier', 'is_active']
    search_fields = ['name', 'phone', 'email']
    fields = ['name', 'tagline', 'phone', 'address', 'email', 'receipt_footer', 'plan_tier', 'is_active']


@admin.register(BulkDiscount)
class BulkDiscountAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'product', 'discount_type', 'minimum_quantity', 'discount_value', 'is_active', 'start_date', 'end_date']
    list_filter = ['store', 'discount_type', 'is_active', 'start_date']
    search_fields = ['name', 'product__name']