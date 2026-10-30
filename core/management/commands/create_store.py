from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Staff, Store


class Command(BaseCommand):
    help = 'Create a new store and its first admin account'

    def add_arguments(self, parser):
        parser.add_argument('--name', required=True, help='Store name')
        parser.add_argument('--admin-username', required=True)
        parser.add_argument('--admin-password', required=True)
        parser.add_argument('--tier', default='STARTER', choices=[t for t, _ in Store.TIER_CHOICES])

    def handle(self, *args, **options):
        username = options['admin_username']
        if Staff.objects.filter(username=username).exists():
            raise CommandError(f'Username "{username}" is already taken. Usernames are shared across all stores.')

        with transaction.atomic():
            store = Store.objects.create(name=options['name'], plan_tier=options['tier'])
            Staff.objects.create_user(
                username=username,
                password=options['admin_password'],
                store=store,
                is_admin=True,
                is_active=True,
            )
        self.stdout.write(self.style.SUCCESS(f'Store "{store.name}" created with admin "{username}".'))
