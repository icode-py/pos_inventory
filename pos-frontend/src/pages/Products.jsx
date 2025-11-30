import {
  Container, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Snackbar, Alert, Box, Grid,
  Card, CardContent, Chip, IconButton, TextField, MenuItem, Avatar,
  LinearProgress, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select
} from "@mui/material";
import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import AddProductModal from "../components/AddProductModal";
import EditProductModal from "../components/EditProductModal";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Search as SearchIcon,
  QrCode as BarcodeIcon,
  LowPriority as LowStockIcon,
  Visibility as ViewIcon
} from "@mui/icons-material";

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewedProduct, setViewedProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("products/");
      setProducts(response.data);
    } catch (err) {
      console.error("Failed to load products:", err);
      showSnackbar("Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axiosInstance.get("categories/");
      setCategories(response.data);
    } catch (err) {
      console.error("Failed to load categories:", err);
      showSnackbar("Failed to load categories", "error");
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      await axiosInstance.delete(`products/${id}/`);
      fetchProducts();
      showSnackbar("Product deleted successfully");
    } catch (err) {
      console.error("Delete failed:", err);
      showSnackbar("Failed to delete product", "error");
    }
  };

  const handleViewProduct = (product) => {
    setViewedProduct(product);
    setViewDialogOpen(true);
  };

  // Inventory Analytics
  const getInventoryStats = () => {
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.stock <= 10).length;
    const outOfStockProducts = products.filter(p => p.stock === 0).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.stock * parseFloat(p.cost_price || 0)), 0);
    
    return {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryValue
    };
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return { label: "Out of Stock", color: "error", icon: <WarningIcon /> };
    if (stock <= 5) return { label: "Very Low", color: "error", icon: <WarningIcon /> };
    if (stock <= 10) return { label: "Low", color: "warning", icon: <LowStockIcon /> };
    if (stock <= 20) return { label: "Medium", color: "info", icon: <InventoryIcon /> };
    return { label: "In Stock", color: "success", icon: <InventoryIcon /> };
  };

  const getProfitMargin = (product) => {
    const cost = parseFloat(product.cost_price || 0);
    const price = parseFloat(product.price || 0);
    if (cost === 0) return 0;
    return ((price - cost) / cost * 100).toFixed(1);
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toString().includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || product.category?.id.toString() === categoryFilter;
    const matchesStock = stockFilter === "all" || 
                        (stockFilter === "low" && product.stock <= 10) ||
                        (stockFilter === "out" && product.stock === 0) ||
                        (stockFilter === "healthy" && product.stock > 10);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const stats = getInventoryStats();

  // Quick Stats Cards
  const StatCard = ({ title, value, subtitle, icon, color, trend }) => (
    <Card sx={{ height: '100%', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)' } }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: `${color}20`, color: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Inventory Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your products, track stock levels, and monitor inventory health
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL PRODUCTS"
            value={stats.totalProducts}
            subtitle="In inventory"
            icon={<InventoryIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="LOW STOCK"
            value={stats.lowStockProducts}
            subtitle="Need attention"
            icon={<WarningIcon />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="OUT OF STOCK"
            value={stats.outOfStockProducts}
            subtitle="Urgent restock"
            icon={<WarningIcon />}
            color="#d32f2f"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="INVENTORY VALUE"
            value={`₦${stats.totalInventoryValue.toLocaleString()}`}
            subtitle="Total cost value"
            icon={<TrendingUpIcon />}
            color="#2e7d32"
          />
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search products by name or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Stock Status</InputLabel>
                <Select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  label="Stock Status"
                >
                  <MenuItem value="all">All Stock</MenuItem>
                  <MenuItem value="healthy">Healthy</MenuItem>
                  <MenuItem value="low">Low Stock</MenuItem>
                  <MenuItem value="out">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddModalOpen(true)}
                size="large"
                sx={{ borderRadius: 2 }}
              >
                Add New Product
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon color="primary" />
              Products ({filteredProducts.length} items)
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography>Loading products...</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="center">Stock Level</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell align="right">Margin</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product.stock);
                    const profitMargin = getProfitMargin(product);
                    
                    return (
                      <TableRow 
                        key={product.id} 
                        hover
                        sx={{ 
                          bgcolor: product.stock === 0 ? 'error.light' : 
                                  product.stock <= 5 ? 'warning.light' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {product.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {product.name}
                              </Typography>
                              {product.barcode && (
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <BarcodeIcon fontSize="small" />
                                  {product.barcode}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={product.category?.name || 'Uncategorized'} 
                            size="small" 
                            variant="outlined"
                            icon={<CategoryIcon />}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold" color="primary">
                            ₦{parseFloat(product.price).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={stockStatus.label}>
                              {stockStatus.icon}
                            </Tooltip>
                            <Box sx={{ flexGrow: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={Math.min((product.stock / 50) * 100, 100)} 
                                color={stockStatus.color}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                              <Typography variant="body2" color="textSecondary">
                                {product.stock} units
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            ₦{parseFloat(product.cost_price).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${profitMargin}%`} 
                            size="small" 
                            color={profitMargin > 30 ? "success" : profitMargin > 15 ? "warning" : "error"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="View Details">
                              <IconButton 
                                size="small" 
                                color="info"
                                onClick={() => handleViewProduct(product)}
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Product">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setEditModalOpen(true);
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Product">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && filteredProducts.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No products found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {searchTerm || categoryFilter !== "all" || stockFilter !== "all" 
                  ? "Try adjusting your filters" 
                  : "Get started by adding your first product"}
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => setAddModalOpen(true)}
              >
                Add First Product
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Product Detail Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon color="primary" />
            Product Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {viewedProduct && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Product Name</Typography>
                    <Typography variant="body1" fontWeight="medium">{viewedProduct.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Category</Typography>
                    <Typography variant="body1">{viewedProduct.category?.name || 'Uncategorized'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Barcode</Typography>
                    <Typography variant="body1">{viewedProduct.barcode || 'Not set'}</Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Pricing & Stock</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Selling Price</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary">
                      ₦{parseFloat(viewedProduct.price).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Cost Price</Typography>
                    <Typography variant="body1">
                      ₦{parseFloat(viewedProduct.cost_price).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Stock Level</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={getStockStatus(viewedProduct.stock).label} 
                        color={getStockStatus(viewedProduct.stock).color}
                        size="small"
                      />
                      <Typography variant="body1">{viewedProduct.stock} units</Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Profit Margin</Typography>
                    <Typography variant="body1" color={getProfitMargin(viewedProduct) > 30 ? "success.main" : "warning.main"}>
                      {getProfitMargin(viewedProduct)}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained"
            onClick={() => {
              setSelectedProduct(viewedProduct);
              setViewDialogOpen(false);
              setEditModalOpen(true);
            }}
          >
            Edit Product
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modals */}
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

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default ProductsPage;