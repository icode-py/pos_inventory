# serializers.py
from rest_framework import serializers
from .models import Category, Product, SaleTransaction, SaleItem, Staff, Restock, Customer, CustomerTransaction, LoyaltySettings, BulkDiscount
from rest_framework.exceptions import ValidationError
from django.db import transaction
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import re


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['role'] = (
            "admin" if user.is_admin else
            "manager" if user.is_manager else
            "cashier" if user.is_cashier else
            "staff"
        )

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Log login attempts for security monitoring
        user = self.user
        print(f"SECURITY: User {user.username} logged in from {self.context['request'].META.get('REMOTE_ADDR')}")
        
        return data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Category name must be at least 2 characters long")
        
        # Prevent SQL injection patterns
        if any(char in value for char in [';', '--', '/*', '*/', 'xp_']):
            raise serializers.ValidationError("Invalid characters in category name")
        
        return value.strip()


class BulkDiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkDiscount
        fields = '__all__'

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Discount name must be at least 2 characters long")
        return value.strip()

    def validate_minimum_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Minimum quantity must be positive")
        if value > 10000:
            raise serializers.ValidationError("Minimum quantity too high")
        return value

    def validate_discount_value(self, value):
        if value <= 0:
            raise serializers.ValidationError("Discount value must be positive")
        return value

    def validate(self, data):
        discount_type = data.get('discount_type')
        discount_value = data.get('discount_value')

        if discount_type == 'percentage' and (discount_value <= 0 or discount_value > 100):
            raise serializers.ValidationError({
                'discount_value': 'Percentage discount must be between 0 and 100'
            })

        if discount_type == 'fixed' and discount_value <= 0:
            raise serializers.ValidationError({
                'discount_value': 'Fixed discount must be greater than 0'
            })

        if discount_type == 'bundle' and discount_value <= 0:
            raise serializers.ValidationError({
                'discount_value': 'Bundle quantity must be greater than 0'
            })

        return data


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )
    unit_price = serializers.ReadOnlyField()
    display_price = serializers.ReadOnlyField()
    bulk_discounts = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'category_id', 'price', 'cost_price', 'stock', 'barcode', 'created_at', 'is_bulk_product', 'bulk_quantity','bulk_price', 'unit_of_measure', 'unit_price', 'display_price', 'bulk_discounts']

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Product name must be at least 2 characters long")
        return value.strip()

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be positive")
        if value > 1000000:  # ₦1,000,000 maximum
            raise serializers.ValidationError("Price too high")
        return round(value, 2)

    def validate_cost_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Cost price cannot be negative")
        if value > 1000000:
            raise serializers.ValidationError("Cost price too high")
        return round(value, 2) if value else value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative")
        if value > 100000:
            raise serializers.ValidationError("Stock quantity too high")
        return value

    def validate_barcode(self, value):
        if value and len(value) > 100:
            raise serializers.ValidationError("Barcode too long")
        return value

    def get_bulk_discounts(self, obj):
        active_discounts = obj.bulk_discounts.filter(is_active=True)
        return BulkDiscountSerializer(active_discounts, many=True).data


class SaleItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source='product', write_only=True
    )

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_id', 'quantity', 'price_at_sale']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be positive")
        if value > 1000:
            raise serializers.ValidationError("Quantity too high")
        return value

    def validate_price_at_sale(self, value):
        if value <= 0:
            raise serializers.ValidationError("Sale price must be positive")
        if value > 1000000:
            raise serializers.ValidationError("Sale price too high")
        return round(value, 2)


class SaleTransactionSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    cashier = serializers.StringRelatedField(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), source='customer', write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = SaleTransaction
        fields = ['id', 'cashier', 'total_amount', 'paid_amount', 'change_given', 'created_at', 'items', 'customer_name', 'customer_id']

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Total amount must be positive")
        if value > 10000000:  # ₦10,000,000 maximum
            raise serializers.ValidationError("Total amount too high")
        return round(value, 2)

    def validate_paid_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Paid amount must be positive")
        if value > 10000000:
            raise serializers.ValidationError("Paid amount too high")
        return round(value, 2)

    def validate_change_given(self, value):
        if value < 0:
            raise serializers.ValidationError("Change given cannot be negative")
        if value > 1000000:
            raise serializers.ValidationError("Change amount too high")
        return round(value, 2)

    def validate(self, data):
        # Validate that paid amount covers total amount
        if data['paid_amount'] < data['total_amount']:
            raise serializers.ValidationError({
                'paid_amount': 'Paid amount must be greater than or equal to total amount'
            })

        # Validate change calculation
        expected_change = data['paid_amount'] - data['total_amount']
        if abs(expected_change - data['change_given']) > 0.01:  # Allow small floating point differences
            raise serializers.ValidationError({
                'change_given': f'Change given should be {expected_change:.2f}'
            })

        # Validate items exist and have sufficient stock
        items_data = data.get('items', [])
        if not items_data:
            raise serializers.ValidationError({
                'items': 'Sale must contain at least one item'
            })

        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer = validated_data.pop('customer', None)
        
        # Security log
        request = self.context.get('request')
        if request:
            print(f"SECURITY: Sale created by {request.user.username} from {request.META.get('REMOTE_ADDR')}")

        # Create the sale transaction WITH the customer
        transaction_instance = SaleTransaction.objects.create(
            **validated_data,
            customer=customer
        )

        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']

            if product.stock < quantity:
                raise ValidationError(f"Insufficient stock for {product.name}. Available: {product.stock}, Requested: {quantity}")

            # Deduct stock
            product.stock -= quantity
            product.save()

            # Create SaleItem
            SaleItem.objects.create(transaction=transaction_instance, **item_data)

        # Create customer transaction record if customer exists
        if customer:
            CustomerTransaction.objects.create(
                customer=customer,
                sale=transaction_instance,
                points_earned=0  # Will be calculated separately
            )

        return transaction_instance


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = ['id', 'username', 'is_cashier', 'is_manager', 'is_admin']
        extra_kwargs = {
            'username': {'validators': []}  # Disable unique validator for updates
        }

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long")
        
        # Only allow alphanumeric usernames
        if not re.match('^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, and underscores")
        
        return value


class RestockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    restocked_by_username = serializers.CharField(source='restocked_by.username', read_only=True)

    class Meta:
        model = Restock
        fields = ['id', 'product_name', 'quantity_added', 'restocked_by_username', 'restocked_at']

    def validate_quantity_added(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity added must be positive")
        if value > 10000:
            raise serializers.ValidationError("Quantity too high")
        return value


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'phone', 'name', 'email', 'loyalty_points', 'total_spent', 'total_visits', 'created_at', 'notes']

    def validate_phone(self, value):
        # Basic phone validation
        if not re.match(r'^\+?1?\d{9,15}$', value):
            raise serializers.ValidationError("Enter a valid phone number")
        return value

    def validate_email(self, value):
        if value and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            raise serializers.ValidationError("Enter a valid email address")
        return value

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters long")
        return value.strip()


class CustomerTransactionSerializer(serializers.ModelSerializer):
    sale_details = SaleTransactionSerializer(source='sale', read_only=True)
    
    class Meta:
        model = CustomerTransaction
        fields = ['id', 'customer', 'sale', 'sale_details', 'points_earned', 'points_redeemed', 'created_at']


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = '__all__'

    def validate_points_per_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Points per amount must be positive")
        return value

    def validate_redemption_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Redemption rate must be positive")
        return value