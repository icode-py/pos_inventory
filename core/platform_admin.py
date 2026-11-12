"""Platform owner tools: create, list and manage every store. Only superusers get in."""
import logging
import re
from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, DecimalField, OuterRef, Prefetch, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import Product, SaleTransaction, Staff, Store

logger = logging.getLogger(__name__)


class IsPlatformOwner(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


def check_new_username(value):
    if len(value) < 3:
        raise serializers.ValidationError('Username must be at least 3 characters long')
    if not re.match('^[a-zA-Z0-9_]+$', value):
        raise serializers.ValidationError('Username can only contain letters, numbers, and underscores')
    if Staff.objects.filter(username__iexact=value).exists():
        raise serializers.ValidationError('This username is taken. Usernames are shared across all stores.')
    return value


def clean_store_name(value):
    if len(value.strip()) < 2:
        raise serializers.ValidationError('Store name must be at least 2 characters long')
    return value.strip()


def check_password(value, user=None):
    try:
        validate_password(value, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError(list(error.messages))
    return value


class PlatformStoreSerializer(serializers.ModelSerializer):
    staff_count = serializers.IntegerField(read_only=True)
    product_count = serializers.IntegerField(read_only=True)
    sales_30d_count = serializers.IntegerField(read_only=True)
    sales_30d_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    last_sale_at = serializers.DateTimeField(read_only=True)
    admins = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = ['id', 'name', 'plan_tier', 'is_active', 'created_at', 'phone', 'email',
                  'staff_count', 'product_count', 'sales_30d_count', 'sales_30d_total', 'last_sale_at', 'admins']
        read_only_fields = ['created_at', 'phone', 'email']

    def get_admins(self, store):
        return [admin.username for admin in getattr(store, 'admins', [])]

    def validate_name(self, value):
        return clean_store_name(value)

    def validate_is_active(self, value):
        request = self.context['request']
        if not value and self.instance and self.instance.pk == request.user.store_id:
            raise serializers.ValidationError('You cannot suspend your own store: it would lock you out.')
        return value


class NewStoreSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    plan_tier = serializers.ChoiceField(choices=Store.TIER_CHOICES, default='STARTER')
    admin_username = serializers.CharField(max_length=150)
    admin_password = serializers.CharField(write_only=True)

    def validate_name(self, value):
        return clean_store_name(value)

    def validate_admin_username(self, value):
        return check_new_username(value)

    def validate(self, data):
        check_password(data['admin_password'], Staff(username=data['admin_username']))
        return data


class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


def count_in_store(model, **filters):
    rows = (model.objects.filter(store=OuterRef('pk'), **filters).order_by()
            .values('store').annotate(n=Count('pk')).values('n'))
    return Coalesce(Subquery(rows), Value(0))


class PlatformStoreViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                           viewsets.GenericViewSet):
    """Stores are suspended, never deleted here, so their records survive."""
    serializer_class = PlatformStoreSerializer
    permission_classes = [IsPlatformOwner]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch']

    def get_queryset(self):
        since = timezone.now() - timedelta(days=30)
        recent = SaleTransaction.objects.filter(store=OuterRef('pk'), created_at__gte=since).order_by()
        return (
            Store.objects
            .annotate(
                staff_count=count_in_store(Staff, is_active=True),
                product_count=count_in_store(Product),
                sales_30d_count=count_in_store(SaleTransaction, created_at__gte=since),
                sales_30d_total=Coalesce(
                    Subquery(recent.values('store').annotate(t=Sum('total_amount')).values('t')),
                    Value(0), output_field=DecimalField(max_digits=15, decimal_places=2),
                ),
                last_sale_at=Subquery(
                    SaleTransaction.objects.filter(store=OuterRef('pk')).order_by('-created_at').values('created_at')[:1]
                ),
            )
            .prefetch_related(Prefetch('staff', queryset=Staff.objects.filter(is_admin=True).order_by('username'),
                                       to_attr='admins'))
            .order_by('name')
        )

    def create(self, request, *args, **kwargs):
        serializer = NewStoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            store = Store.objects.create(name=data['name'], plan_tier=data['plan_tier'])
            Staff.objects.create_user(
                username=data['admin_username'], password=data['admin_password'],
                store=store, is_admin=True, is_active=True,
            )
        logger.info('Platform: %s created store %s (%s)', request.user.username, store.pk, store.name)
        return Response(self.get_serializer(self.get_queryset().get(pk=store.pk)).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        store = serializer.save()
        logger.info('Platform: %s updated store %s: %s', self.request.user.username, store.pk,
                    {k: v for k, v in serializer.validated_data.items()})

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        store = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = Staff.objects.filter(store=store, username=serializer.validated_data['username']).first()
        if not staff:
            return Response({'username': ['No staff member with that username in this store.']},
                            status=status.HTTP_400_BAD_REQUEST)
        password = check_password(serializer.validated_data['password'], staff)
        staff.set_password(password)
        staff.save(update_fields=['password'])
        logger.info('Platform: %s reset the password of %s in store %s', request.user.username, staff.username, store.pk)
        return Response({'detail': f'Password changed for {staff.username}.'})
