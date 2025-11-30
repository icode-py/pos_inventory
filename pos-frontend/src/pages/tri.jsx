// src/pages/RestockPage.jsx

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
  Container, Typography, TextField, MenuItem, Button, Snackbar, Alert, Box,Paper, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';

const RestockPage = () => {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  const [restockHistory, setRestockHistory] = useState([]);

 

  useEffect(() => {
    axiosInstance.get('/products/')
      .then(res => setProducts(res.data))
      .catch(() => setFeedback({ open: true, message: 'Failed to fetch products', severity: 'error' }));
  }, []);

   useEffect(() => {
  axiosInstance.get('/restock-history/')
    .then(res => setRestockHistory(res.data))
    .catch(() => setFeedback({ open: true, message: 'Failed to load history', severity: 'error' }));
  }, [feedback.message]); // refresh history after a restock

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
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Restock failed';
        setFeedback({ open: true, message: msg, severity: 'error' });
      });
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>Restock Product</Typography>
      <Box display="flex" flexDirection="column" gap={2}>
        <TextField
          select
          label="Select Product"
          value={productId}
          onChange={e => setProductId(e.target.value)}
        >
          {products.map(product => (
            <MenuItem key={product.id} value={product.id}>
              {product.name} (Current: {product.stock})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          label="Quantity to Add"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
        />
        <Button variant="contained" onClick={handleRestock}>Restock</Button>
      </Box>
      <Typography variant="h6" sx={{ mt: 4 }}>Recent Restocks</Typography>
<Paper sx={{ mt: 2, overflow: 'auto', maxHeight: 300 }}>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Product</TableCell>
        <TableCell>Quantity Added</TableCell>
        <TableCell>By</TableCell>
        <TableCell>Date</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {restockHistory.map(entry => (
        <TableRow key={entry.id}>
          <TableCell>{entry.product_name}</TableCell>
          <TableCell>{entry.quantity_added}</TableCell>
          <TableCell>{entry.restocked_by_username}</TableCell>
          <TableCell>{new Date(entry.restocked_at).toLocaleString()}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Paper>
      <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({ ...feedback, open: false })}>
        <Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default RestockPage;
