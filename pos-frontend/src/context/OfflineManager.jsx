import React, { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { storeKey, adoptLegacySales } from '../utils/storeKey';

const PENDING_SALES = 'holo_pending_sales';

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Load this store's pending sales from localStorage
    const loadPendingSales = () => {
      try {
        adoptLegacySales(PENDING_SALES);
        setPendingSales(JSON.parse(localStorage.getItem(storeKey(PENDING_SALES)) || '[]'));
      } catch (error) {
        console.error('Failed to parse pending sales:', error);
        localStorage.removeItem(storeKey(PENDING_SALES));
      }
    };
    loadPendingSales();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('auth-changed', loadPendingSales);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth-changed', loadPendingSales);
    };
  }, []);

  const saveOfflineSale = (saleData) => {
    const offlineSale = {
      id: `offline_${Date.now()}`,
      data: saleData,
      timestamp: new Date().toLocaleString(),
      synced: false
    };
    
    const updated = [...pendingSales, offlineSale];
    setPendingSales(updated);
    localStorage.setItem(storeKey(PENDING_SALES), JSON.stringify(updated));
    
    return offlineSale.id;
  };

  const syncPendingSales = async () => {
    const pending = JSON.parse(localStorage.getItem(storeKey(PENDING_SALES)) || '[]');
    if (pending.length === 0) return 0;

    const successful = [];
    
    for (const sale of pending) {
      try {
        await axiosInstance.post('/sales/', sale.data);
        successful.push(sale.id);
      } catch (error) {
        console.error('Failed to sync sale:', error);
      }
    }

    // Remove synced sales
    const remaining = pending.filter(sale => !successful.includes(sale.id));
    localStorage.setItem(storeKey(PENDING_SALES), JSON.stringify(remaining));
    setPendingSales(remaining);

    return successful.length;
  };

  return (
    <OfflineContext.Provider value={{ 
      isOnline, 
      pendingSales, 
      saveOfflineSale,
      syncPendingSales
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