from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Create the Django cache table if it does not already exist'

    def handle(self, *args, **options):
        table_name = 'django_cache_table'
        with connection.cursor() as cursor:
            existing = connection.introspection.table_names(cursor)
        if table_name in existing:
            self.stdout.write(f'Cache table "{table_name}" already exists — skipping.')
            return
        from django.core.management import call_command
        call_command('createcachetable', table_name)
        self.stdout.write(self.style.SUCCESS(f'Cache table "{table_name}" created.'))
