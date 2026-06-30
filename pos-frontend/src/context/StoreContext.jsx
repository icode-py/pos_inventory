import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axiosInstance from '../utils/axiosInstance';

const TIER_HIERARCHY = { STARTER: 0, GROWTH: 1, BUSINESS: 2 };

const FEATURE_MIN_TIER = {
  customer_loyalty:       'GROWTH',
  audit_log:              'GROWTH',
  bulk_upload:            'GROWTH',
  bulk_discounts:         'GROWTH',
  whatsapp_notifications: 'GROWTH',
  full_reports:           'GROWTH',
  margin_analytics:       'BUSINESS',
};

export const CASHIER_LIMITS = { STARTER: 1, GROWTH: 5, BUSINESS: null };

export const TIER_LABELS = {
  STARTER:  'Starter',
  GROWTH:   'Growth',
  BUSINESS: 'Business',
};

export function hasFeatureForTier(feature, tier) {
  const minTier = FEATURE_MIN_TIER[feature] || 'STARTER';
  return (TIER_HIERARCHY[tier] ?? 0) >= (TIER_HIERARCHY[minTier] ?? 0);
}

export function requiredTierFor(feature) {
  return FEATURE_MIN_TIER[feature] || 'STARTER';
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [store, setStore] = useState({
    name: 'My Store',
    tagline: 'Modern Point of Sale',
    phone: '',
    address: '',
    email: '',
    receipt_footer: 'Thank you for your business!',
    plan_tier: 'STARTER',   // start conservative — overwritten on first fetch
  });

  const fetchSettings = useCallback(() => {
    axiosInstance.get('/store-settings/')
      .then(res => setStore(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch on mount
    fetchSettings();

    // Re-fetch whenever the browser tab regains focus — this catches the case
    // where an admin changes plan_tier in the Django admin panel in another tab
    // and then comes back to the app without doing a hard refresh.
    const handleVisibility = () => {
      if (!document.hidden) fetchSettings();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also re-fetch every 5 minutes as a safety net
    const interval = setInterval(fetchSettings, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [fetchSettings]);

  const hasFeature = (feature) => hasFeatureForTier(feature, store.plan_tier);
  const cashierLimit = CASHIER_LIMITS[store.plan_tier] ?? null;

  return (
    <StoreContext.Provider value={{ store, setStore, hasFeature, cashierLimit, refreshStore: fetchSettings }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
