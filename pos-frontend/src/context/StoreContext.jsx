import { createContext, useContext, useEffect, useState } from 'react';
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
    plan_tier: 'BUSINESS',   // default — overwritten once settings load
  });

  useEffect(() => {
    axiosInstance.get('/store-settings/')
      .then(res => setStore(res.data))
      .catch(() => {});
  }, []);

  // Convenience: check if the current plan includes a feature
  const hasFeature = (feature) => hasFeatureForTier(feature, store.plan_tier);

  const cashierLimit = CASHIER_LIMITS[store.plan_tier] ?? null;

  return (
    <StoreContext.Provider value={{ store, setStore, hasFeature, cashierLimit }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
