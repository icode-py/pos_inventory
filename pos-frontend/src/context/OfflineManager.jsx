import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { fetchProducts } from '../utils/productCache';
import { storeKey, adoptLegacySales } from '../utils/storeKey';

const PENDING_SALES = 'holo_pending_sales';
const REFRESH_INTERVAL = 5 * 60 * 1000;

const readPending = (key) => JSON.parse(localStorage.getItem(key) || '[]');

const rejectionReason = (error) => {
  const data = error.response?.data;
  if (Array.isArray(data)) return data[0];
  return data?.detail || 'The server rejected this sale';
};

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState([]);
  const [syncError, setSyncError] = useState(null);
  const [heldForReview, setHeldForReview] = useState(0);
  const syncing = useRef(false);

  const syncPendingSales = useCallback(async () => {
    const key = storeKey(PENDING_SALES);
    const pending = readPending(key);
    if (syncing.current || pending.length === 0) return 0;

    syncing.current = true;
    const successful = [];
    const rejected = {};
    let held = 0;

    for (const sale of pending) {
      try {
        // Sales queued before these fields existed fall back to their queue id and its timestamp
        const response = await axiosInstance.post('/sales/', {
          ...sale.data,
          client_ref: sale.data.client_ref ?? sale.id,
          sold_at: sale.data.sold_at ?? new Date(Number(sale.id.split('_')[1])).toISOString(),
        });
        successful.push(sale.id);
        if (response.status === 202) held += 1;
      } catch (error) {
        console.error('Failed to sync sale:', error);
        if (!error.response) break; // Connection dropped: the rest wait for the next attempt
        rejected[sale.id] = rejectionReason(error);
      }
    }
    syncing.current = false;

    // Re-read the queue: a sale may have been added while these were sending
    const remaining = readPending(key).filter(sale => !successful.includes(sale.id));
    localStorage.setItem(key, JSON.stringify(remaining));
    if (key === storeKey(PENDING_SALES)) {
      setPendingSales(remaining);
      setSyncError(Object.values(rejected)[0] ?? null);
      setHeldForReview(count => count + held);
    }

    return successful.length;
  }, []);

  // Sends queued sales first so the refreshed product list includes their stock changes
  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine || !localStorage.getItem('authTokens')) return;
    try {
      await syncPendingSales();
      await fetchProducts();
      window.dispatchEvent(new Event('products-refreshed'));
    } catch (error) {
      console.error('Failed to refresh from server:', error);
    }
  }, [syncPendingSales]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshFromServer();
    };
    const handleOffline = () => setIsOnline(false);

    // Load this store's pending sales from localStorage
    const loadPendingSales = () => {
      try {
        adoptLegacySales(PENDING_SALES);
        setPendingSales(readPending(storeKey(PENDING_SALES)));
      } catch (error) {
        console.error('Failed to parse pending sales:', error);
        localStorage.removeItem(storeKey(PENDING_SALES));
      }
    };
    const handleAuthChanged = () => {
      loadPendingSales();
      refreshFromServer();
    };
    handleAuthChanged();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('auth-changed', handleAuthChanged);
    // Also catches a network that dropped without the phone noticing, which fires no online event
    const interval = setInterval(refreshFromServer, REFRESH_INTERVAL);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth-changed', handleAuthChanged);
      clearInterval(interval);
    };
  }, [refreshFromServer]);

  const saveOfflineSale = (saleData) => {
    const offlineSale = {
      id: `offline_${Date.now()}`,
      data: { ...saleData, sold_at: new Date().toISOString() },
      timestamp: new Date().toLocaleString(),
      synced: false
    };

    const key = storeKey(PENDING_SALES);
    const updated = [...readPending(key), offlineSale];
    setPendingSales(updated);
    localStorage.setItem(key, JSON.stringify(updated));

    return offlineSale.id;
  };

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingSales,
      saveOfflineSale,
      syncPendingSales,
      syncError,
      heldForReview,
      clearHeldForReview: () => setHeldForReview(0)
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};
