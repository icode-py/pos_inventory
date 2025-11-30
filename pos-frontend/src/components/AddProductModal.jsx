// src/components/AddProductModal.jsx
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, MenuItem, Grid, Checkbox, FormControlLabel
  } from "@mui/material";
  import { useState, useEffect } from "react";
  import axiosInstance from "../utils/axiosInstance";
  
  const AddProductModal = ({ open, onClose, onSuccess, onError }) => {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
      name: "", category_id: "", price: "", cost_price: "", stock: "", barcode: "",
      is_bulk_product: false, // ADDED: Bulk product fields
      bulk_quantity: 1,
      bulk_price: "",
      unit_of_measure: "units"
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
          setFormData({ 
            name: "", category_id: "", price: "", cost_price: "", stock: "", barcode: "",
            is_bulk_product: false, bulk_quantity: 1, bulk_price: "", unit_of_measure: "units"
          });
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
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_bulk_product}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_bulk_product: e.target.checked }))}
                    name="is_bulk_product"
                  />
                }
                label="Bulk Product"
              />
            </Grid>
            {formData.is_bulk_product && (
          <>
            <Grid item xs={6}>
              <TextField
                label="Bulk Quantity"
                name="bulk_quantity"
                type="number"
                fullWidth
                value={formData.bulk_quantity}
                onChange={handleChange}
                helperText="Units per bulk pack"
              />
            </Grid>
            <Grid item xs={6}>
            <TextField
              label="Bulk Price"
              name="bulk_price"
              type="number"
              fullWidth
              value={formData.bulk_price}
              onChange={handleChange}
              helperText="Price for entire bulk pack"
            />
            </Grid>
            <Grid item xs={6}>
                  <TextField
                    label="Unit of Measure"
                    name="unit_of_measure"
                    fullWidth
                    value={formData.unit_of_measure}
                    onChange={handleChange}
                    helperText="e.g., pieces, kg, packs"
                  />
                </Grid>
              </>
            )}

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