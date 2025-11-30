// src/components/Layout.jsx
import { useContext, useState, useEffect } from "react";
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, Badge, Avatar, Menu, MenuItem, Chip, useTheme, useMediaQuery
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
  Refresh as RefreshIcon
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useOffline } from "../context/OfflineManager";
import axiosInstance from "../utils/axiosInstance";

const drawerWidth = 280;

const Layout = ({ children }) => {
  const { user, logoutUser } = useContext(AuthContext);
  const { isOnline, pendingSales } = useOffline();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
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

  // Poll for updates every 30 seconds
  useEffect(() => {
    fetchTodayStats();
    const interval = setInterval(fetchTodayStats, 30000); // Update every 30 seconds
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

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
    { text: "POS Terminal", icon: <ShoppingCartIcon />, path: "/salespage" },
    { text: "Products", icon: <InventoryIcon />, path: "/products" },
    { text: "Restock", icon: <RestockIcon />, path: "/restock" },
    { text: "Sales Reports", icon: <TrendingUpIcon />, path: "/reports/sales" },
    { text: "Customers", icon: <PeopleIcon />, path: "/customers" },
    { text: "Settings", icon: <SettingsIcon />, path: "/settings" },
  ];

  const formatCurrency = (amount) => {
    return `₦${parseFloat(amount || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const drawer = (
    <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Store Header - Modern Design */}
      <Box sx={{ 
        p: 3, 
        textAlign: 'center', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern */}
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />
        
        <StoreIcon sx={{ fontSize: 40, mb: 1, position: 'relative', zIndex: 1 }} />
        <Typography variant="h6" fontWeight="bold" sx={{ position: 'relative', zIndex: 1 }}>
          HOLO SUPERMARKET
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9, position: 'relative', zIndex: 1 }}>
          Modern Point of Sale
        </Typography>
        
        {/* Online Status */}
        <Chip
          icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
          label={isOnline ? "Online" : "Offline"}
          size="small"
          color={isOnline ? "success" : "warning"}
          variant="filled"
          sx={{ 
            mt: 1, 
            background: isOnline ? 'rgba(76,175,80,0.9)' : 'rgba(255,152,0,0.9)',
            color: 'white',
            position: 'relative',
            zIndex: 1
          }}
        />
      </Box>

      <Divider />

      {/* User Info - Modern Card */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ 
            bgcolor: 'primary.main', 
            width: 48, 
            height: 48,
            border: '3px solid white',
            boxShadow: 1
          }}>
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight="medium" noWrap component="div">
              {user?.username}
            </Typography>
            <Chip 
              label={user?.role?.toUpperCase()} 
              size="small" 
              color={
                user?.role === 'admin' ? 'error' : 
                user?.role === 'manager' ? 'warning' : 'primary'
              }
              sx={{ 
                height: 20, 
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 1, flexGrow: 1, py: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                py: 1.2,
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                  },
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
                color: location.pathname === item.path ? 'white' : 'primary.main',
                minWidth: 40 
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 'bold' : 'medium',
                  fontSize: '0.9rem'
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Today's Performance Footer - Real-time Updates */}
      <Box sx={{ 
        p: 2, 
        background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
        color: 'white',
        borderTop: '1px solid rgba(255,255,255,0.1)'
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
      <CssBaseline />

      {/* Top App Bar - Modern Design */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: theme.zIndex.drawer + 1,
          background: 'rgba(255, 255, 255, 0.95)',
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
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <StoreIcon sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
            <Typography variant="h5" component="div" fontWeight="bold" sx={{ 
              color: 'primary.main',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              HOLO POS
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
            <Chip 
              icon={<InventoryIcon />} 
              label="Low Stock" 
              clickable
              color="warning"
              variant="outlined"
              sx={{ fontWeight: 'medium', borderRadius: 2 }}
            />
          </Box>

          {/* Notifications & Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Online Status */}
            <Chip
              icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
              label={isOnline ? "Online" : "Offline"}
              size="small"
              color={isOnline ? "success" : "warning"}
              variant="outlined"
            />
            
            <IconButton color="inherit" sx={{ color: 'text.secondary' }}>
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}
      >
        <Toolbar sx={{ minHeight: '70px !important' }} />
        <Box sx={{ 
          background: 'white', 
          borderRadius: 3, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          minHeight: 'calc(100vh - 100px)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;