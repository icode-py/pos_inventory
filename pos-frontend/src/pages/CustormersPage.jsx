import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Snackbar, Alert, Avatar, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Loyalty as LoyaltyIcon,
  Phone as PhoneIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [newCustomer, setNewCustomer] = useState({
    phone: '', name: '', email: '', notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (search = '') => {
    setLoading(true);
    try {
      const params = {};
      if (search) {
        if (search.match(/^\d/)) {
          params.phone = search;
        } else {
          params.name = search;
        }
      }
      
      const response = await axiosInstance.get('/customers/', { params });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      showSnackbar('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchCustomers(value);
  };

  const handleCreateCustomer = async () => {
    try {
      const response = await axiosInstance.post('/customers/', newCustomer);
      setCustomers(prev => [response.data, ...prev]);
      setOpenDialog(false);
      setNewCustomer({ phone: '', name: '', email: '', notes: '' });
      showSnackbar('Customer created successfully');
    } catch (error) {
      showSnackbar('Failed to create customer', 'error');
    }
  };

  const getLoyaltyTier = (points) => {
    if (points >= 1000) return { label: 'Gold', color: 'warning' };
    if (points >= 500) return { label: 'Silver', color: 'default' };
    return { label: 'Bronze', color: 'secondary' };
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Customer Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your customers and loyalty program
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                {customers.length}
              </Typography>
              <Typography variant="body2">Total Customers</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                {customers.filter(c => c.loyalty_points > 0).length}
              </Typography>
              <Typography variant="body2">Active Members</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                {customers.filter(c => c.total_spent > 10000).length}
              </Typography>
              <Typography variant="body2">VIP Customers</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h3" gutterBottom>
                ₦{customers.reduce((sum, c) => sum + parseFloat(c.total_spent), 0).toLocaleString()}
              </Typography>
              <Typography variant="body2">Total Revenue</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={6} sx={{ textAlign: 'right' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                Add Customer
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Loyalty Points</TableCell>
                  <TableCell align="right">Total Spent</TableCell>
                  <TableCell align="right">Visits</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => {
                  const tier = getLoyaltyTier(customer.loyalty_points);
                  return (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {customer.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {customer.name}
                            </Typography>
                            <Chip label={tier.label} size="small" color={tier.color} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" />
                            {customer.phone}
                          </Typography>
                          {customer.email && (
                            <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon fontSize="small" />
                              {customer.email}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <LoyaltyIcon color="primary" />
                          <Typography variant="body1" fontWeight="bold">
                            {customer.loyalty_points}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body1" fontWeight="bold" color="primary">
                          ₦{parseFloat(customer.total_spent).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body1">
                          {customer.total_visits}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => setSelectedCustomer(customer)}>
                          <ViewIcon />
                        </IconButton>
                        <IconButton color="secondary">
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {customers.length === 0 && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                No customers found. Add your first customer to get started.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateCustomer} 
            variant="contained"
            disabled={!newCustomer.phone || !newCustomer.name}
          >
            Create Customer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} maxWidth="md" fullWidth>
        <DialogTitle>Customer Details</DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Profile Information</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">{selectedCustomer.name}</Typography>
                    <Chip 
                      label={getLoyaltyTier(selectedCustomer.loyalty_points).label} 
                      color={getLoyaltyTier(selectedCustomer.loyalty_points).color}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography><strong>Phone:</strong> {selectedCustomer.phone}</Typography>
                  <Typography><strong>Email:</strong> {selectedCustomer.email || 'Not provided'}</Typography>
                  <Typography><strong>Member Since:</strong> {new Date(selectedCustomer.created_at).toLocaleDateString()}</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Loyalty Statistics</Typography>
                <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>Loyalty Points</Typography>
                    <Typography variant="h5" color="primary">
                      {selectedCustomer.loyalty_points}
                    </Typography>
                  </Box>
                </Card>
                
                <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>Total Spent</Typography>
                    <Typography variant="h5" color="primary">
                      ₦{parseFloat(selectedCustomer.total_spent).toLocaleString()}
                    </Typography>
                  </Box>
                </Card>
                
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>Total Visits</Typography>
                    <Typography variant="h5" color="primary">
                      {selectedCustomer.total_visits}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCustomer(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomersPage;