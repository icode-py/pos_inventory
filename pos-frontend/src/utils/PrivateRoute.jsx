// src/utils/PrivateRoute.jsx
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const PrivateRoute = ({ children, allowedRoles }) => {
  const { authTokens, user } = useContext(AuthContext);

   if (!authTokens || !user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to unauthorized or dashboard if role is not allowed
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default PrivateRoute;
