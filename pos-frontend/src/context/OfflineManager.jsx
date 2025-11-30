import React, { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Load pending sales from localStorage
    const savedSales = localStorage.getItem('holo_pending_sales');
    if (savedSales) {
      try {
        setPendingSales(JSON.parse(savedSales));
      } catch (error) {
        console.error('Failed to parse pending sales:', error);
        localStorage.removeItem('holo_pending_sales');
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    localStorage.setItem('holo_pending_sales', JSON.stringify(updated));
    
    return offlineSale.id;
  };

  const syncPendingSales = async () => {
    const pending = JSON.parse(localStorage.getItem('holo_pending_sales') || '[]');
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
    localStorage.setItem('holo_pending_sales', JSON.stringify(remaining));
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