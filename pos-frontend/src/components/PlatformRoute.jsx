// src/components/PlatformRoute.jsx
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Only the platform owner's account. The API checks this too; this just keeps others off the page.
const PlatformRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user?.is_platform ? children : <Navigate to="/dashboard" replace />;
};

export default PlatformRoute;
