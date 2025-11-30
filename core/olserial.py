from rest_framework import serializers
from .models import Category, Product, SaleTransaction, SaleItem, Staff, Restock, Customer, CustomerTransaction, LoyaltySettings, BulkDiscount
from rest_framework.exceptions import ValidationError
from django.db import transaction
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


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

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

# FIXED: Simplified BulkDiscountSerializer without product_name field
class BulkDiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkDiscount
        fields = '__all__'

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

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer = validated_data.pop('customer', None)  
        
        print(f"DEBUG: Customer in create method: {customer}")  
        
        # Create the sale transaction WITH the customer
        transaction_instance = SaleTransaction.objects.create(
            **validated_data,
            customer=customer  
        )
        
        # Calculate loyalty points if customer exists
        points_earned = 0
        if customer:
            print(f"🔍 DEBUG: Processing loyalty for customer: {customer.name}")
        
        # Get loyalty settings
            loyalty_settings = LoyaltySettings.objects.filter(is_active=True).first()
            if loyalty_settings:
                print(f"🔍 DEBUG: Loyalty settings found: {loyalty_settings.points_per_amount} points per amount")
            
                # Convert to float to ensure proper division
                total_amount = float(validated_data['total_amount'])
                points_per_amount = float(loyalty_settings.points_per_amount)
                
                points_earned = int(total_amount / points_per_amount)
                print(f"🔍 DEBUG: Calculated points: {points_earned} (₦{total_amount} / {points_per_amount})")
                
                # Update customer
                customer.loyalty_points += points_earned
                customer.total_spent += validated_data['total_amount']
                customer.total_visits += 1
                customer.save()
                
                print(f"🔍 DEBUG: Customer updated - Points: {customer.loyalty_points}, Spent: {customer.total_spent}, Visits: {customer.total_visits}")
            else:
                print("❌ DEBUG: No active loyalty settings found!")
        else:
            print("❌ DEBUG: No customer provided for loyalty calculation")

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
                points_earned=points_earned
            )
            print(f"DEBUG: Created customer transaction record")  # Debug

        return transaction_instance

class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = ['id', 'username', 'is_cashier', 'is_manager', 'is_admin']


class RestockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    restocked_by_username = serializers.CharField(source='restocked_by.username', read_only=True)

    class Meta:
        model = Restock
        fields = ['id', 'product_name', 'quantity_added', 'restocked_by_username', 'restocked_at']



class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'phone', 'name', 'email', 'loyalty_points', 'total_spent', 'total_visits', 'created_at', 'notes']

class CustomerTransactionSerializer(serializers.ModelSerializer):
    sale_details = SaleTransactionSerializer(source='sale', read_only=True)
    
    class Meta:
        model = CustomerTransaction
        fields = ['id', 'customer', 'sale', 'sale_details', 'points_earned', 'points_redeemed', 'created_at']

class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = '__all__'