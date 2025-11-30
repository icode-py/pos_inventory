// src/components/RoleProtectedRoute.jsx
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Layout from './Layout';
import { 
  Box, 
  Typography, 
  Container, 
  Paper, 
  Alert 
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(AuthContext);
  
  // Check if user has the required role
  const hasRequiredRole = user && allowedRoles.includes(user.role);
  
  if (!hasRequiredRole) {
    return (
    <Layout>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Alert 
            severity="warning" 
            icon={<WarningIcon fontSize="large" />}
            sx={{ mb: 3 }}
          >
            <Typography variant="h6" gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body2">
              You don't have permission to access this page. 
              Required roles: {allowedRoles.join(', ')}
            </Typography>
          </Alert>
          <Typography variant="body1" color="text.secondary">
            Your current role: <strong>{user?.role || 'None'}</strong>
          </Typography>
        </Paper>
      </Container>
      </Layout>
    );
  }
  
  return children;
};

export default RoleProtectedRoute;