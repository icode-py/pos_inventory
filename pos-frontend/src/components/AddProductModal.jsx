// src/components/AddProductModal.jsx
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import ProductFormFields, { EMPTY_PRODUCT, toProductPayload, productErrorMessage } from "./ProductFormFields";

const AddProductModal = ({ open, onClose, onSuccess, onError }) => {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(EMPTY_PRODUCT);

  useEffect(() => {
    if (!open) return;
    axiosInstance.get("categories/")
      .then(res => setCategories(res.data))
      .catch(err => console.error("Failed to load categories:", err));
  }, [open]);

  const handleSubmit = () => {
    axiosInstance.post("products/", toProductPayload(formData))
      .then(() => {
        onSuccess?.();
        onClose();
        setFormData(EMPTY_PRODUCT);
      })
      .catch(err => {
        console.error("Add failed:", err);
        onError?.(productErrorMessage(err));
      });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Product</DialogTitle>
      <DialogContent dividers>
        <ProductFormFields formData={formData} setFormData={setFormData} categories={categories} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Add Product</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddProductModal;
