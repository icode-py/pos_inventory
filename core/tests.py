"""Multi-tenant isolation tests: one store must never see or change another store's data."""
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import (
    AuditLog, BulkDiscount, Category, Customer, CustomerTransaction, LoyaltySettings, Product,
    RefusedSale, Restock, SaleItem, SaleTransaction, Staff, Store,
)

TEST_SETTINGS = dict(
    # The real DatabaseCache needs a table migrations don't create
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
)


def make_store_data(name, tier='BUSINESS'):
    """A store with one of everything. Barcode and phone are the same in every store on purpose."""
    store = Store.objects.create(name=name, plan_tier=tier)
    admin = Staff.objects.create_user(f'{name}_admin', password='pw12345', store=store, is_admin=True)
    cashier = Staff.objects.create_user(f'{name}_cashier', password='pw12345', store=store, is_cashier=True)
    category = Category.objects.create(store=store, name='Drinks')
    product = Product.objects.create(
        store=store, name=f'{name} Fanta', category=category, price=500, cost_price=300,
        stock=5, barcode='111',
    )
    customer = Customer.objects.create(store=store, name=f'{name} Cust', phone='08011111111', loyalty_points=50)
    sale = SaleTransaction.objects.create(
        store=store, cashier=cashier, customer=customer,
        total_amount=500, paid_amount=500, change_given=0,
    )
    SaleItem.objects.create(transaction=sale, product=product, quantity=1, price_at_sale=500)
    CustomerTransaction.objects.create(customer=customer, sale=sale, points_earned=5)
    Restock.objects.create(store=store, product=product, quantity_added=3, restocked_by=admin)
    LoyaltySettings.objects.create(store=store)
    discount = BulkDiscount.objects.create(
        store=store, name='Promo', discount_type='percentage', minimum_quantity=2,
        discount_value=10, product=product, start_date=timezone.now(),
    )
    AuditLog.objects.create(
        store=store, action='CREATE', model_name='Product', object_id=str(product.pk),
        object_repr=f'{name} log', changed_by=admin,
    )
    return dict(store=store, admin=admin, cashier=cashier, category=category, product=product,
                customer=customer, sale=sale, discount=discount)


@override_settings(**TEST_SETTINGS)
class TenantTestCase(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.a = make_store_data('alpha')
        cls.b = make_store_data('bravo')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.a['admin'])

    def ids(self, url):
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        rows = data['results'] if isinstance(data, dict) and 'results' in data else data
        return {row['id'] for row in rows}


class ListIsolationTests(TenantTestCase):

    def test_lists_only_show_own_store(self):
        cases = [
            ('/api/categories/', 'category'), ('/api/products/', 'product'),
            ('/api/sales/', 'sale'), ('/api/customers/', 'customer'),
            ('/api/bulk-discounts/', 'discount'),
        ]
        for url, key in cases:
            with self.subTest(url=url):
                self.assertEqual(self.ids(url), {self.a[key].pk})

    def test_staff_list(self):
        self.assertEqual(self.ids('/api/staff/'), {self.a['admin'].pk, self.a['cashier'].pk})

    def test_restock_history(self):
        names = [r['product_name'] for r in self.client.get('/api/restock-history/').data]
        self.assertEqual(names, ['alpha Fanta'])

    def test_audit_log(self):
        reprs = [r['object_repr'] for r in self.client.get('/api/audit-log/').data['results']]
        self.assertEqual(reprs, ['alpha log'])

    def test_loyalty_settings(self):
        self.assertEqual(len(self.client.get('/api/loyalty-settings/').data), 1)

    def test_customer_transactions_of_other_store_are_hidden(self):
        url = f"/api/customer-transactions/?customer_id={self.b['customer'].pk}"
        self.assertEqual(self.client.get(url).data, [])


