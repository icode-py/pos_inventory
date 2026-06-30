import React, { useState, useEffect, useContext } from 'react';
import {
  Grid, Card, CardContent, Typography, Box,
  LinearProgress, Chip, Avatar, List, ListItem,
  ListItemText, ListItemIcon, Divider, Button,
  IconButton, useTheme, Alert, Skeleton, Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  Inventory2 as RestockIcon,
  Assessment as ReportsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosInstance from '../utils/axiosInstance';

// ─── brand gradients ───────────────────────────────────────────────────────────
const G = {
  brand:     'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  sky:       'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
  emerald:   'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  amber:     'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
  rose:      'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
};

// ─── Gradient Stat Card ────────────────────────────────────────────────────────
const StatCard = ({ title, value, subtitle, icon, gradient, trend, onClick, loading }) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      background: gradient,
      color: 'white',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
      overflow: 'hidden',
      border: 'none',
      transition: 'transform 0.22s ease, box-shadow 0.22s ease',
      '&:hover': onClick ? {
        transform: 'translateY(-5px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
      } : {},
    }}
  >
    {/* Decorative blobs */}
    <Box sx={{ position:'absolute', top:-28, right:-28, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />
    <Box sx={{ position:'absolute', bottom:-18, left:-18, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />

    <CardContent sx={{ position:'relative', zIndex:1, p:'20px !important' }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <Box sx={{ flex:1, minWidth:0 }}>
          <Typography sx={{ color:'rgba(255,255,255,0.72)', fontSize:'0.62rem', fontWeight:700, letterSpacing:1.4, textTransform:'uppercase', mb:0.75 }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={120} height={48} sx={{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 }} />
          ) : (
            <Typography variant="h4" fontWeight="bold" sx={{ color:'white', lineHeight:1.15, fontSize:{ xs:'1.5rem', md:'1.9rem' } }}>
              {value}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.68)', mt:0.75, fontSize:'0.8rem' }}>
            {subtitle}
          </Typography>
        </Box>
        <Box sx={{
          bgcolor:'rgba(255,255,255,0.18)',
          borderRadius:2.5,
          p:1.3,
          flexShrink:0,
          ml:1.5,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
        }}>
          {React.cloneElement(icon, { sx:{ fontSize:26, color:'white' } })}
        </Box>
      </Box>

      {trend !== undefined && (
        <Box sx={{ display:'flex', alignItems:'center', gap:1, mt:2 }}>
          <Box sx={{ bgcolor:'rgba(255,255,255,0.18)', borderRadius:10, px:1, py:0.3, display:'flex', alignItems:'center', gap:0.4 }}>
            {trend >= 0
              ? <ArrowUpwardIcon sx={{ fontSize:11, color:'rgba(255,255,255,0.95)' }} />
              : <ArrowDownwardIcon sx={{ fontSize:11, color:'rgba(255,255,255,0.7)' }} />
            }
            <Typography sx={{ fontSize:'0.63rem', fontWeight:700, color:'rgba(255,255,255,0.95)', lineHeight:1 }}>
              {Math.abs(trend)}%
            </Typography>
          </Box>
          <Typography sx={{ fontSize:'0.63rem', color:'rgba(255,255,255,0.58)' }}>
            vs yesterday
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

// ─── Compact Quick-Action card ─────────────────────────────────────────────────
const ActionCard = ({ title, description, icon, gradient, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      cursor:'pointer',
      transition:'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform:'translateY(-3px)', boxShadow:'0 12px 28px rgba(0,0,0,0.13)' },
    }}
  >
    <CardContent sx={{ display:'flex', alignItems:'center', gap:2, p:'14px 16px !important' }}>
      <Box sx={{
        width:46, height:46, borderRadius:2.5,
        background: gradient,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
        boxShadow:'0 4px 14px rgba(0,0,0,0.18)',
      }}>
        {React.cloneElement(icon, { sx:{ fontSize:22, color:'white' } })}
      </Box>
      <Box sx={{ flex:1, minWidth:0 }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ lineHeight:1.3 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display:'block' }}>{description}</Typography>
      </Box>
      <ArrowForwardIcon sx={{ color:'text.disabled', fontSize:17, flexShrink:0 }} />
    </CardContent>
  </Card>
);

// ─── main component ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    lowStockItems: 0,
    totalCustomers: 0,
    recentSales: [],
    topProducts: [],
    inventoryValue: 0,
    pendingOfflineSales: 0,
    criticalStockItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const storeSalesResponse = await axiosInstance.get('/store-today-sales/');
      const storeData = storeSalesResponse.data;

      const [productsResponse, customersResponse, salesResponse] = await Promise.all([
        axiosInstance.get('/products/'),
        axiosInstance.get('/customers/').catch(() => ({ data: [] })),
        axiosInstance.get('/sales/'),
      ]);

      const products = productsResponse.data;
      const customers = customersResponse.data;
      const sales = salesResponse.data;

      const lowStockItems    = products.filter(p => parseInt(p.stock || 0) <= 10).length;
      const criticalStockItems = products.filter(p => parseInt(p.stock || 0) <= 5).length;
      const inventoryValue   = products.reduce((s, p) => s + parseFloat(p.cost_price || 0) * parseInt(p.stock || 0), 0);

      const recentSales = sales.slice(0, 5).map(sale => ({
        id: sale.id,
        amount: parseFloat(sale.total_amount || 0),
        items: sale.items?.length || 0,
        time: formatTimeAgo(sale.created_at),
        customer: sale.customer_name,
        cashier: sale.cashier,
      }));

      const productSales = {};
      sales.forEach(sale => {
        sale.items?.forEach(item => {
          const id   = item.product?.id || item.product_id;
          const name = item.product?.name || 'Unknown';
          if (!productSales[id]) {
            const prod = products.find(p => p.id === id);
            productSales[id] = { name, sales: 0, stock: prod?.stock || 0, isLowStock: parseInt(prod?.stock || 0) <= 10 };
          }
          productSales[id].sales += parseInt(item.quantity || 0);
        });
      });

      const topProducts = Object.values(productSales).sort((a, b) => b.sales - a.sales).slice(0, 5);
      const pendingSales = JSON.parse(localStorage.getItem('holo_pending_sales') || '[]');

      setStats({
        todaySales: storeData.total_sales || 0,
        totalProducts: products.length,
        lowStockItems,
        criticalStockItems,
        totalCustomers: customers.length,
        recentSales,
        topProducts,
        inventoryValue,
        pendingOfflineSales: pendingSales.length,
      });
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      setError('Failed to load dashboard data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const diffMs   = Date.now() - new Date(dateString);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs  = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs  < 24) return `${diffHrs}h ago`;
    return `${diffDays}d ago`;
  };

  const formatCurrency = (amount) =>
    `₦${parseFloat(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>

      {/* ── Page header ───────────────────────────────────── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography
            variant="h5"
            fontWeight="bold"
            sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, letterSpacing: '-0.4px', lineHeight: 1.2 }}
          >
            {getGreeting()}, {user?.username} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
            {formattedDate}
          </Typography>
        </Box>
        <Tooltip title="Refresh dashboard">
          <IconButton onClick={fetchDashboardData} size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* ── Stat Cards ────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            title="Store Sales Today"
            value={loading ? '—' : formatCurrency(stats.todaySales)}
            subtitle={`${stats.recentSales.length} transactions`}
            icon={<AttachMoneyIcon />}
            gradient={G.brand}
            trend={12.5}
            loading={loading}
            onClick={() => navigate('/reports/sales')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            title="Total Products"
            value={loading ? '—' : stats.totalProducts.toLocaleString()}
            subtitle={stats.lowStockItems > 0 ? `${stats.lowStockItems} need restocking` : 'All well-stocked'}
            icon={<InventoryIcon />}
            gradient={G.sky}
            trend={2.1}
            loading={loading}
            onClick={() => navigate('/products')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            title="Inventory Value"
            value={loading ? '—' : formatCurrency(stats.inventoryValue)}
            subtitle="Total cost value on hand"
            icon={<TrendingUpIcon />}
            gradient={G.emerald}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            title="Total Customers"
            value={loading ? '—' : stats.totalCustomers.toLocaleString()}
            subtitle="Registered loyalty members"
            icon={<PeopleIcon />}
            gradient={G.amber}
            trend={5.2}
            loading={loading}
            onClick={() => navigate('/customers')}
          />
        </Grid>
      </Grid>

      {/* ── Alerts ────────────────────────────────────────── */}
      {(stats.lowStockItems > 0 || stats.pendingOfflineSales > 0) && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={1.5}>
            {stats.lowStockItems > 0 && (
              <Grid size={{ xs: 12, md: stats.criticalStockItems > 0 ? 6 : 12 }}>
                <Alert
                  severity={stats.criticalStockItems > 0 ? 'warning' : 'info'}
                  sx={{ borderRadius: 2 }}
                  action={<Button color="inherit" size="small" onClick={() => navigate('/products')}>View</Button>}
                >
                  {stats.lowStockItems} product{stats.lowStockItems > 1 ? 's' : ''} running low
                  {stats.criticalStockItems > 0 && ` · ${stats.criticalStockItems} critical`}
                </Alert>
              </Grid>
            )}
            {stats.criticalStockItems > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Alert
                  severity="error"
                  sx={{ borderRadius: 2 }}
                  action={<Button color="inherit" size="small" onClick={() => navigate('/restock')}>Restock</Button>}
                >
                  {stats.criticalStockItems} product{stats.criticalStockItems > 1 ? 's' : ''} critically out of stock
                </Alert>
              </Grid>
            )}
            {stats.pendingOfflineSales > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Alert
                  severity="info"
                  sx={{ borderRadius: 2 }}
                  action={<Button color="inherit" size="small" onClick={() => navigate('/salespage')}>Sync</Button>}
                >
                  {stats.pendingOfflineSales} offline sale{stats.pendingOfflineSales > 1 ? 's' : ''} pending sync
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* ── Quick Actions + Activity ───────────────────────── */}
      <Grid container spacing={2.5}>

        {/* Quick Actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.78rem', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <ActionCard
              title="New Sale"
              description="Start a POS transaction"
              icon={<ShoppingCartIcon />}
              gradient={G.brand}
              onClick={() => navigate('/salespage')}
            />
            <ActionCard
              title="Manage Products"
              description="Add, edit, or adjust inventory"
              icon={<InventoryIcon />}
              gradient={G.sky}
              onClick={() => navigate('/products')}
            />
            {isManagerOrAdmin && (
              <ActionCard
                title="Restock Items"
                description="Top up low-stock products"
                icon={<RestockIcon />}
                gradient={G.amber}
                onClick={() => navigate('/restock')}
              />
            )}
            {isManagerOrAdmin && (
              <ActionCard
                title="Sales Reports"
                description="Analyse store performance"
                icon={<ReportsIcon />}
                gradient={G.emerald}
                onClick={() => navigate('/reports/sales')}
              />
            )}
          </Box>
        </Grid>

        {/* Recent Sales */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Recent Sales</Typography>
                <Button size="small" onClick={() => navigate('/reports/sales')} sx={{ fontSize: '0.75rem' }}>
                  View all
                </Button>
              </Box>

              {loading ? (
                [1,2,3].map(i => (
                  <Box key={i} sx={{ display:'flex', gap:1.5, mb:2, alignItems:'center' }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box sx={{ flex:1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                  </Box>
                ))
              ) : stats.recentSales.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <ReceiptIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No sales yet today</Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {stats.recentSales.map((sale, i) => (
                    <React.Fragment key={sale.id}>
                      <ListItem disableGutters sx={{ py: 1 }}>
                        <ListItemIcon sx={{ minWidth: 44 }}>
                          <Avatar sx={{ width: 36, height: 36, background: G.brand }}>
                            <ShoppingCartIcon sx={{ fontSize: 16 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(sale.amount)}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {sale.items} item{sale.items !== 1 ? 's' : ''} · {sale.time}
                              {sale.customer ? ` · ${sale.customer}` : ''}
                            </Typography>
                          }
                        />
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                          label="Done"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 22, fontSize: '0.68rem' }}
                        />
                      </ListItem>
                      {i < stats.recentSales.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Top Products</Typography>
                <Button size="small" onClick={() => navigate('/products')} sx={{ fontSize: '0.75rem' }}>
                  View all
                </Button>
              </Box>

              {loading ? (
                [1,2,3,4].map(i => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mt: 0.5 }} />
                  </Box>
                ))
              ) : stats.topProducts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <TrendingUpIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No sales data available</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stats.topProducts.map((product, i) => {
                    const pct = Math.min((product.sales / (stats.topProducts[0]?.sales || 1)) * 100, 100);
                    const stockColor = product.stock < 5 ? 'error' : product.stock < 10 ? 'warning' : 'success';
                    return (
                      <Box key={product.name}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              noWrap
                              sx={{ color: product.isLowStock ? 'warning.main' : 'text.primary' }}
                            >
                              {i + 1}. {product.name}
                            </Typography>
                            {product.isLowStock && <WarningIcon color="warning" sx={{ fontSize: 13, flexShrink: 0 }} />}
                          </Box>
                          <Chip
                            label={`${product.sales} sold`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem', ml: 1, flexShrink: 0 }}
                          />
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={stockColor}
                          sx={{ height: 5, borderRadius: 3 }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
