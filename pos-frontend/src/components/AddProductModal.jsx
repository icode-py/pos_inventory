// src/components/AddProductModal.jsx
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, MenuItem, Grid
  } from "@mui/material";
  import { useState, useEffect } from "react";
  import axiosInstance from "../utils/axiosInstance";
  
  const AddProductModal = ({ open, onClose, onSuccess, onError }) => {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
      name: "", category_id: "", price: "", cost_price: "", stock: "", barcode: ""
    });
  
    useEffect(() => {
      axiosInstance.get("categories/")
        .then(res => setCategories(res.data))
        .catch(err => console.error("Failed to load categories:", err));
    }, []);
  
    const handleChange = (e) => {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
  
    const handleSubmit = () => {
      axiosInstance.post("products/", formData)
        .then(() => {
          onSuccess?.();
          onClose();
          setFormData({ name: "", category_id: "", price: "", cost_price: "", stock: "", barcode: "" });
        })
        .catch(err => {
          console.error("Add failed:", err);
          onError?.();
        });
    };
  
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Product</DialogTitle>
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
          <Button onClick={handleSubmit} variant="contained">Add Product</Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  export default AddProductModal;
  