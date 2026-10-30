import axiosInstance from './axiosInstance';
import { storeKey } from './storeKey';

const CACHED_PRODUCTS = 'holo_cached_products';

/** The last product list this device saw. It never expires: an old list beats an empty till. */
export const readCachedProducts = () => {
  try {
    return JSON.parse(localStorage.getItem(storeKey(CACHED_PRODUCTS)));
  } catch {
    return null;
  }
};

const writeCachedProducts = (key, products) => {
  try {
    localStorage.setItem(key, JSON.stringify(products));
  } catch (error) {
    console.error('Failed to cache products:', error);
  }
};

export const fetchProducts = async () => {
  const key = storeKey(CACHED_PRODUCTS);
  const { data } = await axiosInstance.get('products/');
  writeCachedProducts(key, data);
  return data;
};

export const clearCachedProducts = () => localStorage.removeItem(storeKey(CACHED_PRODUCTS));

/** Stock left after a cart is sold. The server only learns about offline sales later. */
export const deductStock = (products, cart) => products.map((product) => {
  const sold = cart.find((item) => item.product.id === product.id);
  return sold ? { ...product, stock: Math.max(0, product.stock - sold.quantity) } : product;
});

export const deductCachedStock = (cart) => {
  const cached = readCachedProducts();
  if (cached) writeCachedProducts(storeKey(CACHED_PRODUCTS), deductStock(cached, cart));
};
