import {
  Container, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Snackbar, Alert, Box, Grid
} from "@mui/material";
import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import AddProductModal from "../components/AddProductModal";
import EditProductModal from "../components/EditProductModal";

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editedProduct, setEditedProduct] = useState({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = () => {
    axiosInstance.get("products/")
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleEditClick = (product) => {
    setEditingId(product.id);
    setEditedProduct({
      name: product.name,
      price: product.price,
      stock: product.stock,
      cost_price: product.cost_price,
      category_id: product.category.id,
    });
  };

  const handleEditProduct = (id, updated) => {
    axiosInstance.put(`products/${id}/`, updated)
      .then(() => {
        setEditingId(null);
        fetchProducts();
        showSnackbar("Product updated successfully");
      })
      .catch(err => {
        console.error(err);
        showSnackbar("Failed to update product", "error");
      });
  };

  const handleDeleteProduct = (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    axiosInstance.delete(`products/${id}/`)
      .then(() => {
        fetchProducts();
        showSnackbar("Product deleted");
      })
      .catch(err => {
        console.error("Delete failed:", err);
        showSnackbar("Failed to delete product", "error");
      });
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Typography variant="h4" gutterBottom>
          Products
          </Typography>
        </Grid>
      <Grid item xs={12} sm={6} textAlign={{ xs: "left", sm: "right" }}>
      <Button variant="contained" onClick={() => setAddModalOpen(true)} sx={{ mb: 2 }}>
        Add Product
      </Button>
      </Grid>
      </Grid>

      <AddProductModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => {
          fetchProducts();
          showSnackbar("Product added successfully");
        }}
        onError={() => showSnackbar("Failed to add product", "error")}
      />

      <EditProductModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        product={selectedProduct}
        onSuccess={() => {
          fetchProducts();
          showSnackbar("Product updated successfully");
        }}
        onError={() => showSnackbar("Failed to update product", "error")}
      />

      <Box sx={{ overflowX: 'auto' }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>₦{product.price}</TableCell>
                <TableCell>{product.stock}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedProduct(product);
                      setEditModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    sx={{ ml: 1 }}
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default ProductsPage;
