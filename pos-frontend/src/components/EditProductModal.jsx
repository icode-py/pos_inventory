// src/components/EditProductModal.jsx
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import ProductFormFields, { EMPTY_PRODUCT, toProductPayload, productErrorMessage } from "./ProductFormFields";

const EditProductModal = ({ open, onClose, product, onSuccess, onError }) => {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(EMPTY_PRODUCT);

  useEffect(() => {
    if (!product) return;
    setFormData({
      id: product.id,
      name: product.name || "",
      price: product.price ?? "",
      stock: product.stock ?? "",
      cost_price: product.cost_price ?? "",
      barcode: product.barcode || "",
      category_id: product.category?.id || product.category_id || "",
      is_bulk_product: Boolean(product.is_bulk_product),
      bulk_quantity: product.is_bulk_product ? product.bulk_quantity : EMPTY_PRODUCT.bulk_quantity,
      bulk_price: product.bulk_price ?? "",
      unit_of_measure: product.unit_of_measure || "units",
    });
  }, [product]);

  useEffect(() => {
    if (!open) return;
    axiosInstance.get("categories/")
      .then(res => setCategories(res.data))
      .catch(err => console.error("Failed to load categories:", err));
  }, [open]);

  const handleSubmit = () => {
    axiosInstance.put(`products/${formData.id}/`, toProductPayload(formData))
      .then(() => {
        onSuccess?.();
        onClose();
      })
      .catch(err => {
        console.error("Edit failed:", err);
        onError?.(productErrorMessage(err));
      });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Product</DialogTitle>
      <DialogContent dividers>
        <ProductFormFields formData={formData} setFormData={setFormData} categories={categories} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">Save Changes</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditProductModal;
