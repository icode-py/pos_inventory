"""Multi-tenant isolation tests: one store must never see or change another store's data."""
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import (
    AuditLog, BulkDiscount, Category, Customer, CustomerTransaction, LoyaltySettings, Product,
    RefusedSale, Restock, SaleItem, SaleTransaction, Staff, StockAdjustment, Store,
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
        cache.clear()  # rate limits are counted in the cache; each test starts fresh
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
        names = [r['product_name'] for r in self.client.get('/api/restock-history/').data['results']]
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

    def test_packs_plus_singles_average_price_is_rounded_not_refused(self):
        # 2 packs of 20 at 900 + 1 sachet at 50 = 1850 for 41, average 45.1219...
        Product.objects.filter(pk=self.a['product'].pk).update(stock=100, price=50, cost_price=30, is_bulk_product=True,
                                                               bulk_quantity=20, bulk_price=900)
        self.client.force_authenticate(self.a['cashier'])
        payload = {'total_amount': 1850, 'paid_amount': 2000, 'change_given': 150,
                   'items': [{'product_id': self.a['product'].pk, 'quantity': 41, 'price_at_sale': 1850 / 41}]}
        response = self.client.post('/api/sales/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(str(SaleItem.objects.get(transaction_id=response.data['id']).price_at_sale), '45.12')

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

    def test_reupload_updates_prices_but_keeps_stock(self):
        response = self.upload()
        self.a['product'].refresh_from_db()
        # Existing product: price from the sheet, stock untouched (5, not 7)
        self.assertEqual((self.a['product'].price, self.a['product'].stock), (900, 5))
        new = Product.objects.get(barcode='333', store=self.a['store'])
        self.assertEqual((new.name, new.price, new.stock), ('Brand New', 900, 7))
        self.assertTrue(response.data['stock_note'])

    def test_upload_checks_bulk_pricing(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['name', 'category_name', 'price', 'cost_price', 'stock', 'barcode',
                   'is_bulk_product', 'bulk_quantity', 'bulk_price'])
        ws.append(['No pack price', 'Drinks', 375, 300, 150, '444', 'yes', 48, None])
        buffer = BytesIO()
        wb.save(buffer)
        file = SimpleUploadedFile('p.xlsx', buffer.getvalue())
        response = self.client.post('/api/products/bulk-upload/', {'file': file}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(barcode='444').exists())


class BulkProductTests(TenantTestCase):
    """Price, cost and stock are per single item; bulk_price is for the whole pack."""

    def payload(self, **extra):
        return {'name': 'Indomie', 'category_id': self.a['category'].pk, 'price': '375', 'cost_price': '300',
                'stock': 150, 'barcode': '555', 'is_bulk_product': True, 'bulk_quantity': 48,
                'bulk_price': '18000', 'unit_of_measure': 'units', **extra}

    def test_pack_priced_same_as_single_items_is_allowed(self):
        response = self.client.post('/api/products/', self.payload(), format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_cheaper_pack_is_allowed(self):
        response = self.client.post('/api/products/', self.payload(bulk_price='17000'), format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_pack_dearer_than_single_items_is_refused(self):
        response = self.client.post('/api/products/', self.payload(bulk_price='18001'), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bulk_price', response.data)

    def test_bulk_needs_pack_size_and_price(self):
        self.assertIn('bulk_quantity', self.client.post(
            '/api/products/', self.payload(bulk_quantity=1), format='json').data)
        self.assertIn('bulk_price', self.client.post(
            '/api/products/', self.payload(bulk_price=None), format='json').data)

    def test_plain_product_with_empty_bulk_fields(self):
        response = self.client.post('/api/products/', self.payload(
            is_bulk_product=False, bulk_quantity=1, bulk_price=None), format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_edit_checks_against_saved_pack(self):
        product = self.client.post('/api/products/', self.payload(), format='json').data
        # Dropping the single price would make the saved pack dearer than 48 singles
        response = self.client.patch(f"/api/products/{product['id']}/", {'price': '200', 'cost_price': '150'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bulk_price', response.data)

    def test_turning_bulk_off_clears_pack(self):
        product = self.client.post('/api/products/', self.payload(), format='json').data
        response = self.client.patch(f"/api/products/{product['id']}/", {'is_bulk_product': False}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        saved = Product.objects.get(pk=product['id'])
        self.assertEqual((saved.bulk_quantity, saved.bulk_price), (1, None))


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


class PlatformTests(TenantTestCase):
    URL = '/api/platform/stores/'

    def setUp(self):
        super().setUp()
        cache.clear()  # these tests log in more often than the 5-a-minute login limit allows
        self.owner = Staff.objects.create_superuser('owner', password='pw12345', store=self.a['store'])
        self.client.force_authenticate(self.owner)

    def new_store(self, **extra):
        return self.client.post(self.URL, {
            'name': 'Charlie Mart', 'plan_tier': 'GROWTH',
            'admin_username': 'charlie_admin', 'admin_password': 'Strong-pass-2026', **extra,
        }, format='json')

    def test_store_admins_and_cashiers_are_kept_out(self):
        for user in (self.a['admin'], self.a['cashier']):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.URL).status_code, 403)
            self.assertEqual(self.new_store().status_code, 403)
            self.assertEqual(self.client.patch(
                f"{self.URL}{self.b['store'].pk}/", {'plan_tier': 'STARTER'}, format='json').status_code, 403)
        self.assertFalse(Store.objects.filter(name='Charlie Mart').exists())

    def test_lists_every_store_with_figures(self):
        rows = {row['name']: row for row in self.client.get(self.URL).data}
        self.assertEqual(set(rows), {'alpha', 'bravo'})
        alpha = rows['alpha']
        self.assertEqual(alpha['admins'], ['alpha_admin'])
        self.assertEqual(alpha['product_count'], 1)
        self.assertEqual(alpha['sales_30d_count'], 1)
        self.assertEqual(Decimal(alpha['sales_30d_total']), Decimal('500'))
        self.assertIsNotNone(alpha['last_sale_at'])
        self.assertEqual(alpha['staff_count'], 3)  # admin, cashier and the owner

    def test_create_store_with_admin_who_can_log_in(self):
        response = self.new_store()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data['admins'], ['charlie_admin'])
        store = Store.objects.get(name='Charlie Mart')
        self.assertEqual(store.plan_tier, 'GROWTH')
        login = APIClient().post('/api/token/', {'username': 'charlie_admin', 'password': 'Strong-pass-2026'}, format='json')
        self.assertEqual(login.status_code, 200, login.content)
        admin = Staff.objects.get(username='charlie_admin')
        self.assertEqual((admin.store, admin.is_admin, admin.is_superuser), (store, True, False))

    def test_create_refuses_taken_username_and_weak_password(self):
        self.assertIn('admin_username', self.new_store(admin_username='ALPHA_admin').data)
        self.assertEqual(self.new_store(admin_password='123').status_code, 400)
        self.assertFalse(Store.objects.filter(name='Charlie Mart').exists())

    def test_change_plan_and_suspend(self):
        url = f"{self.URL}{self.b['store'].pk}/"
        response = self.client.patch(url, {'plan_tier': 'STARTER', 'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        store = Store.objects.get(pk=self.b['store'].pk)
        self.assertEqual((store.plan_tier, store.is_active), ('STARTER', False))
        # Suspended staff are refused on their next request
        self.client.force_authenticate(None)
        self.assertEqual(APIClient().post(
            '/api/token/', {'username': 'bravo_admin', 'password': 'pw12345'}, format='json').status_code, 401)

    def test_cannot_suspend_own_store(self):
        response = self.client.patch(f"{self.URL}{self.a['store'].pk}/", {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Store.objects.get(pk=self.a['store'].pk).is_active)

    def test_stores_cannot_be_deleted_here(self):
        self.assertEqual(self.client.delete(f"{self.URL}{self.b['store'].pk}/").status_code, 405)

    def test_reset_password_only_within_that_store(self):
        url = f"{self.URL}{self.b['store'].pk}/reset-password/"
        response = self.client.post(url, {'username': 'bravo_admin', 'password': 'New-pass-2026'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Staff.objects.get(username='bravo_admin').check_password('New-pass-2026'))
        wrong_store = self.client.post(url, {'username': 'alpha_admin', 'password': 'New-pass-2026'}, format='json')
        self.assertEqual(wrong_store.status_code, 400)
        self.assertTrue(Staff.objects.get(username='alpha_admin').check_password('pw12345'))

    def test_login_token_marks_platform_owner(self):
        from rest_framework_simplejwt.tokens import AccessToken
        login = APIClient().post('/api/token/', {'username': 'owner', 'password': 'pw12345'}, format='json')
        self.assertTrue(AccessToken(login.data['access'])['is_platform'])
        login = APIClient().post('/api/token/', {'username': 'alpha_admin', 'password': 'pw12345'}, format='json')
        self.assertFalse(AccessToken(login.data['access'])['is_platform'])


class AnalyticsTests(TenantTestCase):
    URL = '/api/analytics/'

    def setUp(self):
        super().setUp()
        store, cashier = self.a['store'], self.a['cashier']
        self.today = timezone.localdate()
        self.fanta = self.a['product']
        self.water = Product.objects.create(store=store, name='Water', category=self.a['category'],
                                            price=200, cost_price=100, stock=50, barcode='w1')
        # Today: 2 Fanta sold when they cost 250, plus 1 water
        self.sale = self.make_sale(cashier, 1200, [(self.fanta, 2, 500, 250), (self.water, 1, 200, 100)])
        # Eight days ago: falls in the 7 days before a 7-day report
        self.make_sale(cashier, 1000, [(self.fanta, 2, 500, 250)], days_ago=8)

    def make_sale(self, cashier, total, lines, days_ago=0, at=None):
        sale = SaleTransaction.objects.create(store=self.a['store'], cashier=cashier, total_amount=total,
                                              paid_amount=total, change_given=0)
        for product, qty, price, cost in lines:
            SaleItem.objects.create(transaction=sale, product=product, quantity=qty, price_at_sale=price,
                                    cost_at_sale=cost)
        when = at or timezone.now() - timedelta(days=days_ago)
        SaleTransaction.objects.filter(pk=sale.pk).update(created_at=when)
        return sale

    def report(self, days=7, **params):
        start = self.today - timedelta(days=days - 1)
        response = self.client.get(self.URL, {'start_date': start, 'end_date': self.today, **params})
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def test_totals_profit_and_real_comparison(self):
        data = self.report()
        # alpha's fixture sale (500, cost 300 from the product) + today's 1200
        self.assertEqual(data['summary']['revenue'], 1700)
        self.assertEqual(data['summary']['transactions'], 2)
        self.assertEqual(data['summary']['items'], 4)
        self.assertEqual(data['summary']['profit'], 1700 - (300 + 500 + 100))
        self.assertEqual(data['previous']['revenue'], 1000)
        self.assertEqual(data['change_pct']['revenue'], 70.0)
        self.assertEqual(len(data['daily']), 7)

    def test_today_compares_with_yesterday_up_to_the_same_time(self):
        now = timezone.now()
        self.make_sale(self.a['cashier'], 400, [(self.water, 2, 200, 100)], at=now - timedelta(days=1, hours=1))
        self.make_sale(self.a['cashier'], 900, [(self.water, 3, 300, 100)], at=now - timedelta(days=1) + timedelta(minutes=5))
        data = self.report(days=1)
        if timezone.localtime(now - timedelta(days=1, hours=1)).date() == self.today - timedelta(days=1) and                 timezone.localtime(now - timedelta(days=1) + timedelta(minutes=5)).date() == self.today - timedelta(days=1):
            self.assertEqual(data['previous']['revenue'], 400)  # the later sale yesterday isn't counted yet
        self.assertTrue(data['range']['same_time'])

    def test_past_profit_ignores_later_cost_changes(self):
        before = self.report()['summary']['profit']
        Product.objects.filter(pk=self.fanta.pk).update(cost_price=450)
        # Only the fixture sale has no saved cost, so only it moves (300 -> 450)
        self.assertEqual(self.report()['summary']['profit'], before - 150)

    def test_product_filter_counts_only_that_product(self):
        data = self.report(product_id=self.water.pk)
        self.assertEqual(data['summary']['revenue'], 200)
        self.assertEqual(data['summary']['transactions'], 1)
        self.assertEqual([p['name'] for p in data['products']], ['Water'])

    def test_breakdowns(self):
        data = self.report()
        top = data['products'][0]
        self.assertEqual((top['name'], top['quantity'], top['revenue'], top['transactions']),
                         (self.fanta.name, 3, 1500, 2))
        self.assertEqual(data['categories'][0]['transactions'], 2)  # sales, not lines
        self.assertEqual(data['cashiers'][0]['revenue'], 1700)
        self.assertEqual(sum(h['transactions'] for h in data['hourly']), 2)

    def test_after_midnight_sale_counts_on_the_local_day(self):
        local_midnight = timezone.make_aware(
            timezone.datetime.combine(self.today, timezone.datetime.min.time()))
        self.make_sale(self.a['cashier'], 300, [(self.water, 1, 300, 100)], at=local_midnight + timedelta(minutes=30))
        data = self.report(days=1)
        self.assertEqual(data['summary']['transactions'], 3)
        self.assertEqual(data['hourly'][0]['transactions'], 1)

    def test_lower_plan_gets_no_profit(self):
        Store.objects.filter(pk=self.a['store'].pk).update(plan_tier='GROWTH')
        self.client.force_authenticate(Staff.objects.get(pk=self.a['admin'].pk))
        data = self.report()
        self.assertFalse(data['can_view_profit'])
        self.assertNotIn('profit', data['summary'])
        self.assertNotIn('profit', data['products'][0])

    def test_other_store_never_counted(self):
        data = self.report(cashier_id=self.b['cashier'].pk)
        self.assertEqual(data['summary']['revenue'], 0)
        self.assertEqual(data['products'], [])
        self.client.force_authenticate(self.b['admin'])
        self.assertEqual(self.report()['summary']['revenue'], 500)

    def test_cashier_and_bad_input_refused(self):
        self.assertEqual(self.client.get(self.URL, {'start_date': 'soon'}).status_code, 400)
        self.assertEqual(self.client.get(self.URL, {'start_date': '2026-02-10', 'end_date': '2026-02-01'}).status_code, 400)
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.client.get(self.URL).status_code, 403)

    def test_sales_list_pages_and_items_csv(self):
        for _ in range(30):
            self.make_sale(self.a['cashier'], 200, [(self.water, 1, 200, 100)])
        start = self.today - timedelta(days=6)
        page = self.client.get('/api/analytics/sales/', {'start_date': start, 'end_date': self.today, 'page': 2}).data
        self.assertEqual((page['count'], len(page['results'])), (32, 7))
        csv_text = self.client.get('/api/analytics/items.csv', {'start_date': start, 'end_date': self.today}).content.decode()
        self.assertEqual(len(csv_text.strip().splitlines()), 1 + 1 + 2 + 30)
        self.assertNotIn('bravo', csv_text)


class PaymentMethodTests(TenantTestCase):

    def sell(self, total=1000, paid=None, change=0, **payment):
        Product.objects.filter(pk=self.a['product'].pk).update(stock=100)
        self.client.force_authenticate(self.a['cashier'])
        payload = {'total_amount': total, 'paid_amount': paid or total, 'change_given': change,
                   'items': [{'product_id': self.a['product'].pk, 'quantity': 2, 'price_at_sale': total / 2}], **payment}
        return self.client.post('/api/sales/', payload, format='json')

    def amounts(self, response):
        self.assertEqual(response.status_code, 201, response.content)
        sale = SaleTransaction.objects.get(pk=response.data['id'])
        return sale.payment_method, sale.cash_amount, sale.transfer_amount, sale.card_amount

    def test_old_tills_are_recorded_as_cash(self):
        self.assertEqual(self.amounts(self.sell(paid=1500, change=500)), ('CASH', 1000, 0, 0))

    def test_transfer_and_pos(self):
        self.assertEqual(self.amounts(self.sell(payment_method='TRANSFER')), ('TRANSFER', 0, 1000, 0))
        self.assertEqual(self.amounts(self.sell(payment_method='POS')), ('POS', 0, 0, 1000))

    def test_split_keeps_only_the_cash_part_in_the_drawer(self):
        # 600 by transfer, then 500 cash handed over for the 400 left: 100 change
        response = self.sell(paid=1100, change=100, payment_method='SPLIT', transfer_amount=600)
        self.assertEqual(self.amounts(response), ('SPLIT', 400, 600, 0))

    def test_bad_splits_refused(self):
        self.assertEqual(self.sell(payment_method='SPLIT').status_code, 400)
        self.assertEqual(self.sell(payment_method='SPLIT', transfer_amount=800, card_amount=400).status_code, 400)
        self.assertEqual(self.sell(payment_method='CHEQUE').status_code, 400)

    def test_report_splits_money_by_channel(self):
        self.sell(paid=1500, change=500)
        self.sell(payment_method='TRANSFER')
        self.sell(paid=1100, change=100, payment_method='SPLIT', transfer_amount=300, card_amount=200)
        self.client.force_authenticate(self.a['admin'])
        today = timezone.localdate()
        data = self.client.get('/api/analytics/', {'start_date': today, 'end_date': today}).data
        p = data['payments']
        self.assertEqual((p['cash'], p['transfer'], p['card'], p['unrecorded']), (1500, 1300, 200, 500))
        self.assertEqual(p['counts']['split'], 1)
        cashier = next(c for c in data['cashiers'] if c['username'] == 'alpha_cashier')
        self.assertEqual((cashier['cash'], cashier['transfer']), (1500, 1300))
        self.assertIsNone(self.client.get('/api/analytics/', {'product_id': self.a['product'].pk}).data['payments'])


class StockInsightTests(TenantTestCase):
    URL = '/api/analytics/stock/'

    def product(self, name, stock, age_days=60, price=500, cost=300):
        p = Product.objects.create(store=self.a['store'], name=name, category=self.a['category'], price=price,
                                   cost_price=cost, stock=stock, barcode=name)
        Product.objects.filter(pk=p.pk).update(created_at=timezone.now() - timedelta(days=age_days))
        return p

    def sold(self, product, qty, days_ago=1):
        sale = SaleTransaction.objects.create(store=self.a['store'], cashier=self.a['cashier'],
                                              total_amount=qty * 500, paid_amount=qty * 500, change_given=0)
        SaleItem.objects.create(transaction=sale, product=product, quantity=qty, price_at_sale=500)
        SaleTransaction.objects.filter(pk=sale.pk).update(created_at=timezone.now() - timedelta(days=days_ago))

    def setUp(self):
        super().setUp()
        self.fast = self.product('fast', stock=10)
        self.sold(self.fast, 60)                     # 2 a day, 10 left: 5 days
        self.out = self.product('out', stock=0)
        self.sold(self.out, 30)                      # 1 a day, none left
        self.slow = self.product('slow', stock=20, cost=100)
        self.sold(self.slow, 5, days_ago=45)         # last sold 45 days ago
        self.new = self.product('new', stock=20, age_days=3)
        self.steady = self.product('steady', stock=1000)
        self.sold(self.steady, 30)
        self.data = self.client.get(self.URL).data

    def by_name(self, key):
        return {x['name']: x for x in self.data[key]}

    def test_running_out_with_reorder_suggestion(self):
        fast = self.by_name('running_out')['fast']
        self.assertEqual((fast['days_left'], fast['reorder_qty'], fast['reorder_cost']), (5.0, 18, 5400))
        self.assertNotIn('steady', self.by_name('running_out'))

    def test_out_of_stock_but_selling(self):
        out = self.by_name('out_of_stock_selling')['out']
        self.assertEqual((out['missed_per_day'], out['reorder_qty']), (500, 14))

    def test_slow_movers_skip_new_products(self):
        slow = self.by_name('slow_movers')
        self.assertEqual(slow['slow']['value_cost'], 2000)
        self.assertEqual(slow['slow']['days_since_sale'], 45)
        self.assertNotIn('new', slow)

    def test_totals_and_isolation(self):
        t = self.data['totals']
        # fixture product (5 x 300) + fast 10x300 + slow 20x100 + new 20x300 + steady 1000x300
        self.assertEqual(t['value_cost'], 1500 + 3000 + 2000 + 6000 + 300000)
        self.assertEqual(t['out_of_stock'], 1)
        self.assertIn('potential_profit', t)
        names = {x['name'] for k in ('running_out', 'out_of_stock_selling', 'slow_movers') for x in self.data[k]}
        self.assertFalse(any(n.startswith('bravo') for n in names))

    def test_cashier_refused_and_lower_plan_hides_profit(self):
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.client.get(self.URL).status_code, 403)
        Store.objects.filter(pk=self.a['store'].pk).update(plan_tier='STARTER')
        self.client.force_authenticate(Staff.objects.get(pk=self.a['admin'].pk))
        self.assertNotIn('potential_profit', self.client.get(self.URL).data['totals'])



class RestockTests(TenantTestCase):
    URL = '/api/restock/'

    def post(self, payload):
        return self.client.post(self.URL, payload, format='json')

    def stock(self, product):
        return Product.objects.get(pk=product.pk).stock

    def test_delivery_of_several_products(self):
        water = Product.objects.create(store=self.a['store'], name='Water', category=self.a['category'],
                                       price=200, cost_price=100, stock=0, barcode='w1')
        response = self.post({'items': [
            {'product_id': self.a['product'].pk, 'quantity': 24, 'unit_cost': 320},
            {'product_id': water.pk, 'quantity': 40},
        ]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((self.stock(self.a['product']), self.stock(water)), (29, 40))
        r = Restock.objects.get(product=self.a['product'], quantity_added=24)
        self.assertEqual((r.unit_cost, r.stock_after), (320, 29))
        # Restocking never touches the product's prices
        self.assertEqual(Product.objects.get(pk=self.a['product'].pk).cost_price, 300)
        self.assertEqual(AuditLog.objects.filter(model_name='Restock', store=self.a['store']).count(), 2)

    def test_single_item_still_works(self):
        response = self.post({'product_id': self.a['product'].pk, 'quantity': '5'})
        self.assertEqual((response.status_code, response.data['stock']), (200, 10))

    def test_bad_quantities_change_nothing(self):
        for quantity in (-50, 0, '12abc', 1.5, None, True, 100001):
            response = self.post({'product_id': self.a['product'].pk, 'quantity': quantity})
            self.assertEqual(response.status_code, 400, quantity)
        self.assertEqual(self.stock(self.a['product']), 5)
        self.assertEqual(self.post({'product_id': self.a['product'].pk, 'quantity': 2, 'unit_cost': -1}).status_code, 400)

    def test_one_bad_line_saves_none(self):
        response = self.post({'items': [
            {'product_id': self.a['product'].pk, 'quantity': 3},
            {'product_id': self.b['product'].pk, 'quantity': 3},  # other store's product
        ]})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.stock(self.a['product']), 5)
        self.assertEqual(self.stock(self.b['product']), 5)

    def test_cashier_cannot_restock_or_see_history(self):
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.post({'product_id': self.a['product'].pk, 'quantity': 1}).status_code, 403)
        self.assertEqual(self.client.get('/api/restock-history/').status_code, 403)

    def test_history_pages_search_and_summary(self):
        for _ in range(30):
            self.post({'product_id': self.a['product'].pk, 'quantity': 1, 'unit_cost': 300})
        page = self.client.get('/api/restock-history/', {'page': 2}).data
        self.assertEqual((page['count'], len(page['results'])), (31, 6))
        self.assertEqual(self.client.get('/api/restock-history/', {'search': 'nothing'}).data['count'], 0)
        newest = self.client.get('/api/restock-history/').data['results'][0]
        self.assertEqual((newest['total_cost'], newest['stock_after']), (300, 35))
        summary = self.client.get('/api/restock-summary/').data
        self.assertEqual((summary['today_restocks'], summary['month_spend']), (31, 9000))


class InventoryManagementTests(TenantTestCase):
    ADJ = '/api/stock-adjustments/'

    def product_url(self, suffix=''):
        return f"/api/products/{self.a['product'].pk}/{suffix}"

    def stock(self):
        return Product.objects.get(pk=self.a['product'].pk).stock

    def adjust(self, **line):
        return self.client.post(self.ADJ, {'items': [{'product_id': self.a['product'].pk, **line}]}, format='json')

    def test_editing_a_product_never_overwrites_stock(self):
        # The form loaded stock 5; a sale happens; saving the form must not bring the sold item back
        Product.objects.filter(pk=self.a['product'].pk).update(stock=4)
        payload = {'name': 'alpha Fanta', 'category_id': self.a['category'].pk, 'price': '600',
                   'cost_price': '300', 'stock': 5, 'barcode': '111'}
        self.assertEqual(self.client.put(self.product_url(), payload, format='json').status_code, 200)
        p = Product.objects.get(pk=self.a['product'].pk)
        self.assertEqual((p.stock, p.price), (4, 600))

    def test_new_products_still_take_their_opening_stock(self):
        response = self.client.post('/api/products/', {'name': 'Cola', 'category_id': self.a['category'].pk, 'price': '100',
                                                       'cost_price': '50', 'stock': 12, 'barcode': 'c1'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Product.objects.get(barcode='c1', store=self.a['store']).stock, 12)

    def test_cashiers_do_not_see_cost_prices(self):
        self.assertIn('cost_price', self.client.get('/api/products/').data[0])
        self.client.force_authenticate(self.a['cashier'])
        rows = self.client.get('/api/products/').data
        self.assertNotIn('cost_price', rows[0])
        sales = self.client.get('/api/sales/').data
        sales = sales['results'] if isinstance(sales, dict) else sales
        self.assertNotIn('cost_price', sales[0]['items'][0]['product'])

    def test_archive_hides_and_restore_brings_back(self):
        self.assertEqual(self.client.delete(self.product_url()).data['can_archive'], True)  # has a sale
        self.assertEqual(self.client.post(self.product_url('archive/')).status_code, 200)
        self.assertEqual(self.ids('/api/products/'), set())
        self.assertEqual(self.ids('/api/products/?archived=1'), {self.a['product'].pk})
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.ids('/api/products/?archived=1'), set())
        self.assertEqual(self.client.post(self.product_url('restore/')).status_code, 403)
        self.client.force_authenticate(self.a['admin'])
        self.client.post(self.product_url('restore/'))
        self.assertEqual(self.ids('/api/products/'), {self.a['product'].pk})
        self.assertEqual(self.client.post(f"/api/products/{self.b['product'].pk}/archive/").status_code, 404)

    def test_remove_damaged_stock_is_recorded(self):
        response = self.adjust(change=-2, reason='DAMAGED', note='dropped crate')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.stock(), 3)
        adj = StockAdjustment.objects.get(store=self.a['store'])
        self.assertEqual((adj.change, adj.stock_before, adj.stock_after, adj.unit_cost, adj.adjusted_by),
                         (-2, 5, 3, 300, self.a['admin']))
        self.assertTrue(AuditLog.objects.filter(model_name='StockAdjustment', store=self.a['store']).exists())

    def test_bad_adjustments_change_nothing(self):
        for line in ({'change': -6, 'reason': 'DAMAGED'}, {'change': 0, 'reason': 'DAMAGED'},
                     {'change': '2x', 'reason': 'DAMAGED'}, {'change': -1}, {'change': -1, 'reason': 'OTHER'},
                     {'change': -1, 'counted': 3, 'reason': 'COUNT'}, {'counted': -1}):
            self.assertEqual(self.adjust(**line).status_code, 400, line)
        self.assertEqual(self.stock(), 5)
        other = self.client.post(self.ADJ, {'items': [{'product_id': self.b['product'].pk, 'change': -1, 'reason': 'DAMAGED'}]}, format='json')
        self.assertEqual(other.status_code, 404)
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.adjust(change=-1, reason='DAMAGED').status_code, 403)
        self.assertFalse(StockAdjustment.objects.exists())

    def test_shelf_count_records_only_differences(self):
        water = Product.objects.create(store=self.a['store'], name='Water', category=self.a['category'],
                                       price=200, cost_price=100, stock=10, barcode='w1')
        response = self.client.post(self.ADJ, {'items': [
            {'product_id': self.a['product'].pk, 'counted': 7},
            {'product_id': water.pk, 'counted': 10},
        ]}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((response.data['unchanged'], self.stock()), (1, 7))
        adj = StockAdjustment.objects.get(store=self.a['store'])
        self.assertEqual((adj.change, adj.reason, bool(adj.count_ref)), (2, 'COUNT', True))

    def test_reports_show_stock_lost(self):
        self.adjust(change=-2, reason='DAMAGED')
        self.adjust(change=-1, reason='RETURNED')  # sent back to the supplier: not a loss
        today = timezone.localdate()
        loss = self.client.get('/api/analytics/', {'start_date': today, 'end_date': today}).data['stock_loss']
        self.assertEqual((loss['total'], loss['by_reason'][0]['reason']), (600, 'DAMAGED'))
        listed = self.client.get(self.ADJ, {'product_id': self.a['product'].pk}).data
        self.assertEqual(listed['count'], 2)

    def test_product_insights_and_count_sheet(self):
        data = self.client.get(self.product_url('insights/')).data
        self.assertEqual(data['sold_30d'], 1)
        sheet = self.client.get('/api/products/count-sheet/')
        self.assertEqual(sheet.status_code, 200)
        self.assertIn('spreadsheetml', sheet['Content-Type'])
        self.client.force_authenticate(self.a['cashier'])
        self.assertEqual(self.client.get('/api/products/count-sheet/').status_code, 403)
        self.assertEqual(self.client.get(self.product_url('insights/')).status_code, 403)

    def test_archived_products_leave_stock_insights(self):
        Product.objects.filter(pk=self.a['product'].pk).update(is_archived=True)
        totals = self.client.get('/api/analytics/stock/').data['totals']
        self.assertEqual(totals['products'], 0)


class PriceCheckTests(TenantTestCase):
    """The server refuses sales charged below the listed price (cartons and discounts included)."""

    def setUp(self):
        super().setUp()
        BulkDiscount.objects.filter(store=self.a['store']).delete()
        Product.objects.filter(pk=self.a['product'].pk).update(stock=500, is_bulk_product=True, bulk_quantity=24, bulk_price=11400)
        self.client.force_authenticate(self.a['cashier'])

    def sell(self, quantity, unit_price, total=None, **extra):
        total = total if total is not None else round(quantity * unit_price, 2)
        return self.client.post('/api/sales/', {
            'total_amount': total, 'paid_amount': total, 'change_given': 0,
            'items': [{'product_id': self.a['product'].pk, 'quantity': quantity, 'price_at_sale': unit_price}], **extra,
        }, format='json')

    def test_honest_carton_sale_goes_through(self):
        # 2 cartons at 11,400 = 22,800 for 48 (475 each)
        self.assertEqual(self.sell(48, 475).status_code, 201)

    def test_cut_price_is_refused_online(self):
        response = self.sell(2, 1)
        self.assertEqual(response.status_code, 400)
        self.assertIn('below the listed price', str(response.data))
        self.assertEqual(Product.objects.get(pk=self.a['product'].pk).stock, 500)

    def test_charging_more_is_allowed(self):
        self.assertEqual(self.sell(1, 600).status_code, 201)

    def test_total_must_match_the_items(self):
        response = self.sell(1, 500, total=100)
        self.assertEqual(response.status_code, 400)
        self.assertIn('does not match', str(response.data))

    def test_active_discount_counts(self):
        BulkDiscount.objects.create(store=self.a['store'], name='Promo', discount_type='percentage', minimum_quantity=2,
                                    discount_value=10, product=self.a['product'], start_date=timezone.now() - timedelta(days=1))
        Product.objects.filter(pk=self.a['product'].pk).update(is_bulk_product=False, bulk_quantity=1, bulk_price=None)
        self.assertEqual(self.sell(2, 450).status_code, 201)   # 1,000 less 10%
        self.assertEqual(self.sell(2, 400).status_code, 400)

    def test_offline_cut_price_is_held_then_manager_can_approve(self):
        response = self.sell(2, 1, client_ref='till-cheap', sold_at=timezone.now().isoformat())
        self.assertEqual(response.status_code, 202)
        held = RefusedSale.objects.get(client_ref='till-cheap')
        self.assertIn('below the listed price', held.reason)
        self.client.force_authenticate(self.a['admin'])
        self.assertEqual(self.client.post(f'/api/refused-sales/{held.pk}/approve/').status_code, 200)
        self.assertTrue(SaleTransaction.objects.filter(store=self.a['store'], total_amount=2).exists())

    def test_top_sellers_for_quick_picks(self):
        self.sell(48, 475)
        ids = self.client.get('/api/products/top-sellers/').data
        self.assertEqual(ids[0], self.a['product'].pk)
        self.client.force_authenticate(self.b['cashier'])
        self.assertNotIn(self.a['product'].pk, self.client.get('/api/products/top-sellers/').data)


class DashboardDataTests(TenantTestCase):

    def test_cashiers_see_only_their_own_sales(self):
        other = Staff.objects.create_user('alpha_cashier2', password='pw12345', store=self.a['store'], is_cashier=True)
        SaleTransaction.objects.create(store=self.a['store'], cashier=other, total_amount=900, paid_amount=900, change_given=0)
        self.assertEqual(len(self.client.get('/api/sales/').data), 2)  # admin: whole store
        self.client.force_authenticate(self.a['cashier'])
        rows = self.client.get('/api/sales/').data
        self.assertEqual([r['cashier'] for r in rows], ['alpha_cashier'])
        self.assertEqual(self.client.get('/api/store-today-sales/').status_code, 403)
        self.assertEqual(self.client.get('/api/user-today-performance/').status_code, 200)

    def test_today_and_limit_filters(self):
        old = SaleTransaction.objects.create(store=self.a['store'], cashier=self.a['cashier'], total_amount=1, paid_amount=1, change_given=0)
        SaleTransaction.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=3))
        today = self.client.get('/api/sales/', {'today': 1}).data
        self.assertNotIn(old.pk, [r['id'] for r in today])
        self.assertEqual(len(self.client.get('/api/sales/', {'limit': 1}).data), 1)
