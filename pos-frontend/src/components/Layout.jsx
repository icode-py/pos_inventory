// src/components/Layout.jsx
import { useContext, useState, useEffect } from "react";
import {
  AppBar, Box, Drawer, IconButton, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, Badge, Avatar, Menu, MenuItem, Chip, useTheme, useMediaQuery, Tooltip, Paper
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  LocalGroceryStore as StoreIcon,
  Inventory2 as RestockIcon,
  Assessment as ReportsIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  History as AuditIcon,
  ErrorOutline as CriticalIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  ManageAccounts as ManageAccountsIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useOffline } from "../context/OfflineManager";
import { useColorMode } from "../context/ThemeContext";
import { useStore, TIER_LABELS } from "../context/StoreContext";
import axiosInstance from "../utils/axiosInstance";

const drawerWidth = 280;

const Layout = ({ children }) => {
  const { user, logoutUser } = useContext(AuthContext);
  const { isOnline, pendingSales } = useOffline();
  const { mode, toggleColorMode } = useColorMode();
  const { store, hasFeature } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [todayStats, setTodayStats] = useState({
    sales: 0,
    transactions: 0,
    averageSale: 0
  });
  const [loading, setLoading] = useState(false);

  // Fetch today's performance stats
  const fetchTodayStats = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await axiosInstance.get('/user-today-performance/');
      const data = response.data;
      
      setTodayStats({
        sales: data.total_sales || 0,
        transactions: data.transaction_count || 0,
        averageSale: data.average_sale || 0
      });
    } catch (error) {
      console.error('Failed to fetch today stats:', error);
      // Fallback: try the old endpoint
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await axiosInstance.get(`/sales-report/?start_date=${today}&end_date=${today}`);
        
        const salesData = response.data.sales || [];
        const totalSales = salesData.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);
        const transactionCount = salesData.length;
        const averageSale = transactionCount > 0 ? totalSales / transactionCount : 0;

        setTodayStats({
          sales: totalSales,
          transactions: transactionCount,
          averageSale: averageSale
        });
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStockAlerts = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get('/low-stock-alerts/');
      setLowStockAlerts(res.data.alerts || []);
    } catch {
      // silently ignore
    }
  };

  // Poll for updates every 30 seconds
  useEffect(() => {
    fetchTodayStats();
    const interval = setInterval(fetchTodayStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    fetchLowStockAlerts();
    const interval = setInterval(fetchLowStockAlerts, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Also update stats when route changes (after sales)
  useEffect(() => {
    fetchTodayStats();
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
    handleProfileMenuClose();
  };

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  const allMenuItems = [
    { text: "Dashboard",    icon: <DashboardIcon />,       path: "/dashboard" },
    { text: "POS Terminal", icon: <ShoppingCartIcon />,    path: "/salespage" },
    { text: "Products",     icon: <InventoryIcon />,       path: "/products" },
    { text: "Restock",      icon: <RestockIcon />,         path: "/restock",        restricted: true },
    { text: "Sales Reports",icon: <TrendingUpIcon />,      path: "/reports/sales",  restricted: true },
    { text: "Customers",    icon: <PeopleIcon />,          path: "/customers",      restricted: true, feature: 'customer_loyalty' },
    { text: "Staff",        icon: <ManageAccountsIcon />,  path: "/staff",          restricted: true },
    { text: "Audit Log",    icon: <AuditIcon />,           path: "/audit-log",      restricted: true, feature: 'audit_log' },
    { text: "Settings",     icon: <SettingsIcon />,        path: "/settings" },
  ];
  const menuItems = allMenuItems.filter(item => !item.restricted || isManagerOrAdmin);

  const formatCurrency = (amount) => {
    return `₦${parseFloat(amount || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Spacer so content starts below the fixed AppBar */}
      <Toolbar sx={{ minHeight: '70px !important', flexShrink: 0 }} />

      {/* User Info */}
      <Box sx={{
        p: 2.5,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 52,
            height: 52,
            fontSize: '1.4rem',
            fontWeight: 'bold',
            bgcolor: 'rgba(255,255,255,0.22)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.5)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}>
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              noWrap
              sx={{ color: 'white', lineHeight: 1.3 }}
            >
              {user?.username}
            </Typography>
            <Chip
              label={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
              size="small"
              sx={{
                mt: 0.4,
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 'bold',
                bgcolor: 'rgba(255,255,255,0.18)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.35)',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 1, flexGrow: 1, py: 1, overflow: 'auto' }}>
        {menuItems.map((item) => {
          const locked = item.feature ? !hasFeature(item.feature) : false;
          const isSelected = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip
                title={locked ? `Requires ${TIER_LABELS[item.feature === 'audit_log' ? 'GROWTH' : 'GROWTH']} plan — tap to learn more` : ''}
                placement="right"
                arrow
              >
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setMobileOpen(false);
                  }}
                  selected={isSelected && !locked}
                  sx={{
                    borderRadius: 2,
                    py: 1.2,
                    opacity: locked ? 0.6 : 1,
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                      '& .MuiListItemIcon-root': { color: 'white' },
                      '&:hover': { background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' },
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      transform: 'translateX(4px)',
                      transition: 'all 0.2s ease',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemIcon sx={{
                    color: isSelected && !locked ? 'white' : locked ? 'text.disabled' : 'primary.main',
                    minWidth: 40,
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isSelected && !locked ? 'bold' : 'medium',
                      fontSize: '0.9rem',
                      color: locked ? 'text.disabled' : 'inherit',
                    }}
                  />
                  {locked && <LockIcon sx={{ fontSize: 14, color: 'text.disabled', ml: 0.5 }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* Today's Performance Footer - Real-time Updates */}
      <Box sx={{
        p: 2,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 'medium' }} component="div">
            MY SALES TODAY
          </Typography>
          <IconButton 
            size="small" 
            onClick={fetchTodayStats}
            disabled={loading}
            sx={{ color: 'white', opacity: 0.8 }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }} component="div">
            {loading ? '...' : formatCurrency(todayStats.sales)}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', opacity: 0.8 }}>
            <Box component="span">{todayStats.transactions} sales</Box>
            <Box component="span">Avg: {formatCurrency(todayStats.averageSale)}</Box>
          </Box>
        </Box>
        
        {/* Pending Sync Indicator */}
        {pendingSales.length > 0 && (
          <Box sx={{ 
            mt: 1, 
            p: 0.5, 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: 1,
            textAlign: 'center'
          }}>
            <Typography variant="caption" sx={{ opacity: 0.9 }} component="div">
              ⚡ {pendingSales.length} pending sync
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>

      {/* Top App Bar - Modern Design */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: theme.zIndex.drawer + 1,
          background: mode === 'dark' ? 'rgba(26,29,39,0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          color: 'text.primary',
          boxShadow: '0 2px 20px rgba(0,0,0,0.1)',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar sx={{ minHeight: '70px !important', px: { xs: 2, md: 3 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' }, color: 'primary.main' }}
          >
            <MenuIcon />
          </IconButton>

          {/* Store Logo/Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0, mr: 1 }}>
            <StoreIcon sx={{ color: 'primary.main', mr: 1, fontSize: { xs: 22, md: 28 }, flexShrink: 0 }} />
            <Typography
              variant="h6"
              component="div"
              fontWeight="bold"
              noWrap
              sx={{
                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {store.name}
            </Typography>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2, mr: 3 }}>
            <Chip
              icon={<ShoppingCartIcon />}
              label="New Sale"
              clickable
              color="primary"
              variant="filled"
              onClick={() => navigate('/salespage')}
              sx={{ fontWeight: 'bold', borderRadius: 2 }}
            />
            {isManagerOrAdmin && (
              <Chip
                icon={<RestockIcon />}
                label="Restock"
                clickable
                color="secondary"
                variant="outlined"
                onClick={() => navigate('/restock')}
                sx={{ fontWeight: 'medium', borderRadius: 2 }}
              />
            )}
          </Box>

          {/* Notifications & Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, flexShrink: 0 }}>
            {/* Online Status — hidden on mobile */}
            <Chip
              icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
              label={isOnline ? "Online" : "Offline"}
              size="small"
              color={isOnline ? "success" : "warning"}
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />

            {/* Dark mode toggle — hidden on mobile */}
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={toggleColorMode} sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'flex' } }}>
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Low stock alerts">
              <IconButton
                color="inherit"
                sx={{ color: 'text.secondary' }}
                onClick={(e) => setNotifAnchorEl(e.currentTarget)}
              >
                <Badge badgeContent={lowStockAlerts.length || null} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <IconButton
              onClick={handleProfileMenuOpen}
              sx={{
                color: 'primary.main',
                '&:hover': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  transform: 'scale(1.1)',
                  transition: 'all 0.2s ease'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <AccountCircleIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{ mt: 1, '& .MuiPaper-root': { borderRadius: 2, boxShadow: 4 } }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>My Profile</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Low-Stock Notification Popover */}
      <Menu
        anchorEl={notifAnchorEl}
        open={Boolean(notifAnchorEl)}
        onClose={() => setNotifAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{ mt: 1, '& .MuiPaper-root': { borderRadius: 2, boxShadow: 4, minWidth: 300, maxWidth: 360 } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">Low Stock Alerts</Typography>
          <Chip label={lowStockAlerts.length} color={lowStockAlerts.length > 0 ? 'error' : 'default'} size="small" />
        </Box>
        {lowStockAlerts.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">All products are well-stocked</Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
            {lowStockAlerts.map((alert) => (
              <MenuItem
                key={alert.id}
                onClick={() => { setNotifAnchorEl(null); navigate('/products'); }}
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemIcon>
                  {alert.severity === 'critical'
                    ? <CriticalIcon color="error" />
                    : <WarningIcon color="warning" />}
                </ListItemIcon>
                <ListItemText
                  primary={alert.name}
                  secondary={`Stock: ${alert.stock} units ${alert.category ? `· ${alert.category}` : ''}`}
                  primaryTypographyProps={{ fontWeight: 'medium', variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption', color: alert.severity === 'critical' ? 'error' : 'warning.main' }}
                />
              </MenuItem>
            ))}
          </Box>
        )}
        <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography
            variant="caption"
            color="primary"
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => { setNotifAnchorEl(null); navigate('/products?stock=low'); }}
          >
            View all low stock products →
          </Typography>
        </Box>
      </Menu>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              background: 'background.paper',
              boxShadow: '4px 0 20px rgba(0,0,0,0.1)'
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              background: 'background.paper',
              border: 'none',
              boxShadow: '4px 0 20px rgba(0,0,0,0.08)'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: mode === 'dark' ? '#0f1117' : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}
      >
        <Toolbar sx={{ minHeight: '70px !important' }} />
        <Box sx={{
          bgcolor: 'background.paper',
          borderRadius: { xs: 2, md: 3 },
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          minHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;