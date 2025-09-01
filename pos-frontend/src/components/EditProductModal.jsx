// src/components/EditProductModal.jsx
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, MenuItem, Grid
  } from "@mui/material";
  import { useState, useEffect } from "react";
  import axiosInstance from "../utils/axiosInstance";
  
  const EditProductModal = ({ open, onClose, product, onSuccess, onError }) => {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({ ...product });
  
    useEffect(() => {
      setFormData({
        id: product?.id,
        name: product?.name || "",
        price: product?.price || "",
        stock: product?.stock || "",
        cost_price: product?.cost_price || "",
        barcode: product?.barcode || "",
        category_id: product?.category?.id || product?.category_id || "",
      });
    }, [product]);
  
    useEffect(() => {
      axiosInstance.get("categories/")
        .then(res => setCategories(res.data))
        .catch(err => console.error("Failed to load categories:", err));
    }, []);
  
    const handleChange = (e) => {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
  
    const handleSubmit = () => {
      axiosInstance.put(`products/${formData.id}/`, formData)
        .then(() => {
          onSuccess?.();
          onClose();
        })
        .catch(err => {
          console.error("Edit failed:", err);
          onError?.();
        });
    };
  
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Product</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Product Name" name="name" fullWidth value={formData.name} onChange={handleChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField select label="Category" name="category_id" fullWidth value={formData.category_id} onChange={handleChange}>
                {categories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Price" name="price" type="number" fullWidth value={formData.price} onChange={handleChange} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Cost Price" name="cost_price" type="number" fullWidth value={formData.cost_price} onChange={handleChange} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Stock" name="stock" type="number" fullWidth value={formData.stock} onChange={handleChange} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Barcode" name="barcode" fullWidth value={formData.barcode} onChange={handleChange} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  export default EditProductModal;
  