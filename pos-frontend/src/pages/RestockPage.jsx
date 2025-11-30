// src/pages/Restock.jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
  Container,
  Typography,
  TextField,
  MenuItem,
  Button,
  Snackbar,
  Alert,
  Box,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Card,
  CardContent,
  Grid,
  TableContainer,
} from '@mui/material';

const Restock = () => {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  const [restockHistory, setRestockHistory] = useState([]);

  // Load products and history
 const loadProducts = () => {
  axiosInstance.get('/products/')
    .then(res => setProducts(res.data))
    .catch(err => {
      console.error('Failed to fetch products:', err);
      if (err.response?.status === 403) {
        setFeedback({ open: true, message: 'Permission denied: Cannot access products', severity: 'error' });
      } else {
        setFeedback({ open: true, message: 'Failed to fetch products', severity: 'error' });
      }
    });
};

const loadRestockHistory = () => {
  axiosInstance.get('/restock-history/')
    .then(res => setRestockHistory(res.data))
    .catch(err => {
      console.error('Failed to load history:', err);
      if (err.response?.status === 403) {
        setFeedback({ open: true, message: 'Permission denied: Cannot view restock history', severity: 'error' });
      } else {
        setFeedback({ open: true, message: 'Failed to load restock history', severity: 'error' });
      }
    });
};

  useEffect(() => {
    loadProducts();
    loadRestockHistory();
  }, []);

  const handleRestock = () => {
    if (!productId || !quantity || quantity <= 0) {
      setFeedback({ open: true, message: 'Please select a product and enter a valid quantity', severity: 'warning' });
      return;
    }

    axiosInstance.post('/restock/', { product_id: productId, quantity })
      .then(res => {
        setFeedback({ open: true, message: res.data.message, severity: 'success' });
        setQuantity('');
        setProductId('');
        
        // Refresh both products and history data
        loadProducts(); // This updates the products list with new stock numbers
        loadRestockHistory(); // This updates the history table
      })
     .catch(err => {
      console.error('Restock failed:', err);
      const errorMsg = err.response?.data?.error || 
                      (err.response?.status === 403 ? 
                       'Permission denied: Cannot restock products' : 
                       'Restock failed');
      setFeedback({ open: true, message: errorMsg, severity: 'error' });
    });
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Restock Product
        </Typography>
        <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
          Add stock to existing products in your inventory
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Restock Form */}
        <Grid item xs={12} md={6}>
          <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Add Stock
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Select Product"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  variant="outlined"
                >
                  <MenuItem value="">
                    <em>Choose a product</em>
                  </MenuItem>
                  {products.map(product => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name} (Current: {product.stock})
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  type="number"
                  fullWidth
                  label="Quantity to Add"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                />

                <Button
                  variant="contained"
                  onClick={handleRestock}
                  size="large"
                  sx={{
                    py: 1.5,
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  }}
                >
                  Restock Product
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats Cards */}
        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ boxShadow: 2, borderRadius: 2, textAlign: 'center', p: 2 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {products.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Products
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ boxShadow: 2, borderRadius: 2, textAlign: 'center', p: 2 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                  {products.filter(p => p.stock <= (p.low_stock_threshold || 10)).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Low Stock
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ boxShadow: 2, borderRadius: 2, textAlign: 'center', p: 2 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {restockHistory.filter(entry => 
                    new Date(entry.restocked_at).toDateString() === new Date().toDateString()
                  ).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Today's Restocks
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Products List */}
          <Card sx={{ boxShadow: 3, borderRadius: 2, mt: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Products Quick View
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {products.slice(0, 5).map(product => (
                  <Box
                    key={product.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {product.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: product.stock <= (product.low_stock_threshold || 10) ? 'error.main' : 'success.main',
                        fontWeight: 'bold'
                      }}
                    >
                      {product.stock} in stock
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Restocks Table */}
      <Card sx={{ boxShadow: 3, borderRadius: 2, mt: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Recent Restocks
            </Typography>
          </Box>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Quantity Added</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>By</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {restockHistory.map(entry => (
                  <TableRow 
                    key={entry.id}
                    sx={{ 
                      '&:last-child td, &:last-child th': { border: 0 },
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {entry.product_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: 'success.light',
                          color: 'success.dark',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        +{entry.quantity_added}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {entry.restocked_by_username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(entry.restocked_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {restockHistory.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No restock history available
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Feedback Snackbar */}
      <Snackbar 
        open={feedback.open} 
        autoHideDuration={4000} 
        onClose={() => setFeedback({ ...feedback, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={feedback.severity} 
          variant="filled"
          onClose={() => setFeedback({ ...feedback, open: false })}
        >
          {feedback.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Restock;