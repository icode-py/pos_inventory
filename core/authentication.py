from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


def check_store_access(user):
    """Reject accounts whose store is suspended, or that have no store (platform superusers excepted)."""
    if user.store_id is None:
        if not user.is_superuser:
            raise AuthenticationFailed('This account is not linked to a store.')
        return
    if not user.store.is_active:
        raise AuthenticationFailed('This store has been suspended. Please contact support.')


def check_token_still_valid(user, token):
    """Tokens issued before the user's password last changed are refused."""
    cutoff = user.tokens_valid_after
    if cutoff and int(token.get('iat', 0)) < int(cutoff.timestamp()):
        raise AuthenticationFailed('Your session has ended. Please log in again.', code='session_ended')


class StoreJWTAuthentication(JWTAuthentication):
    """Checks the store on every request, so suspending one takes effect without waiting for tokens to expire."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        check_token_still_valid(user, validated_token)
        check_store_access(user)
        return user
