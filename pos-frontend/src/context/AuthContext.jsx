import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() => {
    try {
      const tokens = JSON.parse(localStorage.getItem("authTokens"));
      // Once the refresh token has expired the server will refuse every request, so start at the login page
      if (tokens && jwtDecode(tokens.refresh).exp * 1000 > Date.now()) return tokens;
    } catch {
      // unreadable tokens: treat as logged out
    }
    localStorage.removeItem("authTokens");
    return null;
  });
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
        const loggedIn = jwtDecode(tokens.access);
        setAuthTokens(tokens);
        setUser(loggedIn);
        window.dispatchEvent(new Event('auth-changed'));
        return loggedIn;
      }
    } catch (err) {
      console.error("Login failed:", err);
      const detail = err.response?.data?.detail;
      // The server says when an account is locked after too many wrong passwords
      if (err.response?.status === 429) return { error: "Too many login attempts from this device. Wait a minute and try again." };
      return { error: /too many/i.test(detail || "") ? detail : null };
    }
  };

  const logoutUser = () => {
    // End the session on the server too, so the saved login can't be reused from this device
    try {
      const saved = JSON.parse(localStorage.getItem("authTokens"));
      if (saved?.refresh && navigator.onLine) axios.post(`${API_URL}/logout/`, { refresh: saved.refresh }).catch(() => {});
    } catch {
      // unreadable tokens: nothing to end
    }
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

  // After a password change the server ends old sessions and hands this device new tokens
  const replaceTokens = (tokens) => {
    localStorage.setItem("authTokens", JSON.stringify(tokens));
    setAuthTokens(tokens);
    setUser(jwtDecode(tokens.access));
  };

  const contextData = {
    user,
    authTokens,
    loginUser,
    logoutUser,
    replaceTokens,
  };

  return <AuthContext.Provider value={contextData}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
