// src/components/BulkDiscountManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Card, CardContent, Button, TextField,
  MenuItem, Grid, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Box, Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as DiscountIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const BulkDiscountManager = () => {
  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    discount_type: 'percentage',
    minimum_quantity: 1,
    discount_value: '',
    product: '',
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });

  useEffect(() => {
    loadDiscounts();
    loadProducts();
  }, []);

  const loadDiscounts = async () => {
    try {
      const response = await axiosInstance.get('/bulk-discounts/');
      setDiscounts(response.data);
    } catch (error) {
      console.error('Failed to load discounts:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await axiosInstance.get('/products/');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        name: formData.name,
        discount_type: formData.discount_type,
        minimum_quantity: parseInt(formData.minimum_quantity),
        discount_value: parseFloat(formData.discount_value),
        product: parseInt(formData.product),
        is_active: formData.is_active,
        start_date: formData.start_date,
        end_date: formData.end_date || null
      };

      console.log('Sending data:', submitData);

      if (editingDiscount) {
        await axiosInstance.put(`/bulk-discounts/${editingDiscount.id}/`, submitData);
      } else {
        await axiosInstance.post('/bulk-discounts/', submitData);
      }
      
      setOpenDialog(false);
      setEditingDiscount(null);
      setFormData({
        name: '',
        discount_type: 'percentage',
        minimum_quantity: 1,
        discount_value: '',
        product: '',
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      });
      loadDiscounts();
    } catch (error) {
      console.error('Failed to save discount:', error);
      if (error.response) {
        console.error('Server error details:', error.response.data);
        alert(`Error: ${JSON.stringify(error.response.data)}`);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this discount?')) {
      try {
        await axiosInstance.delete(`/bulk-discounts/${id}/`);
        loadDiscounts();
      } catch (error) {
        console.error('Failed to delete discount:', error);
      }
    }
  };

  const openEditDialog = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      discount_type: discount.discount_type,
      minimum_quantity: discount.minimum_quantity,
      discount_value: discount.discount_value,
      product: discount.product,
      is_active: discount.is_active,
      start_date: discount.start_date.split('T')[0],
      end_date: discount.end_date ? discount.end_date.split('T')[0] : ''
    });
    setOpenDialog(true);
  };

  const getDiscountDescription = (discount) => {
    switch (discount.discount_type) {
      case 'percentage':
        return `Buy ${discount.minimum_quantity}+ get ${discount.discount_value}% off`;
      case 'fixed':
        return `Buy ${discount.minimum_quantity}+ get ₦${discount.discount_value} off`;
      case 'bundle':
        return `Buy ${discount.minimum_quantity} get ${discount.discount_value} free`;
      default:
        return discount.name;
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Loading...';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Bulk Discount Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Bulk Discount
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Bulk Discounts
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Discount</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Min Qty</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {discounts.map((discount) => (
                  <TableRow key={discount.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {discount.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {getDiscountDescription(discount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getProductName(discount.product)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={discount.discount_type} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{discount.minimum_quantity}</TableCell>
                    <TableCell>
                      {discount.discount_type === 'percentage' ? `${discount.discount_value}%` : `₦${discount.discount_value}`}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={discount.is_active ? 'Active' : 'Inactive'} 
                        size="small" 
                        color={discount.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEditDialog(discount)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(discount.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {discounts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DiscountIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No bulk discounts configured
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first bulk discount to offer quantity-based pricing
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                Create First Discount
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Discount Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDiscount ? 'Edit Bulk Discount' : 'Add Bulk Discount'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Discount Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Product"
                fullWidth
                value={formData.product}
                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
              >
                <MenuItem value="">Select a product</MenuItem>
                {products.map(product => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label="Discount Type"
                fullWidth
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
              >
                <MenuItem value="percentage">Percentage Off</MenuItem>
                <MenuItem value="fixed">Fixed Amount Off</MenuItem>
                <MenuItem value="bundle">Bundle Deal</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Minimum Quantity"
                type="number"
                fullWidth
                value={formData.minimum_quantity}
                onChange={(e) => setFormData({ ...formData, minimum_quantity: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={formData.discount_type === 'percentage' ? 'Discount Percentage' : 
                       formData.discount_type === 'fixed' ? 'Discount Amount (₦)' : 
                       'Number of Free Items'}
                type="number"
                fullWidth
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                helperText={
                  formData.discount_type === 'percentage' ? 'Percentage discount (e.g., 10 for 10%)' :
                  formData.discount_type === 'fixed' ? 'Fixed amount to deduct' :
                  'Number of items to give free in bundle'
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="End Date (Optional)"
                type="date"
                fullWidth
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingDiscount ? 'Update Discount' : 'Create Discount'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BulkDiscountManager;