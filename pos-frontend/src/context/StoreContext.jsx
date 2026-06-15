import { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [store, setStore] = useState({
    name: 'My Store',
    tagline: 'Modern Point of Sale',
    phone: '',
    address: '',
    email: '',
    receipt_footer: 'Thank you for your business!',
  });

  useEffect(() => {
    axiosInstance.get('/store-settings/')
      .then(res => setStore(res.data))
      .catch(() => {});
  }, []);

  return (
    <StoreContext.Provider value={{ store, setStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
