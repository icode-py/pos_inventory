from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class Store(models.Model):
    """A tenant. Every store's data is kept apart by a `store` link on its records."""
    TIER_CHOICES = [
        ('STARTER',  'Starter'),
        ('GROWTH',   'Growth'),
        ('BUSINESS', 'Business'),
    ]

    name            = models.CharField(max_length=100, default='My Store')
    tagline         = models.CharField(max_length=200, blank=True, default='Modern Point of Sale')
    phone           = models.CharField(max_length=20,  blank=True)
    address         = models.CharField(max_length=200, blank=True)
    email           = models.EmailField(blank=True)
    receipt_footer  = models.CharField(max_length=200, blank=True, default='Thank you for your business!')
    plan_tier       = models.CharField(max_length=10, choices=TIER_CHOICES, default='STARTER')
    is_active       = models.BooleanField(default=True, help_text='Untick to suspend this store. Its staff can no longer log in.')
    created_at      = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return self.name


class Category(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'name'], name='unique_category_name_per_store'),
        ]

    def __str__(self):
        return self.name


class Product(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    price = models.DecimalField(max_digits=15, decimal_places=2)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2)
    stock = models.PositiveIntegerField()
    barcode = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    # NEW: Bulk pricing fields
    is_bulk_product = models.BooleanField(default=False)
    bulk_quantity = models.PositiveIntegerField(default=1, help_text="Number of units in a bulk pack")
    bulk_price = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True, help_text="Price for the entire bulk pack")
    unit_of_measure = models.CharField(max_length=20, default='units', help_text="e.g., pieces, kg, liters, packs")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'barcode'], name='unique_barcode_per_store'),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def unit_price(self):
        """Calculate price per unit for bulk products"""
        if self.is_bulk_product and self.bulk_quantity > 1 and self.bulk_price:
            return self.bulk_price / self.bulk_quantity
        return self.price
    
    @property
    def display_price(self):
        """Display price based on product type"""
        if self.is_bulk_product and self.bulk_quantity > 1:
            return f"₦{self.bulk_price} per {self.bulk_quantity} {self.unit_of_measure}"
        return f"₦{self.price} per {self.unit_of_measure}"


class SaleTransaction(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    cashier = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True)
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2)
    change_given = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    # Set by the till, so a sale resent after a dropped connection is only recorded once
    client_ref = models.CharField(max_length=64, null=True, blank=True, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'client_ref'], name='unique_client_ref_per_store'),
        ]

    def __str__(self):
        return f"Sale #{self.id} - {self.created_at}"


class RefusedSale(models.Model):
    """An offline sale the server turned down. The cash was already taken, so a manager decides."""
    STATUS_CHOICES = [
        ('PENDING',   'Pending'),
        ('APPROVED',  'Approved'),
        ('DISMISSED', 'Dismissed'),
    ]

    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    cashier = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True, related_name='refused_sales')
    client_ref = models.CharField(max_length=64)
    payload = models.JSONField()
    reason = models.CharField(max_length=500)
    sold_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    sale = models.ForeignKey(SaleTransaction, on_delete=models.SET_NULL, null=True, blank=True)
    reviewed_by = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_sales')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['sold_at']
        constraints = [
            models.UniqueConstraint(fields=['store', 'client_ref'], name='unique_refused_sale_per_store'),
        ]

    def __str__(self):
        return f"Refused sale {self.client_ref} ({self.status})"


class SaleItem(models.Model):
    transaction = models.ForeignKey(SaleTransaction, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, null=False)
    quantity = models.PositiveIntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

class Staff(AbstractUser):
    # Empty only for platform superusers, who manage stores through Django admin
    store = models.ForeignKey(Store, on_delete=models.CASCADE, null=True, blank=True, related_name='staff')
    is_cashier = models.BooleanField(default=False)
    is_manager = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)

    def __str__(self):
        return self.username
    
    def get_role_display(self):
        if self.is_admin:
            return "Admin"
        elif self.is_manager:
            return "Manager" 
        elif self.is_cashier:
            return "Cashier"
        else:
            return "Staff"


class Restock(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity_added = models.PositiveIntegerField()
    restocked_by = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True)
    restocked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name} +{self.quantity_added} on {self.restocked_at}"
    

class Customer(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    phone = models.CharField(max_length=15)
    name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    loyalty_points = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_visits = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'phone'], name='unique_customer_phone_per_store'),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.phone})"

class CustomerTransaction(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='transactions')
    sale = models.ForeignKey(SaleTransaction, on_delete=models.CASCADE)
    points_earned = models.IntegerField(default=0)
    points_redeemed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.customer.name} - {self.sale.id}"

class LoyaltySettings(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    points_per_amount = models.DecimalField(max_digits=8, decimal_places=2, default=1.0, 
                                          help_text="Points earned per currency amount spent")
    redemption_rate = models.DecimalField(max_digits=8, decimal_places=2, default=100.0,
                                        help_text="Amount required to redeem 1 point")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return "Loyalty Program Settings"
    

class BulkDiscount(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    DISCOUNT_TYPES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
        ('bundle', 'Bundle Deal'),
    ]
    
    name = models.CharField(max_length=100)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES)
    minimum_quantity = models.PositiveIntegerField()
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='bulk_discounts')
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.name} - {self.product.name}"
    
    def calculate_discount(self, quantity, unit_price):
        """Calculate discount amount based on type"""
        if quantity < self.minimum_quantity:
            return 0

        if self.discount_type == 'percentage':
            return (unit_price * quantity) * (self.discount_value / 100)
        elif self.discount_type == 'fixed':
            return self.discount_value
        elif self.discount_type == 'bundle':
            # Buy X get Y free logic
            bundles = quantity // self.minimum_quantity
            return bundles * self.discount_value * unit_price
        return 0


class AuditLog(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50)
    object_id = models.CharField(max_length=50)
    object_repr = models.CharField(max_length=200)
    changed_by = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    changes = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} {self.model_name} #{self.object_id} by {self.changed_by}"
