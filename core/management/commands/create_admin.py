import os
from django.core.management.base import BaseCommand
from core.models import Staff


class Command(BaseCommand):
    help = 'Create the first admin account from environment variables'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME')
        password = os.environ.get('ADMIN_PASSWORD')

        if not username or not password:
            self.stdout.write('ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping.')
            return

        if Staff.objects.filter(username=username).exists():
            self.stdout.write(f'Admin "{username}" already exists — skipping.')
            return

        Staff.objects.create_user(
            username=username,
            password=password,
            is_admin=True,
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Admin "{username}" created successfully.'))
