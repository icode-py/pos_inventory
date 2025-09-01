import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProductsPage from "./pages/Products";
import SalesReports from "./pages/SalesReport.jsx";
import SalesPage from './pages/SalesPage';
import AuthProvider from "./context/AuthContext";
import PrivateRoute from "./utils/PrivateRoute";
import Layout from './components/Layout.jsx';
import RestockPage from './pages/RestockPage.jsx';
import Unauthorized from './pages/Unauthorized.jsx';

function App() {
  return (
    <BrowserRouter>
    <AuthProvider>
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />
      {/* Protected routes */}
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/reports/sales" element={<PrivateRoute allowedRoles={["manager", "admin"]}><Layout><SalesReports /></Layout></PrivateRoute>} />
      <Route path="/salespage" element={<PrivateRoute allowedRoles={["cashier","manager"]}><Layout><SalesPage /></Layout></PrivateRoute>} />
      <Route path="/restock" element={<PrivateRoute allowedRoles={["manager", "admin"]}><Layout><RestockPage /></Layout></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute allowedRoles={["manager", "admin"]}><Layout><ProductsPage /></Layout></PrivateRoute>} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
    </AuthProvider>
  </BrowserRouter>
  )
}

export default App
