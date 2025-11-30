import {
  Grid, TextField, MenuItem, Typography, Button, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar,
  Card, CardContent, Box, Chip, IconButton, Divider, Alert, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Badge
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import { useEffect, useState, useRef } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Receipt as ReceiptIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  Keyboard as KeyboardIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Loyalty as LoyaltyIcon,
  PersonAdd as PersonAddIcon,
  CloudOff as OfflineIcon,
  CloudQueue as SyncingIcon,
  CloudDone as OnlineIcon,
  CloudUpload as CloudUploadIcon,
  LocalOffer as DiscountIcon
} from "@mui/icons-material";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import CustomerLookupModal from '../components/CustomerLookupModal';
import CustomerQuickAddModal from '../components/CustomerQuickAddModal';
import { useOffline } from '../context/OfflineManager';

const SalesPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info"
  });
  const [lastSale, setLastSale] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickProducts, setQuickProducts] = useState([]);
  const [scannerActive, setScannerActive] = useState(true);
  const [changeAmount, setChangeAmount] = useState(0);
  const [suggestedAmounts, setSuggestedAmounts] = useState([]);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [customerQuickAddOpen, setCustomerQuickAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Offline functionality
  const { 
    isOnline, 
    pendingSales, 
    saveOfflineSale, 
    syncPendingSales 
  } = useOffline();

  const receiptRef = useRef();
  const barcodeRef = useRef();

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Helper function for discount calculation - FIXED: Made standalone
  const calculateDiscountAmount = (discount, quantity, unitPrice) => {
    if (!discount) return 0;
    
    switch (discount.discount_type) {
      case 'percentage':
        return (unitPrice * quantity) * (parseFloat(discount.discount_value) / 100);
      case 'fixed':
        return parseFloat(discount.discount_value);
      case 'bundle':
        const bundles = Math.floor(quantity / discount.minimum_quantity);
        return bundles * parseFloat(discount.discount_value) * unitPrice;
      default:
        return 0;
    }
  };

  // Bulk Pricing Calculation - FIXED: Removed 'this.' references
  const calculateItemPrice = (product, quantity) => {
    const unitPrice = parseFloat(product.price) || 0;
    
    // First apply bulk product pricing if applicable
    let totalPrice = 0;
    
    if (product.is_bulk_product && product.bulk_quantity > 1 && product.bulk_price) {
      const bulkQuantity = parseInt(product.bulk_quantity) || 1;
      const bulkPrice = parseFloat(product.bulk_price) || 0;
      
      const bulkPacks = Math.floor(quantity / bulkQuantity);
      const remainingUnits = quantity % bulkQuantity;
      
      totalPrice = (bulkPacks * bulkPrice) + (remainingUnits * unitPrice);
    } else {
      // Regular pricing
      totalPrice = unitPrice * quantity;
    }
    
    // Then apply bulk discounts if available
    if (product.bulk_discounts && product.bulk_discounts.length > 0) {
      const activeDiscounts = product.bulk_discounts.filter(discount => {
        if (!discount.is_active) return false;
        
        // Check if discount is within date range
        const now = new Date();
        const startDate = new Date(discount.start_date);
        if (discount.end_date) {
          const endDate = new Date(discount.end_date);
          return now >= startDate && now <= endDate;
        }
        return now >= startDate;
      });
      
      // Find the best applicable discount
      const applicableDiscounts = activeDiscounts.filter(discount => 
        quantity >= discount.minimum_quantity
      );
      
      if (applicableDiscounts.length > 0) {
        const bestDiscount = applicableDiscounts.reduce((best, current) => {
          const currentValue = calculateDiscountAmount(current, quantity, unitPrice);
          const bestValue = calculateDiscountAmount(best, quantity, unitPrice);
          return currentValue > bestValue ? current : best;
        });
        
        const discountAmount = calculateDiscountAmount(bestDiscount, quantity, unitPrice);
        totalPrice -= discountAmount;
      }
    }
    
    return Math.max(0, totalPrice); // Ensure price doesn't go negative
  };

  // Load products from cache or API
  const loadProducts = async () => {
    // First try to load from cache
    const cachedProducts = localStorage.getItem('holo_cached_products');
    const cacheTimestamp = localStorage.getItem('holo_products_timestamp');
    const isCacheValid = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < (30 * 60 * 1000); // 30 minutes

    if (cachedProducts && isCacheValid) {
      try {
        const parsedProducts = JSON.parse(cachedProducts);
        const productsWithNumericPrices = parsedProducts.map(product => ({
          ...product,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          bulk_price: product.bulk_price ? (typeof product.bulk_price === 'string' ? parseFloat(product.bulk_price) : product.bulk_price) : null
        }));
        setProducts(productsWithNumericPrices);
        
        if (!isOnline) {
          showSnackbar("Using cached products (offline mode)", "info");
          return;
        }
      } catch (error) {
        console.error('Failed to parse cached products:', error);
        localStorage.removeItem('holo_cached_products');
        localStorage.removeItem('holo_products_timestamp');
      }
    }

    // If online, try to fetch fresh products
    if (isOnline) {
      try {
        const response = await axiosInstance.get("products/");
        const productsWithNumericPrices = response.data.map(product => ({
          ...product,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          bulk_price: product.bulk_price ? (typeof product.bulk_price === 'string' ? parseFloat(product.bulk_price) : product.bulk_price) : null
        }));
        
        setProducts(productsWithNumericPrices);
        
        // Cache the products
        localStorage.setItem('holo_cached_products', JSON.stringify(response.data));
        localStorage.setItem('holo_products_timestamp', Date.now().toString());
        
        setLastRefresh(new Date());
      } catch (err) {
        console.error("Failed to load products from API", err);
        if (!cachedProducts) {
          showSnackbar("Failed to load products", "error");
        }
      }
    } else if (!cachedProducts) {
      showSnackbar("No cached products available", "warning");
    }
  };

  // Customer Management Functions
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    showSnackbar(`Customer ${customer.name} selected`, 'success');
  };

  const handleAddNewCustomer = () => {
    setCustomerLookupOpen(false);
    setCustomerQuickAddOpen(true);
  };

  const handleCustomerCreated = (newCustomer) => {
    setSelectedCustomer(newCustomer);
    setCustomerQuickAddOpen(false);
    showSnackbar(`Customer ${newCustomer.name} created and selected`, 'success');
  };

  const handleRemoveCustomer = () => {
    setSelectedCustomer(null);
    showSnackbar('Customer removed from sale', 'info');
  };

  // Load products and cart on component mount
  useEffect(() => {
    loadProducts();
    
    // Load saved cart from session
    const savedCart = localStorage.getItem('pos-cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        showSnackbar('Previous session restored', 'info');
      } catch (error) {
        console.error('Failed to load saved cart:', error);
      }
    }
  }, []);

  // Auto-refresh products when online (optional)
  useEffect(() => {
    if (isOnline) {
      const interval = setInterval(() => {
        loadProducts();
      }, 5 * 60 * 1000); // Refresh every 5 minutes when online

      return () => clearInterval(interval);
    }
  }, [isOnline]);

  useEffect(() => {
    if (scannerActive) {
      barcodeRef.current?.focus();
    }
  }, [scannerActive]);

  useEffect(() => {
    const total = calculateTotal();
    setChangeAmount(parseFloat(paidAmount) - total || 0);
    
    // Generate suggested amounts
    const suggestions = [];
    if (total > 0) {
      suggestions.push(total); // Exact amount
      if (total % 100 !== 0) {
        suggestions.push(Math.ceil(total / 100) * 100); // Next 100
      }
      suggestions.push(total + 100); // Extra 100
      suggestions.push(total + 500); // Extra 500
    }
    setSuggestedAmounts(suggestions);
  }, [paidAmount, cart]);

  useEffect(() => {
    // Filter products for quick access
    const quickAccess = products
      .filter(product => product.stock > 0)
      .slice(0, 8);
    setQuickProducts(quickAccess);
  }, [products]);

  // Session Management
  useEffect(() => {
    // Save cart to localStorage whenever it changes
    localStorage.setItem('pos-cart', JSON.stringify(cart));
    localStorage.setItem('pos-cart-timestamp', new Date().toISOString());
  }, [cart]);

  const handleAddProduct = (product) => {
    // Check stock - for offline mode using cached stock levels
    if (product.stock === 0) {
      showSnackbar(`Product "${product.name}" is out of stock.`, "warning");
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex !== -1) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity >= product.stock) {
        showSnackbar(`Only ${product.stock} units available`, "warning");
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      const productWithNumericPrice = {
        ...product,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
        bulk_price: product.bulk_price ? (typeof product.bulk_price === 'string' ? parseFloat(product.bulk_price) : product.bulk_price) : null
      };
      setCart(prev => [...prev, { product: productWithNumericPrice, quantity: 1 }]);
    }

    setSelectedProductId("");
    setBarcodeInput("");
    showSnackbar(`Added ${product.name} to cart`, "success");
    
    // Refocus barcode input after adding product
    if (scannerActive) {
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  };

  const handleBarcodeEnter = (e) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      const product = products.find(p => 
        p.barcode?.toString().toLowerCase() === barcodeInput.trim().toLowerCase()
      );
      product 
        ? handleAddProduct(product)
        : showSnackbar("Product not found", "error");
      setBarcodeInput("");
    }
  };

  const handleBarcodeScan = (e) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      handleBarcodeEnter(e);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + Key combinations
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        switch(e.key) {
          case 'Enter':
            if (cart.length > 0 && paidAmount && parseFloat(paidAmount) >= calculateTotal()) {
              handleCompleteSale();
            }
            break;
          case 'Delete':
          case 'Backspace':
            setCart([]);
            showSnackbar('Cart cleared', 'info');
            break;
          case 'f':
            barcodeRef.current?.focus();
            break;
          case 'r':
            loadProducts();
            showSnackbar('Products refreshed', 'success');
            break;
          case 'k':
            setShowShortcutsDialog(true);
            break;
          default:
            break;
        }
      }
      
      // Function keys
      switch(e.key) {
        case 'F1':
          e.preventDefault();
          setShowShortcutsDialog(true);
          break;
        case 'F2':
          e.preventDefault();
          barcodeRef.current?.focus();
          break;
        case 'F5':
          e.preventDefault();
          loadProducts();
          showSnackbar('Products refreshed', 'success');
          break;
        case 'Escape':
          if (cart.length > 0) {
            setCart([]);
            showSnackbar('Cart cleared', 'info');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [cart, paidAmount]);

  const handleDropdownChange = (e) => {
    const product = products.find(p => p.id === parseInt(e.target.value));
    if (product) handleAddProduct(product);
  };

  const handleQuantityChange = (productId, newQty) => {
    const qty = Math.max(1, parseInt(newQty) || 1);
    const product = products.find(p => p.id === productId);

    if (qty > product.stock) {
      showSnackbar(`Only ${product.stock} in stock`, "warning");
      return;
    }

    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity: qty } : item
    ));
  };

  const incrementQuantity = (productId) => {
    const item = cart.find(item => item.product.id === productId);
    if (item) {
      handleQuantityChange(productId, item.quantity + 1);
    }
  };

  const decrementQuantity = (productId) => {
    const item = cart.find(item => item.product.id === productId);
    if (item && item.quantity > 1) {
      handleQuantityChange(productId, item.quantity - 1);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      return sum + calculateItemPrice(item.product, item.quantity);
    }, 0);
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    pageStyle: `
      @page { 
        size: 80mm auto; 
        margin: 0; 
      }
      @media print {
        body { 
          -webkit-print-color-adjust: exact;
          margin: 0 !important; 
          padding: 0 !important;
        }
      }
    `,
    onBeforeGetContent: () => {
      setIsPrinting(true);
      return Promise.resolve();
    },
    onAfterPrint: () => {
      setIsPrinting(false);
      setTimeout(() => setLastSale(null), 1000);
    },
    onPrintError: (error) => {
      console.error("Print failed:", error);
      setIsPrinting(false);
      showSnackbar("Failed to print receipt", "error");
    }
  });

  const handleCompleteSale = async () => {
    const total = calculateTotal();
    const saleData = {
      total_amount: total,
      paid_amount: parseFloat(paidAmount),
      change_given: changeAmount,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_sale: calculateItemPrice(item.product, item.quantity) / item.quantity // Average unit price
      }))
    };

    // Add customer ID if a customer is selected
    if (selectedCustomer) {
      saleData.customer_id = selectedCustomer.id;
    }

    // OFFLINE MODE: Save sale locally if offline
    if (!isOnline) {
      const offlineId = saveOfflineSale(saleData);
      
      const saleWithDetails = {
          total_amount: total,
          paid_amount: parseFloat(paidAmount),
          change_given: changeAmount,
          items: cart.map(item => ({
            product: {
              ...item.product,
              price: typeof item.product.price === 'string' 
                ? parseFloat(item.product.price) 
                : item.product.price,
              name: item.product.name
            },
            quantity: item.quantity,
            price_at_sale: calculateItemPrice(item.product, item.quantity) / item.quantity
          })),
          timestamp: new Date().toLocaleString(),
          customer: selectedCustomer ? {
            ...selectedCustomer,
            loyalty_points: parseInt(selectedCustomer.loyalty_points) || 0
          } : null,
          isOffline: true,
          offline_id: offlineId
        };

      setLastSale(saleWithDetails);
      showSnackbar("✅ Sale saved offline! Connect to internet to sync.", "success");

      // Auto-print receipt for offline sales
      setTimeout(() => {
        if (receiptRef.current) {
          handlePrint();
        }
        
        // Reset form
        setCart([]);
        setPaidAmount("");
        setBarcodeInput("");
        setSelectedCustomer(null);
        localStorage.removeItem('pos-cart');
        if (scannerActive) barcodeRef.current?.focus();
      }, 500);
      
      return;
    }

    // ONLINE MODE: Process sale normally
    try {
      await axiosInstance.post('/sales/', saleData);
      
      const saleWithDetails = {
        total_amount: total,
        paid_amount: parseFloat(paidAmount),
        change_given: changeAmount,
        items: cart.map(item => ({
          product: {
            ...item.product,
            price: typeof item.product.price === 'string' 
              ? parseFloat(item.product.price) 
              : item.product.price,
            name: item.product.name
          },
          quantity: item.quantity,
          price_at_sale: calculateItemPrice(item.product, item.quantity) / item.quantity
        })),
        timestamp: new Date().toLocaleString(),
        customer: selectedCustomer ? {
          ...selectedCustomer,
          loyalty_points: parseInt(selectedCustomer.loyalty_points) || 0
        } : null,
        isOffline: false
      };

      setLastSale(saleWithDetails);
      showSnackbar("✅ Sale completed!" + (selectedCustomer ? ` ${selectedCustomer.name} earned loyalty points!` : ""), "success");

      // Clear session data after successful sale
      localStorage.removeItem('pos-cart');
      localStorage.removeItem('pos-cart-timestamp');

      // Auto-print receipt
      setTimeout(() => {
        if (receiptRef.current) {
          handlePrint();
        }
        
        // Reset form
        setCart([]);
        setPaidAmount("");
        setBarcodeInput("");
        setSelectedCustomer(null);
        if (scannerActive) barcodeRef.current?.focus();
      }, 500);
      
    } catch (err) {
      console.error("Sale failed:", err);
      
      // If online sale fails, save offline as fallback
      if (err.message === "Network Error" || !err.response) {
        const offlineId = saveOfflineSale(saleData);
        showSnackbar("🌐 Network error - sale saved offline", "warning");
        
        const saleWithDetails = {
          ...saleData,
          offline_id: offlineId,
          items: cart.map(item => ({
            product: item.product,
            quantity: item.quantity
          })),
          timestamp: new Date().toLocaleString(),
          customer: selectedCustomer,
          isOffline: true
        };

        setLastSale(saleWithDetails);
        
        setTimeout(() => {
          if (receiptRef.current) {
            handlePrint();
          }
          setCart([]);
          setPaidAmount("");
          setSelectedCustomer(null);
          localStorage.removeItem('pos-cart');
        }, 500);
      } else {
        showSnackbar("❌ Sale could not be completed", "error");
      }
    }
  };

  const clearSessionData = () => {
    localStorage.removeItem('pos-cart');
    localStorage.removeItem('pos-cart-timestamp');
    setCart([]);
    setSelectedCustomer(null);
    showSnackbar('Session data cleared', 'success');
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      showSnackbar('No internet connection', 'warning');
      return;
    }

    try {
      const syncedCount = await syncPendingSales();
      if (syncedCount > 0) {
        showSnackbar(`✅ Synced ${syncedCount} offline sales`, 'success');
        // Refresh products after sync to get updated stock levels
        loadProducts();
      } else {
        showSnackbar('No pending sales to sync', 'info');
      }
    } catch (error) {
      showSnackbar('❌ Sync failed', 'error');
    }
  };

  const clearProductCache = () => {
    localStorage.removeItem('holo_cached_products');
    localStorage.removeItem('holo_products_timestamp');
    showSnackbar('Product cache cleared', 'success');
    loadProducts();
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toString().includes(searchTerm)
  );

  const totalAmount = calculateTotal();

