from django.db import models
from django.contrib.auth.models import AbstractUser

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField()
    barcode = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # NEW: Bulk pricing fields
    is_bulk_product = models.BooleanField(default=False)
    bulk_quantity = models.PositiveIntegerField(default=1, help_text="Number of units in a bulk pack")
    bulk_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="Price for the entire bulk pack")
    unit_of_measure = models.CharField(max_length=20, default='units', help_text="e.g., pieces, kg, liters, packs")
    
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
    cashier = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True)
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2)
    change_given = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sale #{self.id} - {self.created_at}"


class SaleItem(models.Model):
    transaction = models.ForeignKey(SaleTransaction, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, null=False)
    quantity = models.PositiveIntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

class Staff(AbstractUser):
    is_cashier = models.BooleanField(default=False)
    is_manager = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)

    def __str__(self):
        return self.username


class Restock(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity_added = models.PositiveIntegerField()
    restocked_by = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True)
    restocked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name} +{self.quantity_added} on {self.restocked_at}"
    

class Customer(models.Model):
    phone = models.CharField(max_length=15, unique=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    loyalty_points = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_visits = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
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
    points_per_amount = models.DecimalField(max_digits=8, decimal_places=2, default=1.0, 
                                          help_text="Points earned per currency amount spent")
    redemption_rate = models.DecimalField(max_digits=8, decimal_places=2, default=100.0,
                                        help_text="Amount required to redeem 1 point")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return "Loyalty Program Settings"
    

class BulkDiscount(models.Model):
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