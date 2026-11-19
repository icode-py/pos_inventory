"""Shared security helpers: password rules, login lockout and safe spreadsheet exports."""
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.password_validation import (
    CommonPasswordValidator, MinimumLengthValidator, NumericPasswordValidator,
    UserAttributeSimilarityValidator,
)
from django.core.cache import cache
from django.core.exceptions import ValidationError


# ── Passwords ───────────────────────────────────────────────────────────────

def password_rules(manages_store):
    """Owners and managers can see takings, costs and staff, so their passwords must be stronger."""
    if manages_store:
        return [MinimumLengthValidator(8), CommonPasswordValidator(), NumericPasswordValidator(),
                UserAttributeSimilarityValidator()]
    return [MinimumLengthValidator(6), CommonPasswordValidator(), UserAttributeSimilarityValidator()]


def password_problem(password, user=None, manages_store=None):
    """A plain sentence saying why this password is not allowed, or None if it is fine."""
    password = str(password or '')
    if len(password) > 128:
        return 'Passwords can be at most 128 characters.'
    if manages_store is None:
        manages_store = bool(user and (user.is_admin or user.is_manager or user.is_superuser))
    for rule in password_rules(manages_store):
        try:
            rule.validate(password, user)
        except ValidationError as e:
            return ' '.join(e.messages)
    return None


# ── Login lockout ───────────────────────────────────────────────────────────
# Rate limits per network address stop one machine guessing quickly. This also stops
# anyone guessing one account's password from many addresses.

LOCKOUT_FAILURES = 10
LOCKOUT_SECONDS = 15 * 60
LOCKED_MESSAGE = 'Too many wrong passwords for this account. Try again in 15 minutes.'


def _key(username):
    return f'login-fail:{str(username or "").strip().lower()[:150]}'


def is_locked_out(username):
    return (cache.get(_key(username)) or 0) >= LOCKOUT_FAILURES


def record_failed_login(username):
    key = _key(username)
    if not cache.add(key, 1, LOCKOUT_SECONDS):
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, LOCKOUT_SECONDS)


def clear_failed_logins(username):
    cache.delete(_key(username))


class LockoutError(Exception):
    pass


class LockoutModelBackend(ModelBackend):
    """The normal username/password check, refusing accounts with too many recent failures.

    Used by both the app login and Django admin, so neither can be used to guess passwords.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('username')
        if is_locked_out(username):
            return None
        user = super().authenticate(request, username=username, password=password, **kwargs)
        if user is None:
            record_failed_login(username)
        else:
            clear_failed_logins(username)
        return user


# ── Spreadsheet exports ─────────────────────────────────────────────────────
# Excel runs text that starts with these characters as a formula, so a product or customer
# named "=HYPERLINK(...)" would become a live link or worse in a downloaded file.

FORMULA_STARTS = ('=', '+', '-', '@', '\t', '\r', '\n')


def safe_cell(value):
    if isinstance(value, str) and value.startswith(FORMULA_STARTS):
        return "'" + value
    return value


def safe_row(values):
    return [safe_cell(v) for v in values]


def write_text_cell(ws, row, column, value):
    """Put a value in an openpyxl sheet so text is always shown as text, never run as a formula."""
    cell = ws.cell(row=row, column=column, value=value)
    if isinstance(value, str):
        cell.data_type = 's'
    return cell
