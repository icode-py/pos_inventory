from rest_framework.permissions import BasePermission
from .tier_config import tier_can_access, FEATURE_MIN_TIER, TIER_LABELS, min_tier_for


class IsCashier(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_cashier

class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_manager or request.user.is_admin)

class IsCashierOrManager(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return user and user.is_authenticated and (user.is_cashier or user.is_manager or user.is_admin)


# ── Tier / Plan enforcement ───────────────────────────────────────────────────

def _get_tier():
    from .models import StoreSettings
    return StoreSettings.load().plan_tier


def plan_has_feature(feature):
    """Return True if the current deployment's plan includes the given feature."""
    return tier_can_access(_get_tier(), feature)


def make_tier_permission(feature):
    """
    Factory that returns a DRF permission class requiring 'feature'.
    Usage:  permission_classes = [IsAuthenticated, make_tier_permission('audit_log')]
    """
    class TierPermission(BasePermission):
        def has_permission(self, request, view):
            return plan_has_feature(feature)

        def has_object_permission(self, request, view, obj):
            return plan_has_feature(feature)

        @property
        def message(self):
            current = _get_tier()
            required = TIER_LABELS.get(min_tier_for(feature), min_tier_for(feature))
            return {
                'error': (
                    f'This feature is not available on the {TIER_LABELS.get(current, current)} plan. '
                    f'Upgrade to {required} or higher.'
                ),
                'upgrade_required': True,
                'current_tier': current,
                'required_tier': min_tier_for(feature),
            }

    TierPermission.__name__ = f'TierPermission_{feature}'
    return TierPermission


def tier_block_response(feature):
    """
    Returns a DRF Response dict for use in function-based views.
    Usage:
        from rest_framework.response import Response
        block = tier_block_response('bulk_upload')
        if block: return Response(block, status=403)
    """
    if plan_has_feature(feature):
        return None
    current = _get_tier()
    required = min_tier_for(feature)
    return {
        'error': (
            f'This feature is not available on the {TIER_LABELS.get(current, current)} plan. '
            f'Upgrade to the {TIER_LABELS.get(required, required)} plan or higher.'
        ),
        'upgrade_required': True,
        'current_tier': current,
        'required_tier': required,
    }
