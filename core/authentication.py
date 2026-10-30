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


class StoreJWTAuthentication(JWTAuthentication):
    """Checks the store on every request, so suspending one takes effect without waiting for tokens to expire."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        check_store_access(user)
        return user
