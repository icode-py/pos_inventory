import { jwtDecode } from 'jwt-decode';

const readStoreId = () => {
  try {
    const tokens = JSON.parse(localStorage.getItem('authTokens'));
    return tokens ? jwtDecode(tokens.access).store_id ?? null : null;
  } catch {
    return null;
  }
};

/**
 * localStorage key for this store's data. A phone can be shared between stores, so cached
 * products, carts and queued offline sales must never mix.
 */
export const storeKey = (base) => `${base}:${readStoreId() ?? 'none'}`;

/** Move sales queued before stores existed (old shared key, or a token without store_id) to this store. */
export const adoptLegacySales = (base) => {
  if (readStoreId() === null) return;
  const current = JSON.parse(localStorage.getItem(storeKey(base)) || '[]');
  const legacyKeys = [base, `${base}:none`];
  const legacy = legacyKeys.flatMap((key) => JSON.parse(localStorage.getItem(key) || '[]'));
  if (legacy.length > 0) {
    localStorage.setItem(storeKey(base), JSON.stringify([...current, ...legacy]));
  }
  legacyKeys.forEach((key) => localStorage.removeItem(key));
};
