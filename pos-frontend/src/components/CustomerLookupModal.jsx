import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, List, ListItem, ListItemText,
  ListItemIcon, Avatar, Chip, Typography, Box,
  CircularProgress, Divider, IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  Phone as PhoneIcon,
  Loyalty as LoyaltyIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const CustomerLookupModal = ({ open, onClose, onSelectCustomer, onAddNewCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (open && searchTerm.length >= 2) {
      searchCustomers();
    } else {
      setCustomers([]);
    }
  }, [searchTerm, open]);

  const searchCustomers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.match(/^\d/)) {
        params.phone = searchTerm;
      } else {
        params.name = searchTerm;
      }
      
      const response = await axiosInstance.get('/customers/', { params });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleConfirmSelection = () => {
    if (selectedCustomer) {
      onSelectCustomer(selectedCustomer);
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setCustomers([]);
    setSelectedCustomer(null);
    onClose();
  };

  const getLoyaltyTier = (points) => {
    if (points >= 1000) return { label: 'Gold', color: 'warning' };
    if (points >= 500) return { label: 'Silver', color: 'default' };
    return { label: 'Bronze', color: 'secondary' };
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Find Customer</Typography>
          <Button
            startIcon={<PersonAddIcon />}
            onClick={onAddNewCustomer}
            variant="outlined"
            size="small"
          >
            New Customer
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Search Input */}
        <TextField
          fullWidth
          placeholder="Search by name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ mb: 2 }}
          autoFocus
        />

        {/* Search Results */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && searchTerm.length >= 2 && customers.length === 0 && (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography color="textSecondary">
              No customers found. Try a different search or add a new customer.
            </Typography>
          </Box>
        )}

        {!loading && customers.length > 0 && (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {customers.map((customer, index) => {
              const tier = getLoyaltyTier(customer.loyalty_points);
              const isSelected = selectedCustomer?.id === customer.id;
              
              return (
                <React.Fragment key={customer.id}>
                  <ListItem 
                    button 
                    onClick={() => handleSelectCustomer(customer)}
                    selected={isSelected}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? 'primary.light' : 'background.paper'
                    }}
                  >
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {customer.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {customer.name}
                          </Typography>
                          <Chip label={tier.label} size="small" color={tier.color} />
                          {isSelected && <CheckIcon color="primary" fontSize="small" />}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" />
                            <Typography variant="body2">{customer.phone}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LoyaltyIcon fontSize="small" color="primary" />
                            <Typography variant="body2" fontWeight="medium">
                              {customer.loyalty_points} points
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              • ₦{parseFloat(customer.total_spent).toLocaleString()} spent
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < customers.length - 1 && <Divider variant="inset" />}
                </React.Fragment>
              );
            })}
          </List>
        )}

        {selectedCustomer && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ color: 'white' }}>
              <strong>Selected:</strong> {selectedCustomer.name} ({selectedCustomer.phone})
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleConfirmSelection}
          variant="contained"
          disabled={!selectedCustomer}
          startIcon={<CheckIcon />}
        >
          Select Customer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerLookupModal;