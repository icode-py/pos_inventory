import {
  Container, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Snackbar, Alert, Box, Grid,
  Card, CardContent, Chip, IconButton, TextField, MenuItem, Avatar,
  LinearProgress, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select, CircularProgress,
  List, ListItem, ListItemText, TablePagination, Checkbox
} from "@mui/material";
import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import axiosInstance from "../utils/axiosInstance";
import AddProductModal from "../components/AddProductModal";
import CategoryManagerModal from '../components/CategoryManagerModal';
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
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
  UnfoldMore as UnsortedIcon,
  DeleteSweep as BulkDeleteIcon,
} from "@mui/icons-material";

// Currency formatting helper function
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₦0.00';
  }

  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Format with commas for thousands and two decimal places
  return `₦${numAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

function ProductsPage() {
  const { user } = useContext(AuthContext);
  const canWrite = user?.role === 'admin' || user?.role === 'manager';

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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");   // immediate (shown in input)
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });
  const [selected, setSelected] = useState([]);

  // Debounce: update searchTerm 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const handleDownloadTemplate = async () => {
    try {
      const response = await axiosInstance.get('products/download-template/', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_upload_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showSnackbar('Failed to download template', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setUploadResults(null);
    setUploadDialogOpen(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axiosInstance.post('products/bulk-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResults(res.data);
      fetchProducts();
    } catch (err) {
      setUploadResults({ error: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSelectAll = (e) => {
    setSelected(e.target.checked ? paginatedProducts.map(p => p.id) : []);
  };

  const handleSelectOne = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Permanently delete ${selected.length} product(s)? This cannot be undone.`)) return;

    const results = await Promise.allSettled(
      selected.map(id => axiosInstance.delete(`products/${id}/`))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    setSelected([]);
    fetchProducts();

    if (failed.length === 0) {
      showSnackbar(`${succeeded} product(s) deleted successfully`);
    } else if (succeeded === 0) {
      const reason = failed[0].reason?.response?.data?.error || 'Products could not be deleted';
      showSnackbar(reason, 'error');
    } else {
      showSnackbar(
        `${succeeded} deleted. ${failed.length} could not be deleted (they have sales history).`,
        'warning'
      );
    }
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

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    switch (sortConfig.column) {
      case 'name':     return a.name.localeCompare(b.name) * dir;
      case 'price':    return (parseFloat(a.price) - parseFloat(b.price)) * dir;
      case 'stock':    return (a.stock - b.stock) * dir;
      case 'cost':     return (parseFloat(a.cost_price) - parseFloat(b.cost_price)) * dir;
      case 'margin':   return (parseFloat(getProfitMargin(a)) - parseFloat(getProfitMargin(b))) * dir;
      default:         return 0;
    }
  });

  const paginatedProducts = sortedProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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
    <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 4, px: { xs: 1, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.2rem', md: '1.5rem' } }}>
          Inventory Management
        </Typography>
        <Typography variant="body2" color="textSecondary">
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
            value={formatCurrency(stats.totalInventoryValue)}
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
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
                  onChange={(e) => { setStockFilter(e.target.value); setPage(0); }}
                  label="Stock Status"
                >
                  <MenuItem value="all">All Stock</MenuItem>
                  <MenuItem value="healthy">Healthy</MenuItem>
                  <MenuItem value="low">Low Stock</MenuItem>
                  <MenuItem value="out">Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {canWrite && (
                <>
                  <Button variant="outlined" startIcon={<CategoryIcon />} onClick={() => setCategoryModalOpen(true)}>
                    Categories
                  </Button>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate}>
                    Template
                  </Button>
                  <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
                    Upload Excel
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} />
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddModalOpen(true)} sx={{ borderRadius: 2 }}>
                    Add Product
                  </Button>
                </>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon color="primary" />
              Products ({filteredProducts.length} items)
              {selected.length > 0 && (
                <Chip label={`${selected.length} selected`} size="small" color="primary" sx={{ ml: 1 }} />
              )}
            </Typography>
            {canWrite && selected.length > 0 && (
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<BulkDeleteIcon />}
                onClick={handleBulkDelete}
              >
                Delete {selected.length} Selected
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography>Loading products...</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {canWrite && (
                      <TableCell padding="checkbox" sx={{ bgcolor: 'primary.main' }}>
                        <Checkbox
                          size="small"
                          sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                          indeterminate={selected.length > 0 && selected.length < paginatedProducts.length}
                          checked={paginatedProducts.length > 0 && selected.length === paginatedProducts.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                    )}
                    {[
                      { id: 'name',   label: 'Product',     align: 'left'  },
                      { id: null,     label: 'Category',    align: 'left'  },
                      { id: 'price',  label: 'Price',       align: 'right' },
                      { id: 'stock',  label: 'Stock Level', align: 'center'},
                      { id: 'cost',   label: 'Cost',        align: 'right' },
                      { id: 'margin', label: 'Margin',      align: 'right' },
                      { id: null,     label: 'Actions',     align: 'center'},
                    ].map(({ id, label, align }) => (
                      <TableCell
                        key={label}
                        align={align}
                        onClick={id ? () => handleSort(id) : undefined}
                        sx={{
                          color: 'white', fontWeight: 'bold',
                          cursor: id ? 'pointer' : 'default',
                          userSelect: 'none',
                          '&:hover': id ? { bgcolor: 'primary.dark' } : {},
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          {label}
                          {id && (sortConfig.column === id
                            ? (sortConfig.direction === 'asc' ? <AscIcon fontSize="small" /> : <DescIcon fontSize="small" />)
                            : <UnsortedIcon fontSize="small" sx={{ opacity: 0.5 }} />
                          )}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedProducts.map((product) => {
                    const stockStatus = getStockStatus(product.stock);
                    const profitMargin = getProfitMargin(product);

                    return (
                      <TableRow
                        key={product.id}
                        hover
                        selected={selected.includes(product.id)}
                        sx={{
                          bgcolor: product.stock === 0 ? 'error.light' :
                            product.stock <= 5 ? 'warning.light' : 'inherit'
                        }}
                      >
                        {canWrite && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selected.includes(product.id)}
                              onChange={() => handleSelectOne(product.id)}
                            />
                          </TableCell>
                        )}
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
                            {formatCurrency(product.price)}
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
                            {formatCurrency(product.cost_price)}
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
                            {canWrite && (
                              <>
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
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {!loading && filteredProducts.length > 0 && (
            <TablePagination
              component="div"
              count={filteredProducts.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count} products`}
              sx={{ borderTop: 1, borderColor: 'divider' }}
            />
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
                      {formatCurrency(viewedProduct.price)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Cost Price</Typography>
                    <Typography variant="body1">
                      {formatCurrency(viewedProduct.cost_price)}
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

      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSuccess={() => {
          fetchCategories(); // Refresh categories list
          fetchProducts(); // Refresh products to show updated categories
        }}
      />

      {/* Bulk Upload Results Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => !uploading && setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Product Upload</DialogTitle>
        <DialogContent>
          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress />
              <Typography>Processing your file...</Typography>
            </Box>
          ) : uploadResults?.error && !uploadResults?.errors ? (
            <Alert severity="error">{uploadResults.error}</Alert>
          ) : uploadResults ? (
            <Box>
              {uploadResults.message && (
                <Alert severity="warning" sx={{ mb: 2 }}>{uploadResults.message}</Alert>
              )}
              {!uploadResults.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Upload complete — {uploadResults.created} created, {uploadResults.updated} updated.
                </Alert>
              )}
              {uploadResults.errors?.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Fix these rows and re-upload:
                  </Typography>
                  <List dense sx={{ maxHeight: 220, overflow: 'auto', bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                    {uploadResults.errors.map((e, i) => (
                      <ListItem key={i} divider>
                        <ListItemText
                          primary={`Row ${e.row}: ${e.name}`}
                          secondary={e.error}
                          primaryTypographyProps={{ fontWeight: 'medium', variant: 'body2' }}
                          secondaryTypographyProps={{ color: 'error.main', variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>Close</Button>
        </DialogActions>
      </Dialog>

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