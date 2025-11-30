from django.contrib import admin
from .models import Category, Product, SaleTransaction, SaleItem, Staff,  Restock, Customer, CustomerTransaction, LoyaltySettings, BulkDiscount
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
# Register your models here.


admin.site.register(Category)
admin.site.register(Product)
admin.site.register(SaleTransaction)
admin.site.register(SaleItem)
admin.site.register(Restock)
admin.site.register(Customer)
admin.site.register(CustomerTransaction)
admin.site.register(LoyaltySettings)

@admin.register(Staff)
class StaffAdmin(UserAdmin):
    model = Staff
    list_display = ['username', 'email', 'is_cashier', 'is_manager', 'is_admin', 'is_staff', 'is_active']
    
    # These fields will show in the user edit form
    fieldsets = UserAdmin.fieldsets + (
        (_('Custom Roles'), {'fields': ('is_cashier', 'is_manager', 'is_admin')}),
    )

    # These fields will show in the user creation form
    add_fieldsets = UserAdmin.add_fieldsets + (
        (_('Custom Roles'), {'fields': ('is_cashier', 'is_manager', 'is_admin')}),
    )


@admin.register(BulkDiscount)
class BulkDiscountAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'discount_type', 'minimum_quantity', 'discount_value', 'is_active', 'start_date', 'end_date']
    list_filter = ['discount_type', 'is_active', 'start_date']
    search_fields = ['name', 'product__name']