class ObjectIsolationTests(TenantTestCase):

    def test_other_store_objects_are_404(self):
        cases = [
            ('categories', 'category'), ('products', 'product'), ('sales', 'sale'),
            ('customers', 'customer'), ('bulk-discounts', 'discount'),
        ]
        for route, key in cases:
            url = f'/api/{route}/{self.b[key].pk}/'
            for method in ('get', 'delete'):
                with self.subTest(url=url, method=method):
                    self.assertEqual(getattr(self.client, method)(url).status_code, 404)
            with self.subTest(url=url, method='patch'):
                self.assertEqual(self.client.patch(url, {'name': 'hacked'}, format='json').status_code, 404)
        self.b['product'].refresh_from_db()
        self.assertEqual(self.b['product'].name, 'bravo Fanta')

    def test_restock_other_store_product(self):
        response = self.client.post('/api/restock/', {'product_id': self.b['product'].pk, 'quantity': 5}, format='json')
        self.assertEqual(response.status_code, 404)
        self.b['product'].refresh_from_db()
        self.assertEqual(self.b['product'].stock, 5)

    def test_redeem_points_of_other_store_customer(self):
        response = self.client.post(
            '/api/redeem-points/', {'customer_id': self.b['customer'].pk, 'points_to_redeem': 10}, format='json')
        self.assertEqual(response.status_code, 404)
        self.b['customer'].refresh_from_db()
        self.assertEqual(self.b['customer'].loyalty_points, 50)

    def test_staff_actions_on_other_store(self):
        pk = self.b['cashier'].pk
        self.assertEqual(self.client.patch(f'/api/staff/{pk}/update/', {'is_active': False}, format='json').status_code, 404)
        self.assertEqual(self.client.post(f'/api/staff/{pk}/reset-password/', {'new_password': 'hacked1'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/staff/{pk}/delete/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/staff/{pk}/').status_code, 404)
        target = Staff.objects.get(pk=pk)
        self.assertTrue(target.is_active)
        self.assertTrue(target.check_password('pw12345'))


class WriteIsolationTests(TenantTestCase):

    def product_payload(self, **extra):
        return {'name': 'Cola', 'category_id': self.a['category'].pk, 'price': '100', 'cost_price': '50',
                'stock': 3, 'barcode': '222', **extra}

    def sale_payload(self, product, **extra):
        return {'total_amount': '500', 'paid_amount': '500', 'change_given': '0',
                'items': [{'product_id': product.pk, 'quantity': 1, 'price_at_sale': '500'}], **extra}

    def test_new_records_belong_to_own_store(self):
        self.assertEqual(self.client.post('/api/categories/', {'name': 'Snacks'}, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/products/', self.product_payload(), format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/customers/', {'name': 'New', 'phone': '08022222222'}, format='json').status_code, 201)
        store = self.a['store']
        self.assertEqual(Category.objects.get(name='Snacks').store, store)
        self.assertEqual(Product.objects.get(barcode='222').store, store)
        self.assertEqual(Customer.objects.get(phone='08022222222').store, store)

    def test_client_cannot_choose_the_store(self):
        response = self.client.post(
            '/api/categories/', {'name': 'Snacks', 'store': self.b['store'].pk}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Category.objects.get(name='Snacks').store, self.a['store'])

    def test_product_cannot_use_other_store_category(self):
        payload = self.product_payload(category_id=self.b['category'].pk)
        self.assertEqual(self.client.post('/api/products/', payload, format='json').status_code, 400)

    def test_discount_cannot_use_other_store_product(self):
        response = self.client.post('/api/bulk-discounts/', {
            'name': 'Bad', 'discount_type': 'percentage', 'minimum_quantity': 2, 'discount_value': '5',
            'product': self.b['product'].pk, 'start_date': timezone.now().isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_sale_records_store_and_cashier(self):
        self.client.force_authenticate(self.a['cashier'])
        response = self.client.post('/api/sales/', self.sale_payload(self.a['product']), format='json')
        self.assertEqual(response.status_code, 201, response.content)
        sale = SaleTransaction.objects.get(pk=response.data['id'])
        self.assertEqual(sale.store, self.a['store'])

    def test_resent_sale_is_recorded_once(self):
        payload = self.sale_payload(self.a['product'], client_ref='till-1')
        first = self.client.post('/api/sales/', payload, format='json')
        again = self.client.post('/api/sales/', payload, format='json')
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(again.status_code, 200, again.content)
        self.assertEqual(again.data['id'], first.data['id'])
        self.assertEqual(SaleTransaction.objects.filter(client_ref='till-1').count(), 1)
        self.a['product'].refresh_from_db()
        self.assertEqual(self.a['product'].stock, 4)

    def test_client_ref_is_per_store(self):
        self.client.post('/api/sales/', self.sale_payload(self.a['product'], client_ref='till-1'), format='json')
        self.client.force_authenticate(self.b['admin'])
        response = self.client.post('/api/sales/', self.sale_payload(self.b['product'], client_ref='till-1'), format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_sale_cannot_use_other_store_product(self):
        response = self.client.post('/api/sales/', self.sale_payload(self.b['product']), format='json')
        self.assertEqual(response.status_code, 400)
        self.b['product'].refresh_from_db()
        self.assertEqual(self.b['product'].stock, 5)

    def test_sale_cannot_use_other_store_customer(self):
        payload = self.sale_payload(self.a['product'], customer_id=self.b['customer'].pk)
        self.assertEqual(self.client.post('/api/sales/', payload, format='json').status_code, 400)

    def test_loyalty_points_use_own_store_settings(self):
        LoyaltySettings.objects.filter(store=self.a['store']).update(points_per_amount=10)
        LoyaltySettings.objects.filter(store=self.b['store']).delete()
        payload = self.sale_payload(self.a['product'], customer_id=self.a['customer'].pk)
        self.assertEqual(self.client.post('/api/sales/', payload, format='json').status_code, 201)
        self.a['customer'].refresh_from_db()
        self.assertEqual(self.a['customer'].loyalty_points, 100)

    def test_register_staff_joins_own_store(self):
        response = self.client.post('/api/register-staff/', {
            'username': 'newbie', 'password': 'pw12345', 'confirm_password': 'pw12345', 'is_cashier': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Staff.objects.get(username='newbie').store, self.a['store'])

    def test_audit_entries_stay_in_own_store(self):
        self.client.post('/api/categories/', {'name': 'Snacks'}, format='json')
        self.client.post('/api/restock/', {'product_id': self.a['product'].pk, 'quantity': 1}, format='json')
        self.assertFalse(AuditLog.objects.filter(store=self.b['store'], object_repr__contains='Snacks').exists())
        self.assertEqual(AuditLog.objects.filter(store=self.a['store']).count(), 3)


class OfflineSaleTests(TenantTestCase):
    SOLD_AT = '2026-10-25T09:30:00Z'

    def sale(self, product, ref='till-1', quantity=1, **extra):
        total = str(500 * quantity)
        return {'client_ref': ref, 'total_amount': total, 'paid_amount': total, 'change_given': '0',
                'items': [{'product_id': product.pk, 'quantity': quantity, 'price_at_sale': '500'}], **extra}

    def refuse(self, quantity=99):
        """Send an offline sale for more than the 5 in stock, as the cashier."""
        self.client.force_authenticate(self.a['cashier'])
        response = self.client.post(
            '/api/sales/', self.sale(self.a['product'], quantity=quantity, sold_at=self.SOLD_AT), format='json')
        self.assertEqual(response.status_code, 202, response.content)
        self.client.force_authenticate(self.a['admin'])
        return RefusedSale.objects.get(client_ref='till-1')

    def test_offline_sale_keeps_its_time(self):
        payload = self.sale(self.a['product'], sold_at=self.SOLD_AT)
        response = self.client.post('/api/sales/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        sale = SaleTransaction.objects.get(pk=response.data['id'])
        self.assertEqual(sale.created_at.isoformat()[:16], self.SOLD_AT[:16])

    def test_future_sale_time_is_not_trusted(self):
        future = (timezone.now() + timedelta(days=30)).isoformat()
        response = self.client.post('/api/sales/', self.sale(self.a['product'], sold_at=future), format='json')
        sale = SaleTransaction.objects.get(pk=response.data['id'])
        self.assertLessEqual(sale.created_at, timezone.now())

    def test_refused_offline_sale_is_held_without_touching_stock(self):
        refused = self.refuse()
        self.assertEqual(refused.status, 'PENDING')
        self.assertEqual(refused.cashier, self.a['cashier'])
        self.assertIn('Insufficient stock', refused.reason)
        self.a['product'].refresh_from_db()
        self.assertEqual(self.a['product'].stock, 5)

    def test_resending_a_refused_sale_keeps_one_review(self):
        self.refuse()
        self.client.force_authenticate(self.a['cashier'])
        again = self.sale(self.a['product'], quantity=99, sold_at=self.SOLD_AT)
        self.assertEqual(self.client.post('/api/sales/', again, format='json').status_code, 202)
        self.assertEqual(RefusedSale.objects.count(), 1)

    def test_online_sale_is_still_refused(self):
        response = self.client.post('/api/sales/', self.sale(self.a['product'], quantity=99), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(RefusedSale.objects.count(), 0)

    def test_manager_sees_only_own_store(self):
        self.refuse()
        self.assertEqual(len(self.client.get('/api/refused-sales/').data), 1)
        self.client.force_authenticate(self.b['admin'])
        self.assertEqual(self.client.get('/api/refused-sales/').data, [])

    def test_other_store_and_cashier_cannot_decide(self):
        refused = self.refuse()
        self.client.force_authenticate(self.b['admin'])
        self.assertEqual(self.client.post(f'/api/refused-sales/{refused.pk}/approve/').status_code, 404)
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.client.post(f'/api/refused-sales/{refused.pk}/approve/').status_code, 403)
        refused.refresh_from_db()
        self.assertEqual(refused.status, 'PENDING')

    def test_approve_records_sale_at_real_time_and_empties_stock(self):
        refused = self.refuse()
        response = self.client.post(f'/api/refused-sales/{refused.pk}/approve/')
        self.assertEqual(response.status_code, 200, response.content)
        refused.refresh_from_db()
        self.assertEqual(refused.status, 'APPROVED')
        self.assertEqual(refused.reviewed_by, self.a['admin'])
        self.assertEqual(refused.sale.cashier, self.a['cashier'])
        self.assertEqual(refused.sale.created_at.isoformat()[:16], self.SOLD_AT[:16])
        self.a['product'].refresh_from_db()
        self.assertEqual(self.a['product'].stock, 0)
        self.assertEqual(self.client.post(f'/api/refused-sales/{refused.pk}/approve/').status_code, 404)
        self.assertEqual(SaleTransaction.objects.filter(client_ref='till-1').count(), 1)

    def test_dismiss_records_nothing(self):
        refused = self.refuse()
        self.assertEqual(self.client.post(f'/api/refused-sales/{refused.pk}/dismiss/').status_code, 200)
        self.assertFalse(SaleTransaction.objects.filter(client_ref='till-1').exists())
        self.a['product'].refresh_from_db()
        self.assertEqual(self.a['product'].stock, 5)
        self.assertEqual(self.client.get('/api/refused-sales/').data, [])

    def test_approve_explains_a_deleted_product(self):
        refused = self.refuse()
        refused.payload['items'][0]['product_id'] = 999999
        refused.save()
        self.assertEqual(self.client.post(f'/api/refused-sales/{refused.pk}/approve/').status_code, 400)
        refused.refresh_from_db()
        self.assertEqual(refused.status, 'PENDING')


class UniquenessTests(TenantTestCase):

    def test_same_values_allowed_in_different_stores(self):
        self.assertEqual(Product.objects.filter(barcode='111').count(), 2)
        self.assertEqual(Customer.objects.filter(phone='08011111111').count(), 2)
        self.assertEqual(Category.objects.filter(name='Drinks').count(), 2)

    def test_duplicates_rejected_within_a_store(self):
        response = self.client.post('/api/products/', {
            'name': 'Copy', 'category_id': self.a['category'].pk, 'price': '100', 'cost_price': '50',
            'stock': 3, 'barcode': '111'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('barcode', response.data)

        response = self.client.post('/api/customers/', {'name': 'Copy', 'phone': '08011111111'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)

        response = self.client.post('/api/categories/', {'name': 'Drinks'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)

    def test_keeping_own_value_on_update_is_fine(self):
        url = f"/api/products/{self.a['product'].pk}/"
        self.assertEqual(self.client.patch(url, {'barcode': '111'}, format='json').status_code, 200)


class ReportIsolationTests(TenantTestCase):

    def test_sales_report(self):
        data = self.client.get('/api/sales-report/').data
        self.assertEqual([s['id'] for s in data['sales']], [self.a['sale'].pk])

    def test_sales_report_cannot_reach_other_store_cashier(self):
        data = self.client.get(f"/api/sales-report/?cashier_id={self.b['cashier'].pk}").data
        self.assertEqual(data['sales'], [])

    def test_today_totals(self):
        data = self.client.get('/api/store-today-sales/').data
        self.assertEqual(data['transaction_count'], 1)

    def test_margin_report(self):
        data = self.client.get('/api/margin-report/').data
        self.assertEqual([p['name'] for p in data['by_product']], ['alpha Fanta'])

    def test_low_stock_alerts(self):
        data = self.client.get('/api/low-stock-alerts/').data
        self.assertEqual([p['name'] for p in data['alerts']], ['alpha Fanta'])


class BulkUploadTests(TenantTestCase):

    def upload(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['name', 'category_name', 'price', 'cost_price', 'stock', 'barcode'])
        ws.append(['Uploaded', 'Drinks', 900, 400, 7, '111'])
        ws.append(['Brand New', 'Fresh', 900, 400, 7, '333'])
        buffer = BytesIO()
        wb.save(buffer)
        file = SimpleUploadedFile('p.xlsx', buffer.getvalue())
        return self.client.post('/api/products/bulk-upload/', {'file': file}, format='multipart')

    def test_upload_only_touches_own_store(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((response.data['created'], response.data['updated']), (1, 1))
        self.a['product'].refresh_from_db()
        self.b['product'].refresh_from_db()
        self.assertEqual(self.a['product'].name, 'Uploaded')
        self.assertEqual(self.b['product'].name, 'bravo Fanta')
        self.assertEqual(Product.objects.get(barcode='333').store, self.a['store'])
        self.assertEqual(Category.objects.get(name='Fresh').store, self.a['store'])
        self.assertEqual(Category.objects.filter(name='Drinks').count(), 2)


class PlanTierTests(TenantTestCase):

    def test_tier_is_per_store(self):
        Store.objects.filter(pk=self.a['store'].pk).update(plan_tier='STARTER')
        self.client.force_authenticate(Staff.objects.get(pk=self.a['admin'].pk))
        self.assertEqual(self.client.get('/api/audit-log/').status_code, 403)
        self.assertEqual(self.client.get('/api/margin-report/').status_code, 403)

        self.client.force_authenticate(self.b['admin'])
        self.assertEqual(self.client.get('/api/audit-log/').status_code, 200)
        self.assertEqual(self.client.get('/api/margin-report/').status_code, 200)

    def test_cashier_limit_counts_own_store_only(self):
        Store.objects.filter(pk=self.a['store'].pk).update(plan_tier='GROWTH')  # limit 5, has 1
        for i in range(10):
            Staff.objects.create_user(f'bravo_c{i}', store=self.b['store'], is_cashier=True)
        self.client.force_authenticate(Staff.objects.get(pk=self.a['admin'].pk))
        response = self.client.post('/api/register-staff/', {
            'username': 'second', 'password': 'pw12345', 'confirm_password': 'pw12345', 'is_cashier': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)


class StoreSettingsTests(TenantTestCase):

    def test_settings_are_per_store(self):
        self.assertEqual(self.client.get('/api/store-settings/').data['name'], 'alpha')
        self.client.force_authenticate(self.b['admin'])
        self.assertEqual(self.client.get('/api/store-settings/').data['name'], 'bravo')

    def test_update_changes_own_store_only(self):
        response = self.client.patch('/api/store-settings/update/', {'name': 'Alpha Mart'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Store.objects.get(pk=self.a['store'].pk).name, 'Alpha Mart')
        self.assertEqual(Store.objects.get(pk=self.b['store'].pk).name, 'bravo')

    def test_store_cannot_change_own_plan_or_suspension(self):
        self.client.patch('/api/store-settings/update/', {'plan_tier': 'BUSINESS', 'is_active': False}, format='json')
        store = Store.objects.get(pk=self.a['store'].pk)
        self.assertTrue(store.is_active)

    def test_anonymous_sees_no_store_details(self):
        self.client.force_authenticate(None)
        response = self.client.get('/api/store-settings/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'POS')


class LoginTests(TenantTestCase):

    def login(self, username):
        return APIClient().post('/api/token/', {'username': username, 'password': 'pw12345'}, format='json')

    def test_login_works_and_carries_store(self):
        response = self.login('alpha_admin')
        self.assertEqual(response.status_code, 200)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(client.get('/api/store-settings/').data['name'], 'alpha')

    def test_suspended_store_cannot_log_in(self):
        Store.objects.filter(pk=self.a['store'].pk).update(is_active=False)
        self.assertEqual(self.login('alpha_admin').status_code, 401)
        self.assertEqual(self.login('bravo_admin').status_code, 200)

    def test_suspending_blocks_existing_tokens(self):
        access = self.login('alpha_admin').data['access']
        Store.objects.filter(pk=self.a['store'].pk).update(is_active=False)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(client.get('/api/products/').status_code, 401)

    def test_account_without_store_is_rejected(self):
        Staff.objects.create_user('orphan', password='pw12345')
        self.assertEqual(self.login('orphan').status_code, 401)

    def test_platform_superuser_without_store_sees_no_store_data(self):
        root = Staff.objects.create_superuser('root', password='pw12345')
        self.client.force_authenticate(root)
        self.assertEqual(self.client.get('/api/products/').status_code, 403)
        self.assertEqual(self.client.get('/api/sales-report/').status_code, 403)
