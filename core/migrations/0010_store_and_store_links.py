import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def store_link():
    return models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='core.store')


class Migration(migrations.Migration):
    """StoreSettings becomes Store (the tenant); records get a nullable link, filled in by 0011."""

    dependencies = [
        ('core', '0009_plan_tier'),
    ]

    operations = [
        migrations.RenameModel(old_name='StoreSettings', new_name='Store'),
        migrations.AlterModelOptions(name='store', options={}),
        migrations.AlterField(
            model_name='store',
            name='plan_tier',
            field=models.CharField(
                choices=[('STARTER', 'Starter'), ('GROWTH', 'Growth'), ('BUSINESS', 'Business')],
                default='STARTER', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='store',
            name='is_active',
            field=models.BooleanField(default=True, help_text='Untick to suspend this store. Its staff can no longer log in.'),
        ),
        migrations.AddField(
            model_name='store',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
        ),
        migrations.AddField(model_name='category', name='store', field=store_link()),
        migrations.AddField(model_name='product', name='store', field=store_link()),
        migrations.AddField(model_name='saletransaction', name='store', field=store_link()),
        migrations.AddField(model_name='restock', name='store', field=store_link()),
        migrations.AddField(model_name='customer', name='store', field=store_link()),
        migrations.AddField(model_name='loyaltysettings', name='store', field=store_link()),
        migrations.AddField(model_name='bulkdiscount', name='store', field=store_link()),
        migrations.AddField(model_name='auditlog', name='store', field=store_link()),
        migrations.AddField(
            model_name='staff',
            name='store',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='staff', to='core.store'),
        ),
    ]