// 🔥 Cart Item Component with Bulk Pricing - Enhanced with discount display
const CartItemRow = ({ item, onQuantityChange, onRemove }) => {
    const product = item.product;
    const totalPrice = calculateItemPrice(product, item.quantity);
    const unitPrice = parseFloat(product.price) || 0;
    const regularPrice = unitPrice * item.quantity;
    
    // Check if any discount is applied
    const hasDiscount = totalPrice < regularPrice;
    const discountAmount = regularPrice - totalPrice;

    return (
      <TableRow key={product.id} hover>
        <TableCell>
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {product.name}
              {product.is_bulk_product && (
                <Chip 
                  label="BULK" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            {product.is_bulk_product && product.bulk_quantity > 1 && (
              <Typography variant="caption" color="textSecondary">
                {product.bulk_quantity} {product.unit_of_measure || 'units'} for ₦{product.bulk_price}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2">
              {product.is_bulk_product ? `₦${(product.unit_price || unitPrice).toFixed(2)}/unit` : `₦${unitPrice.toFixed(2)}`}
            </Typography>
            {product.is_bulk_product && product.bulk_price && (
              <Typography variant="caption" color="primary.main">
                (₦{product.bulk_price} per {product.bulk_quantity})
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton 
              size="small" 
              onClick={() => decrementQuantity(product.id)}
              disabled={item.quantity <= 1}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
              {item.quantity}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => incrementQuantity(product.id)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              ₦{totalPrice.toFixed(2)}
            </Typography>
            {hasDiscount && (
              <Box>
                <Typography variant="caption" color="success.main">
                  <DiscountIcon fontSize="small" sx={{ fontSize: 12, mr: 0.5 }} />
                  Discount: -₦{discountAmount.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block">
                  (Was: ₦{regularPrice.toFixed(2)})
                </Typography>
              </Box>
            )}
            {product.is_bulk_product && item.quantity >= product.bulk_quantity && !hasDiscount && (
              <Typography variant="caption" color="primary.main">
                <DiscountIcon fontSize="small" sx={{ fontSize: 12, mr: 0.5 }} />
                Bulk pricing applied
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <IconButton
            size="small"
            color="error"
            onClick={() => onRemove(product.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  // Keyboard Shortcuts Dialog
  const ShortcutsDialog = () => (
    <Dialog open={showShortcutsDialog} onClose={() => setShowShortcutsDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <KeyboardIcon />
          Keyboard Shortcuts
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>Global Shortcuts</Typography>
            <Typography variant="body2"><strong>Ctrl + Enter:</strong> Complete Sale</Typography>
            <Typography variant="body2"><strong>Ctrl + Delete:</strong> Clear Cart</Typography>
            <Typography variant="body2"><strong>Ctrl + F:</strong> Focus Barcode</Typography>
            <Typography variant="body2"><strong>Ctrl + R:</strong> Refresh Products</Typography>
            <Typography variant="body2"><strong>Ctrl + K:</strong> Show Shortcuts</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>Function Keys</Typography>
            <Typography variant="body2"><strong>F1:</strong> Show Shortcuts</Typography>
            <Typography variant="body2"><strong>F2:</strong> Focus Barcode</Typography>
            <Typography variant="body2"><strong>F5:</strong> Refresh Products</Typography>
            <Typography variant="body2"><strong>Esc:</strong> Clear Cart</Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>Bulk Pricing Features</Typography>
            <Typography variant="body2">
              • Automatic bulk pricing for products marked as bulk<br/>
              • Bulk discounts applied when quantity thresholds are met<br/>
              • Clear labeling for bulk products in cart
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowShortcutsDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Header with Connection Status */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" fontWeight="bold">
                Point of Sale
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
                {cart.length > 0 && ` • Session saved: ${cart.length} items`}
                {selectedCustomer && ` • Customer: ${selectedCustomer.name}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Connection Status */}
              <Tooltip title={isOnline ? "Online - Connected to server" : "Offline - Working locally"}>
                <Chip
                  icon={isOnline ? <OnlineIcon /> : <OfflineIcon />}
                  label={isOnline ? "Online" : "Offline"}
                  color={isOnline ? "success" : "warning"}
                  variant={isOnline ? "filled" : "outlined"}
                />
              </Tooltip>

              {/* Pending Sales Badge */}
              {pendingSales.length > 0 && (
                <Tooltip title={`${pendingSales.length} sales waiting to sync`}>
                  <Badge badgeContent={pendingSales.length} color="error">
                    <IconButton onClick={handleManualSync} color="primary" disabled={!isOnline}>
                      <SyncingIcon />
                    </IconButton>
                  </Badge>
                </Tooltip>
              )}

              {/* Sync Button */}
              {pendingSales.length > 0 && (
                <Tooltip title={`Sync ${pendingSales.length} offline sales`}>
                  <Button 
                    variant="outlined" 
                    color="warning" 
                    onClick={handleManualSync}
                    startIcon={<CloudUploadIcon />}
                    size="small"
                    disabled={!isOnline}
                  >
                    Sync ({pendingSales.length})
                  </Button>
                </Tooltip>
              )}

              <Tooltip title="Refresh Products (Ctrl+R)">
                <IconButton onClick={loadProducts} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Clear Product Cache">
                <IconButton onClick={clearProductCache} color="secondary">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Keyboard Shortcuts (Ctrl+K)">
                <IconButton onClick={() => setShowShortcutsDialog(true)}>
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>

              {cart.length > 0 && (
                <Tooltip title="Clear Session Data">
                  <IconButton onClick={clearSessionData} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Chip 
                icon={<QrCodeScannerIcon />}
                label={scannerActive ? "Scanner Active" : "Scanner Inactive"}
                color={scannerActive ? "success" : "default"}
                onClick={() => setScannerActive(!scannerActive)}
                variant={scannerActive ? "filled" : "outlined"}
              />
            </Box>
          </Box>

          {/* Offline Warning Banner */}
          {!isOnline && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleManualSync}>
                  Try Sync
                </Button>
              }
            >
              You are currently offline. Sales will be saved locally and synced when connection is restored.
              {pendingSales.length > 0 && ` ${pendingSales.length} sales pending sync.`}
            </Alert>
          )}
        </Grid>

        {/* Main Content Area */}
        <Grid container spacing={3} sx={{ width: '100%', margin: 0 }}>
          {/* Product Selection Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Product Selection
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Focus barcode (Ctrl+F)">
                      <Chip 
                        icon={<QrCodeScannerIcon />} 
                        label="Focus" 
                        size="small" 
                        onClick={() => barcodeRef.current?.focus()}
                        variant="outlined"
                      />
                    </Tooltip>
                    {!isOnline && (
                      <Chip 
                        label="Cached" 
                        size="small" 
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
                
                <TextField
                  inputRef={barcodeRef}
                  label="Scan Barcode"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!scannerActive}
                  placeholder={scannerActive ? "Ready to scan... (Ctrl+F to focus)" : "Scanner disabled"}
                  InputProps={{
                    endAdornment: scannerActive && <QrCodeScannerIcon color="action" />
                  }}
                />

                <TextField
                  label="Search Products"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Quick Access ({products.length} products loaded)
                </Typography>
                <Grid container spacing={1} sx={{ mb: 3 }}>
                  {quickProducts.map(product => (
                    <Grid item xs={6} key={product.id}>
                      <Card 
                        variant="outlined"
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          textAlign: 'center',
                          p: 1
                        }}
                        onClick={() => handleAddProduct(product)}
                      >
                        <Typography variant="body2" noWrap title={product.name}>
                          {product.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.is_bulk_product ? 
                            `₦${product.bulk_price}/${product.bulk_quantity}` : 
                            `₦${product.price.toFixed(2)}`
                          }
                        </Typography>
                        {product.is_bulk_product && (
                          <Typography variant="caption" display="block" color="primary">
                            Bulk
                          </Typography>
                        )}
                        <Typography variant="caption" display="block" color="text.secondary">
                          Stock: {product.stock}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <TextField
                  select
                  label="Select Product"
                  value={selectedProductId}
                  onChange={handleDropdownChange}
                  fullWidth
                >
                  <MenuItem value="">-- Select Product --</MenuItem>
                  {filteredProducts.map(product => (
                    <MenuItem key={product.id} value={product.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Box>
                          <span>{product.name}</span>
                          {product.is_bulk_product && (
                            <Chip label="BULK" size="small" color="primary" sx={{ ml: 1 }} />
                          )}
                        </Box>
                        <span style={{ color: 'text.secondary' }}>
                          {product.is_bulk_product ? 
                            `₦${product.bulk_price}/${product.bulk_quantity}` : 
                            `₦${product.price.toFixed(2)}`
                          } | Stock: {product.stock}
                        </span>
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </CardContent>
            </Card>
          </Grid>

          {/* Shopping Cart Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Shopping Cart ({cart.length} items)
                  </Typography>
                  {cart.length > 0 && (
                    <Tooltip title="Clear cart (Ctrl+Delete)">
                      <IconButton size="small" onClick={() => setCart([])} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Total</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cart.map(item => (
                        <CartItemRow 
                          key={item.product.id} 
                          item={item}
                          onQuantityChange={handleQuantityChange}
                          onRemove={(productId) => setCart(prev => prev.filter(i => i.product.id !== productId))}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {cart.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary" variant="body2">
                      No items in cart. Scan or select products to start.
                    </Typography>
                  </Box>
                )}
                
                {cart.length > 0 && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" textAlign="center" color="primary">
                      Cart Total: ₦{totalAmount.toFixed(2)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Payment Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 24 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Summary
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h4" color="primary" fontWeight="bold" textAlign="center">
                  ₦{totalAmount.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Total Amount
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Customer Selection Section */}
              <Box sx={{ mb: 2 }}>
                {selectedCustomer ? (
                  <Card variant="outlined" sx={{ bgcolor: 'success.light', borderColor: 'success.main' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <PersonIcon fontSize="small" sx={{ color: 'white' }} />
                            <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                              {selectedCustomer.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
                            📞 {selectedCustomer.phone}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <LoyaltyIcon fontSize="small" sx={{ color: 'white' }} />
                            <Typography variant="caption" sx={{ color: 'white' }}>
                              {selectedCustomer.loyalty_points} loyalty points
                            </Typography>
                          </Box>
                        </Box>
                        <IconButton 
                          size="small" 
                          onClick={handleRemoveCustomer}
                          sx={{ color: 'white' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={() => setCustomerLookupOpen(true)}
                    fullWidth
                    startIcon={<PersonAddIcon />}
                    sx={{ py: 1.5 }}
                  >
                    Add Customer to Sale
                  </Button>
                )}
              </Box>

              <TextField
                label="Amount Paid"
                type="number"
                fullWidth
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                inputProps={{ min: totalAmount }}
                sx={{ mb: 2 }}
                size="small"
              />

              {totalAmount > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Quick Amounts:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {suggestedAmounts.map(amount => (
                      <Chip
                        key={amount}
                        label={`₦${amount.toFixed(2)}`}
                        size="small"
                        onClick={() => setPaidAmount(amount.toString())}
                        variant={parseFloat(paidAmount) === amount ? "filled" : "outlined"}
                        color="primary"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {changeAmount >= 0 && paidAmount && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Change: <strong>₦{changeAmount.toFixed(2)}</strong>
                  </Typography>
                </Alert>
              )}

              {changeAmount < 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Insufficient amount. Short by: <strong>₦{Math.abs(changeAmount).toFixed(2)}</strong>
                  </Typography>
                </Alert>
              )}

              <Tooltip title={cart.length === 0 ? "Add products to cart" : !paidAmount ? "Enter amount paid" : parseFloat(paidAmount) < totalAmount ? "Insufficient payment" : isOnline ? "Complete sale (Ctrl+Enter)" : "Complete sale offline"}>
                <span>
                  <Button
                    variant="contained"
                    color={isOnline ? "primary" : "warning"}
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || !paidAmount || isPrinting || 
                             isNaN(paidAmount) || parseFloat(paidAmount) < totalAmount}
                    fullWidth
                    size="large"
                    startIcon={isPrinting ? <PrintIcon /> : isOnline ? <ReceiptIcon /> : <SaveIcon />}
                    sx={{ py: 1.5 }}
                  >
                    {isPrinting ? "Printing..." : isOnline ? `Complete Sale` : `Complete Sale Offline`}
                  </Button>
                </span>
              </Tooltip>

              {cart.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setCart([])}
                  fullWidth
                  sx={{ mt: 1 }}
                  size="small"
                >
                  Clear Cart (Ctrl+Delete)
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert 
          elevation={6} 
          variant="filled" 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      {/* Hidden receipt for printing */}
      <div style={{ display: "none" }}>
        <Receipt ref={receiptRef} sale={lastSale} />
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsDialog />

      {/* Customer Management Modals */}
      <CustomerLookupModal
        open={customerLookupOpen}
        onClose={() => setCustomerLookupOpen(false)}
        onSelectCustomer={handleSelectCustomer}
        onAddNewCustomer={handleAddNewCustomer}
      />

      <CustomerQuickAddModal
        open={customerQuickAddOpen}
        onClose={() => setCustomerQuickAddOpen(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </Box>
  );
};

export default SalesPage;