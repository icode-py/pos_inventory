#!/usr/bin/env bash
# Render build command:  bash build.sh
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python manage.py setup_cache      # DatabaseCache table used by rate limiting
python manage.py create_admin     # no-op unless ADMIN_USERNAME / ADMIN_PASSWORD are set
