import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

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
      const response = await axios.post("http://localhost:8000/api/token/", {
        username,
        password,
      });

      if (response.status === 200) {
        const tokens = response.data;
        localStorage.setItem("authTokens", JSON.stringify(tokens));
        setAuthTokens(tokens);
        setUser(jwtDecode(tokens.access));
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
    try {
      const response = await axios.post("http://localhost:8000/api/token/refresh/", {
        refresh: authTokens.refresh,
      });

      if (response.status === 200) {
        const tokens = {
          access: response.data.access,
          refresh: authTokens.refresh,
        };
        localStorage.setItem("authTokens", JSON.stringify(tokens));
        setAuthTokens(tokens);
        setUser(jwtDecode(tokens.access));
      } else {
        logoutUser();
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      logoutUser();
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
