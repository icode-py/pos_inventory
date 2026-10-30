from django.db import migrations

STORE_OWNED = ['Category', 'Product', 'SaleTransaction', 'Restock', 'Customer',
               'LoyaltySettings', 'BulkDiscount', 'AuditLog', 'Staff']


def assign_to_first_store(apps, schema_editor):
    """Everything that exists today belongs to the one store this deployment has served."""
    Store = apps.get_model('core', 'Store')
    models = [apps.get_model('core', name) for name in STORE_OWNED]

    if not any(m.objects.exists() for m in models):
        return  # fresh database, nothing to assign

    store = Store.objects.order_by('pk').first()
    if store is None:
        store = Store.objects.create(name='My Store', plan_tier='BUSINESS')

    for model in models:
        model.objects.filter(store__isnull=True).update(store=store)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_store_and_store_links'),
    ]

    operations = [
        migrations.RunPython(assign_to_first_store, migrations.RunPython.noop),
    ]
