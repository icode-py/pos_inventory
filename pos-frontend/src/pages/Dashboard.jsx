// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box,
  LinearProgress, Chip, Avatar, List, ListItem,
  ListItemText, ListItemIcon, Divider, Button,
  Paper, useTheme, Alert
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

const Dashboard = () => {
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    lowStockItems: 0,
    totalCustomers: 0,
    recentSales: [],
    topProducts: [],
    inventoryValue: 0,
    pendingOfflineSales: 0,
    criticalStockItems: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch STORE TOTAL sales for today (for dashboard card)
      const storeSalesResponse = await axiosInstance.get('/store-today-sales/');
      const storeData = storeSalesResponse.data;

      // Fetch all data in parallel
      const [
        productsResponse,
        customersResponse,
        salesResponse
      ] = await Promise.all([
        axiosInstance.get('/products/'),
        axiosInstance.get('/customers/'),
        axiosInstance.get('/sales/')
      ]);

      const products = productsResponse.data;
      const customers = customersResponse.data;
      const sales = salesResponse.data;

      // Calculate low stock items (stock <= 10)
      const lowStockItems = products.filter(product => 
        parseInt(product.stock || 0) <= 10
      ).length;

      // Calculate critical stock items (stock <= 5)
      const criticalStockItems = products.filter(product => 
        parseInt(product.stock || 0) <= 5
      ).length;

      // Calculate today's sales
      const todaySales = storeData.total_sales || 0;

      // Calculate inventory value
      const inventoryValue = products.reduce((sum, product) => 
        sum + (parseFloat(product.cost_price || 0) * parseInt(product.stock || 0)), 0
      );

      // Get recent sales (last 5)
      const recentSales = sales
        .slice(0, 5)
        .map(sale => ({
          id: sale.id,
          amount: parseFloat(sale.total_amount || 0),
          items: sale.items?.length || 0,
          time: formatTimeAgo(sale.created_at),
          customer: sale.customer_name,
          cashier: sale.cashier
        }));

      // Calculate top products (by quantity sold)
      const productSales = {};
      sales.forEach(sale => {
        sale.items?.forEach(item => {
          const productId = item.product?.id || item.product_id;
          const productName = item.product?.name || 'Unknown Product';
          const quantity = parseInt(item.quantity || 0);
          
          if (!productSales[productId]) {
            const product = products.find(p => p.id === productId);
            productSales[productId] = {
              name: productName,
              sales: 0,
              stock: product?.stock || 0,
              isLowStock: parseInt(product?.stock || 0) <= 10
            };
          }
          productSales[productId].sales += quantity;
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      // Get pending offline sales
      const pendingSales = JSON.parse(localStorage.getItem('holo_pending_sales') || '[]');

      setStats({
        todaySales,
        totalProducts: products.length,
        lowStockItems,
        criticalStockItems,
        totalCustomers: customers.length,
        recentSales,
        topProducts,
        inventoryValue,
        pendingOfflineSales: pendingSales.length
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatCurrency = (amount) => {
    return `₦${parseFloat(amount || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const StatCard = ({ title, value, subtitle, icon, color, trend, onClick }) => (
    <Card 
      sx={{ 
        height: '100%', 
        transition: 'all 0.3s', 
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': { 
          transform: onClick ? 'translateY(-4px)' : 'none', 
          boxShadow: onClick ? 4 : 1 
        } 
      }} 
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography color="textSecondary" gutterBottom variant="overline" sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color }}>
              {typeof value === 'number' && title.includes('₦') ? formatCurrency(value) : 
               typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: `${color}20`, color: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {trend > 0 ? <ArrowUpwardIcon color="success" sx={{ fontSize: 16 }} /> : <ArrowDownwardIcon color="error" sx={{ fontSize: 16 }} />}
            <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'}>
              {Math.abs(trend)}% from yesterday
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const QuickActionCard = ({ title, description, icon, color, onClick, buttonText }) => (
    <Card sx={{ 
      bgcolor: `${color}10`, 
      border: `1px solid ${color}30`, 
      cursor: 'pointer', 
      transition: 'all 0.3s', 
      '&:hover': { bgcolor: `${color}15`, transform: 'translateY(-2px)' } 
    }} 
    onClick={onClick}
    >
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Avatar sx={{ bgcolor: color, width: 56, height: 56, mx: 'auto', mb: 2 }}>
          {icon}
        </Avatar>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          {title}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Button 
          variant="contained" 
          sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Loading dashboard...</Typography>
        <LinearProgress sx={{ width: '200px' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Dashboard Overview
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Welcome back! Here's what's happening with your store today.
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="STORE SALES TODAY"
            value={stats.todaySales}
            subtitle={`${stats.recentSales.length} transactions today`}
            icon={<AttachMoneyIcon />}
            color={theme.palette.primary.main}
            trend={12.5}
            onClick={() => navigate('/reports/sales')}
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="TOTAL PRODUCTS"
            value={stats.totalProducts}
            subtitle={`${stats.lowStockItems} need restocking`}
            icon={<InventoryIcon />}
            color={theme.palette.info.main}
            trend={2.1}
            onClick={() => navigate('/products')}
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="INVENTORY VALUE"
            value={stats.inventoryValue}
            subtitle="Total cost value"
            icon={<TrendingUpIcon />}
            color={theme.palette.success.main}
            trend={8.7}
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="TOTAL CUSTOMERS"
            value={stats.totalCustomers}
            subtitle="Registered customers"
            icon={<PeopleIcon />}
            color={theme.palette.warning.main}
            trend={5.2}
            onClick={() => navigate('/customers')}
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Quick Actions
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <QuickActionCard
            title="New Sale"
            description="Start a new point of sale transaction"
            icon={<ShoppingCartIcon />}
            color={theme.palette.primary.main}
            onClick={() => navigate('/salespage')}
            buttonText="Start Sale"
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <QuickActionCard
            title="Manage Products"
            description="Add or edit products in inventory"
            icon={<InventoryIcon />}
            color={theme.palette.info.main}
            onClick={() => navigate('/products')}
            buttonText="View Products"
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <QuickActionCard
            title="Restock Items"
            description="Add stock to low inventory items"
            icon={<TrendingUpIcon />}
            color={theme.palette.warning.main}
            onClick={() => navigate('/restock')}
            buttonText="Restock Now"
          />
        </Grid>
        <Grid item size={{ xs: 12, sm: 6, md: 3 }}>
          <QuickActionCard
            title="View Reports"
            description="Analyze sales and performance"
            icon={<ReceiptIcon />}
            color={theme.palette.success.main}
            onClick={() => navigate('/reports/sales')}
            buttonText="See Reports"
          />
        </Grid>
      </Grid>

      {/* Alerts Section */}
      {(stats.lowStockItems > 0 || stats.pendingOfflineSales > 0) && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
            Alerts & Notifications
          </Typography>
          <Grid container spacing={2}>
            {stats.lowStockItems > 0 && (
              <Grid item size={{ xs: 12, md: stats.criticalStockItems > 0 ? 6 : 12 }}>
                <Alert 
                  severity={stats.criticalStockItems > 0 ? "warning" : "info"}
                  action={
                    <Button color="inherit" size="small" onClick={() => navigate('/products')}>
                      View
                    </Button>
                  }
                >
                  {stats.lowStockItems} product{stats.lowStockItems > 1 ? 's' : ''} running low on stock
                  {stats.criticalStockItems > 0 && ` (${stats.criticalStockItems} critical)`}
                </Alert>
              </Grid>
            )}
            {stats.criticalStockItems > 0 && (
              <Grid item size={{ xs: 12, md: 6 }}>
                <Alert 
                  severity="error"
                  action={
                    <Button color="inherit" size="small" onClick={() => navigate('/restock')}>
                      Restock
                    </Button>
                  }
                >
                  {stats.criticalStockItems} product{stats.criticalStockItems > 1 ? 's' : ''} critically low on stock
                </Alert>
              </Grid>
            )}
            {stats.pendingOfflineSales > 0 && (
              <Grid item size={{ xs: 12, md: 6 }}>
                <Alert 
                  severity="info"
                  action={
                    <Button color="inherit" size="small" onClick={() => navigate('/salespage')}>
                      Sync
                    </Button>
                  }
                >
                  {stats.pendingOfflineSales} offline sale{stats.pendingOfflineSales > 1 ? 's' : ''} pending sync
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Recent Activity & Top Products */}
      <Grid container spacing={3}>
        {/* Recent Sales */}
        <Grid item size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon color="primary" />
                  Recent Sales
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/reports/sales')}
                  sx={{ textTransform: 'none' }}
                >
                  View All
                </Button>
              </Box>
              {stats.recentSales.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="textSecondary">
                    No sales today
                  </Typography>
                </Box>
              ) : (
                <List>
                  {stats.recentSales.map((sale, index) => (
                    <React.Fragment key={sale.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32 }}>
                            <ShoppingCartIcon sx={{ fontSize: 16 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={formatCurrency(sale.amount)}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                {sale.items} items • {sale.time}
                              </Typography>
                              {sale.customer && (
                                <Typography variant="caption" color="textSecondary">
                                  Customer: {sale.customer}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip label="Completed" size="small" color="success" variant="outlined" />
                      </ListItem>
                      {index < stats.recentSales.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products */}
        <Grid item size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon color="primary" />
                  Top Selling Products
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/products')}
                  sx={{ textTransform: 'none' }}
                >
                  View All
                </Button>
              </Box>
              {stats.topProducts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="textSecondary">
                    No sales data available
                  </Typography>
                </Box>
              ) : (
                <List>
                  {stats.topProducts.map((product, index) => (
                    <React.Fragment key={product.name}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" fontWeight="medium">
                                {product.name}
                              </Typography>
                              {product.isLowStock && (
                                <WarningIcon color="warning" sx={{ fontSize: 16 }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                              <Typography variant="body2" color="textSecondary">
                                {product.sales} sales
                              </Typography>
                              <Box sx={{ flexGrow: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={Math.min((product.sales / (stats.topProducts[0]?.sales || 1)) * 100, 100)} 
                                  sx={{ height: 6, borderRadius: 3 }}
                                  color={product.stock < 5 ? 'error' : product.stock < 10 ? 'warning' : 'primary'}
                                />
                              </Box>
                              <Chip 
                                label={`Stock: ${product.stock}`} 
                                size="small" 
                                color={product.stock < 5 ? 'error' : product.stock < 10 ? 'warning' : 'success'}
                                variant="outlined"
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < stats.topProducts.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;