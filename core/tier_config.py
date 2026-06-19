# Tier hierarchy — higher index = more features
TIER_HIERARCHY = {
    'STARTER':  0,
    'GROWTH':   1,
    'BUSINESS': 2,
}

# Minimum tier required to access each feature
FEATURE_MIN_TIER = {
    'customer_loyalty':      'GROWTH',
    'audit_log':             'GROWTH',
    'bulk_upload':           'GROWTH',
    'bulk_discounts':        'GROWTH',
    'whatsapp_notifications':'GROWTH',
    'full_reports':          'GROWTH',   # Sales analytics tabs
    'margin_analytics':      'BUSINESS',
}

# Max cashier accounts per tier (None = unlimited)
CASHIER_LIMITS = {
    'STARTER':  1,
    'GROWTH':   5,
    'BUSINESS': None,
}

TIER_LABELS = {
    'STARTER':  'Starter',
    'GROWTH':   'Growth',
    'BUSINESS': 'Business',
}

def tier_can_access(current_tier, feature):
    """Return True if current_tier meets or exceeds the minimum tier for feature."""
    min_tier = FEATURE_MIN_TIER.get(feature, 'STARTER')
    return TIER_HIERARCHY.get(current_tier, 0) >= TIER_HIERARCHY[min_tier]

def min_tier_for(feature):
    return FEATURE_MIN_TIER.get(feature, 'STARTER')
