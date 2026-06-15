import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Snackbar, Alert, Avatar, Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Loyalty as LoyaltyIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const EMPTY_FORM = { phone: '', name: '', email: '', notes: '' };

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // View dialog
  const [viewCustomer, setViewCustomer] = useState(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_FORM);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async (search = '') => {
    setLoading(true);
    try {
      const params = {};
      if (search) {
        if (search.match(/^\d/)) params.phone = search;
        else params.name = search;
      }
      const response = await axiosInstance.get('/customers/', { params });
      setCustomers(response.data);
    } catch {
      showSnackbar('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const extractError = (error) => {
    const data = error.response?.data;
    if (!data) return 'Something went wrong';
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`)
      .join(' | ');
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchCustomers(value);
  };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreateCustomer = async () => {
    try {
      const payload = {
        ...newCustomer,
        email: newCustomer.email || undefined,
        notes: newCustomer.notes || undefined,
      };
      const response = await axiosInstance.post('/customers/', payload);
      setCustomers(prev => [response.data, ...prev]);
      setAddOpen(false);
      setNewCustomer(EMPTY_FORM);
      showSnackbar('Customer created successfully');
    } catch (error) {
      showSnackbar(extractError(error), 'error');
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEditDialog = (customer) => {
    setEditingId(customer.id);
    setEditForm({
      phone: customer.phone || '',
      name: customer.name || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setEditOpen(true);
  };

  const handleUpdateCustomer = async () => {
    try {
      const payload = {
        ...editForm,
        email: editForm.email || undefined,
        notes: editForm.notes || undefined,
      };
      const response = await axiosInstance.patch(`/customers/${editingId}/`, payload);
      setCustomers(prev => prev.map(c => c.id === editingId ? response.data : c));
      setEditOpen(false);
      showSnackbar('Customer updated successfully');
    } catch (error) {
      showSnackbar(extractError(error), 'error');
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const openDeleteDialog = (customer) => {
    setCustomerToDelete(customer);
    setDeleteOpen(true);
  };

  const handleDeleteCustomer = async () => {
    try {
      await axiosInstance.delete(`/customers/${customerToDelete.id}/`);
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      setDeleteOpen(false);
      setCustomerToDelete(null);
      showSnackbar('Customer deleted');
    } catch (error) {
      showSnackbar(extractError(error), 'error');
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getLoyaltyTier = (points) => {
    if (points >= 1000) return { label: 'Gold', color: 'warning' };
    if (points >= 500) return { label: 'Silver', color: 'default' };
    return { label: 'Bronze', color: 'secondary' };
  };

  // ── Shared form fields component ─────────────────────────────────────────────
  const CustomerFormFields = ({ data, onChange }) => (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={12}>
        <TextField
          fullWidth required
          label="Phone Number"
          value={data.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="e.g. 08012345678"
          InputProps={{ startAdornment: <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth required
          label="Full Name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={data.email}
          onChange={(e) => onChange('email', e.target.value)}
          InputProps={{ startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Notes"
          multiline rows={2}
          value={data.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.2rem', md: '1.5rem' } }}>
          Customer Management
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Manage your customers and loyalty program
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Customers', value: customers.length, color: 'primary.light' },
          { label: 'Active Members', value: customers.filter(c => c.loyalty_points > 0).length, color: 'success.light' },
          { label: 'VIP Customers', value: customers.filter(c => c.total_spent > 10000).length, color: 'warning.light' },
          {
            label: 'Total Revenue',
            value: `₦${customers.reduce((s, c) => s + parseFloat(c.total_spent), 0).toLocaleString()}`,
            color: 'info.light',
          },
        ].map(({ label, value, color }) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <Card sx={{ bgcolor: color, color: 'white' }}>
              <CardContent>
                <Typography variant="h4" gutterBottom fontWeight="bold">{value}</Typography>
                <Typography variant="body2">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
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
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={12} md={6} sx={{ textAlign: 'right' }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
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
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  {['Customer', 'Contact', 'Loyalty Points', 'Total Spent', 'Visits', 'Actions'].map((h, i) => (
                    <TableCell key={h} align={i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left'}
                      sx={{ color: 'white', fontWeight: 'bold' }}>
                      {h}
                    </TableCell>
                  ))}
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
                            <Typography variant="body1" fontWeight="medium">{customer.name}</Typography>
                            <Chip label={tier.label} size="small" color={tier.color} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PhoneIcon fontSize="small" /> {customer.phone}
                        </Typography>
                        {customer.email && (
                          <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon fontSize="small" /> {customer.email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <LoyaltyIcon color="primary" />
                          <Typography fontWeight="bold">{customer.loyalty_points}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="primary">
                          ₦{parseFloat(customer.total_spent).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{customer.total_visits}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="View details">
                          <IconButton size="small" color="info" onClick={() => setViewCustomer(customer)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit customer">
                          <IconButton size="small" color="primary" onClick={() => openEditDialog(customer)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete customer">
                          <IconButton size="small" color="error" onClick={() => openDeleteDialog(customer)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {customers.length === 0 && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary">
                No customers found. Add your first customer to get started.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Add Customer Dialog ── */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setNewCustomer(EMPTY_FORM); }} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogContent>
          <CustomerFormFields
            data={newCustomer}
            onChange={(field, val) => setNewCustomer(prev => ({ ...prev, [field]: val }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddOpen(false); setNewCustomer(EMPTY_FORM); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateCustomer}
            disabled={!newCustomer.phone.trim() || !newCustomer.name.trim()}
          >
            Create Customer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Customer Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogContent>
          <CustomerFormFields
            data={editForm}
            onChange={(field, val) => setEditForm(prev => ({ ...prev, [field]: val }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateCustomer}
            disabled={!editForm.phone.trim() || !editForm.name.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" /> Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete <strong>{customerToDelete?.name}</strong>? Their purchase history will be
            kept but they will no longer appear as a customer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteCustomer}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View Details Dialog ── */}
      <Dialog open={!!viewCustomer} onClose={() => setViewCustomer(null)} maxWidth="md" fullWidth>
        <DialogTitle>Customer Details</DialogTitle>
        <DialogContent>
          {viewCustomer && (
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Profile</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
                    {viewCustomer.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">{viewCustomer.name}</Typography>
                    <Chip
                      label={getLoyaltyTier(viewCustomer.loyalty_points).label}
                      color={getLoyaltyTier(viewCustomer.loyalty_points).color}
                    />
                  </Box>
                </Box>
                <Typography><strong>Phone:</strong> {viewCustomer.phone}</Typography>
                <Typography><strong>Email:</strong> {viewCustomer.email || 'Not provided'}</Typography>
                <Typography><strong>Member Since:</strong> {new Date(viewCustomer.created_at).toLocaleDateString()}</Typography>
                {viewCustomer.notes && (
                  <Typography sx={{ mt: 1 }}><strong>Notes:</strong> {viewCustomer.notes}</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Loyalty Statistics</Typography>
                {[
                  { label: 'Loyalty Points', value: viewCustomer.loyalty_points },
                  { label: 'Total Spent', value: `₦${parseFloat(viewCustomer.total_spent).toLocaleString()}` },
                  { label: 'Total Visits', value: viewCustomer.total_visits },
                ].map(({ label, value }) => (
                  <Card key={label} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>{label}</Typography>
                      <Typography variant="h5" color="primary">{value}</Typography>
                    </Box>
                  </Card>
                ))}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewCustomer(null)}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => { setViewCustomer(null); openEditDialog(viewCustomer); }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomersPage;
