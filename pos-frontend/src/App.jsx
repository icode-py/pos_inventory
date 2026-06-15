import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppThemeProvider } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import AuthProvider from './context/AuthContext';
import { OfflineProvider } from './context/OfflineManager';
import SyncManager from './components/SyncManager';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/Products';
import RestockPage from './pages/RestockPage';
import SalesReport from './pages/SalesReport';
import CustomersPage from './pages/CustormersPage';
import CustomerProfile from './pages/CustomerProfile';
import BulkDiscountManager from './components/BulkDiscountManager';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import StaffPage from './pages/StaffPage';

function App() {
  return (
    <AppThemeProvider>
    <StoreProvider>
    <OfflineProvider>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes with Layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            } />
            
            {/* Dashboard - Accessible to all authenticated users */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Sales Page - Accessible to Cashier, Manager, and Admin */}
            <Route path="/salespage" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['cashier', 'manager', 'admin']}>
                  <Layout>
                    <SalesPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Products - Accessible to Manager, Admin and cashier */}
            <Route path="/products" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin','cashier']}>
                  <Layout>
                    <ProductsPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Restock - Manager and Admin only (prevents cashier stock fraud) */}
            <Route path="/restock" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <RestockPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Sales Reports - Accessible to Manager and Admin */}
            <Route path="/reports/sales" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <SalesReport />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            {/* Customers - Accessible to Manager and Admin */}
            <Route path="/customers" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <CustomersPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            {/* Customer Profile - Accessible to Manager and Admin */}
            <Route path="/customers/:id" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <CustomerProfile />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            <Route
                path="/bulk-discounts"
                element={
                  <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                    <Layout>
                      <BulkDiscountManager />
                    </Layout>
                  </RoleProtectedRoute>
                }
            />

            <Route path="/audit-log" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <AuditLogPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            <Route path="/staff" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <StaffPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['manager', 'admin']}>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />

            {/* Redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
        <SyncManager />
      </Router>
    </OfflineProvider>
    </StoreProvider>
    </AppThemeProvider>
  );
}

export default App;