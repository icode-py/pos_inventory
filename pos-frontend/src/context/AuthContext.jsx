import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() =>
    localStorage.getItem("authTokens")
      ? JSON.parse(localStorage.getItem("authTokens"))
      : null
  );
  const [user, setUser] = useState(() =>
    authTokens ? jwtDecode(authTokens.access) : null
  );

  const loginUser = async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/token/`, {
        username,
        password,
      });

      if (response.status === 200) {
        const tokens = response.data;
        localStorage.setItem("authTokens", JSON.stringify(tokens));
        setAuthTokens(tokens);
        setUser(jwtDecode(tokens.access));
        window.dispatchEvent(new Event('auth-changed'));
        return true;
      }
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  };

  const logoutUser = () => {
    setAuthTokens(null);
    setUser(null);
    localStorage.removeItem("authTokens");
    window.dispatchEvent(new Event('auth-changed'));
  };

  // ⏱ Refresh token every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (authTokens) {
        refreshToken();
      }
    }, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(interval);
  }, [authTokens]);

  const refreshToken = async () => {
    // Read from storage: axiosInstance may have rotated the tokens since this render
    const current = JSON.parse(localStorage.getItem("authTokens"));
    if (!current) return;

    try {
      const response = await axios.post(`${API_URL}/token/refresh/`, {
        refresh: current.refresh,
      });

      if (response.status === 200) {
        const tokens = {
          access: response.data.access,
          refresh: response.data.refresh || current.refresh,
        };
        localStorage.setItem("authTokens", JSON.stringify(tokens));
        setAuthTokens(tokens);
        setUser(jwtDecode(tokens.access));
      } else {
        logoutUser();
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      // No response means no connection, so stay logged in and keep selling offline
      if (err.response) logoutUser();
    }
  };

  const contextData = {
    user,
    authTokens,
    loginUser,
    logoutUser,
  };

  return <AuthContext.Provider value={contextData}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
