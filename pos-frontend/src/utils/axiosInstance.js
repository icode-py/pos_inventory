// axiosInstance.js - Uses environment variable for API URL

import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || '/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor to add JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const tokens = localStorage.getItem("authTokens");
      if (tokens) {
        const { access } = JSON.parse(tokens);
        config.headers.Authorization = `Bearer ${access}`;
      }
    } catch (error) {
      console.error('Error parsing tokens:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only retry once to avoid infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokens = localStorage.getItem('authTokens');
        if (!tokens) {
          throw new Error('No tokens found');
        }
        
        const parsedTokens = JSON.parse(tokens);
        
        const response = await axios.post(
          `${API_URL}/token/refresh/`,
          { refresh: parsedTokens.refresh }
        );

        // Save both tokens — ROTATE_REFRESH_TOKENS=True issues a new refresh each time
        parsedTokens.access = response.data.access;
        if (response.data.refresh) parsedTokens.refresh = response.data.refresh;
        localStorage.setItem('authTokens', JSON.stringify(parsedTokens));
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
        return axiosInstance(originalRequest);
        
      } catch (refreshError) {
        // Clear tokens and redirect to login if refresh fails
        localStorage.removeItem('authTokens');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;