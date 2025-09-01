from rest_framework import serializers
from .models import Category, Product, SaleTransaction, SaleItem, Staff, Restock
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

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )

    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'category_id', 'price', 'cost_price', 'stock', 'barcode', 'created_at']

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

    class Meta:
        model = SaleTransaction
        fields = ['id', 'cashier', 'total_amount', 'paid_amount', 'change_given', 'created_at', 'items']

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        transaction_instance = SaleTransaction.objects.create(**validated_data)

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
