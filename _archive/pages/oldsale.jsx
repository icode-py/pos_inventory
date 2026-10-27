import {
  Grid, TextField, MenuItem, Typography, Button, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar
} from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import { useEffect, useState, useRef } from "react";
import axiosInstance from "../utils/axiosInstance";
import { IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";

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

  const receiptRef = useRef();

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    axiosInstance.get("products/")
      .then(res => {
        // Ensure all product prices are numbers
        const productsWithNumericPrices = res.data.map(product => ({
          ...product,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price
        }));
        setProducts(productsWithNumericPrices);
      })
      .catch(err => {
        console.error("Failed to load products", err);
        showSnackbar("Failed to load products", "error");
      });
  }, []);

  useEffect(() => {
    document.getElementById("barcode-input")?.focus();
  }, []);

  const handleAddProduct = (product) => {
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
      // Ensure price is a number when adding to cart
      const productWithNumericPrice = {
        ...product,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price
      };
      setCart(prev => [...prev, { product: productWithNumericPrice, quantity: 1 }]);
    }

    setSelectedProductId("");
    setBarcodeInput("");
    showSnackbar(`Added ${product.name} to cart`, "success");
  };

  const handleBarcodeEnter = (e) => {
    if (e.key === "Enter") {
      const product = products.find(p => p.barcode === barcodeInput.trim());
      product 
        ? handleAddProduct(product)
        : showSnackbar("Product not found", "error");
    }
  };

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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      // Ensure price is treated as a number
      const price = typeof item.product.price === 'string' 
        ? parseFloat(item.product.price) 
        : item.product.price;
      return sum + price * item.quantity;
    }, 0);
  };

  // Create print handler that uses the receiptRef
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
      console.log("Preparing receipt for printing...");
      setIsPrinting(true);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 500); // Give a little time for the receipt to render
      });
    },
    onAfterPrint: () => {
      console.log("Print completed");
      setIsPrinting(false);
      setLastSale(null); // Clear receipt
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
      change_given: parseFloat(paidAmount) - total,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_sale: item.product.price
      }))
    };

    try {
      // 1. Save the sale
      await axiosInstance.post('/sales/', saleData);
      
      // 2. Prepare receipt data with numeric prices
      const saleWithDetails = {
        total,
        paidAmount: parseFloat(paidAmount),
        items: cart.map(item => ({
          product: {
            ...item.product,
            price: typeof item.product.price === 'string' 
              ? parseFloat(item.product.price) 
              : item.product.price
          },
          quantity: item.quantity
        }))
      };

      // 3. Update state and wait for it to complete
      setLastSale(saleWithDetails);
      showSnackbar("Sale completed!", "success");

      // 4. Wait for state to update and receipt to render
      setTimeout(() => {
        try {
          if (receiptRef.current) {
            console.log("Printing receipt...");
            handlePrint();
          } else {
            console.error("Receipt ref not found");
            showSnackbar("Receipt preparation failed", "error");
          }
        } catch (printError) {
          console.error("Print error:", printError);
          showSnackbar("Print failed", "error");
        }
        
        // Reset form
        setCart([]);
        setPaidAmount("");
      }, 1000); // Give enough time for the receipt to render
      
    } catch (err) {
      console.error("Sale failed:", err);
      showSnackbar("Sale could not be completed", "error");
    }
  };

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            id="barcode-input"
            label="Scan Barcode"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            select
            label="Select Product"
            value={selectedProductId}
            onChange={handleDropdownChange}
            fullWidth
          >
            <MenuItem value="">-- Select Product --</MenuItem>
            {products.map(product => (
              <MenuItem key={product.id} value={product.id}>
                {product.name} (₦{parseFloat(product.price).toFixed(2)}, Stock: {product.stock})
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Subtotal</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.map(item => (
                  <TableRow key={item.product.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>₦{parseFloat(item.product.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product.id, e.target.value)}
                        inputProps={{ min: 1, max: item.product.stock }}
                        style={{ width: 60 }}
                      />
                    </TableCell>
                    <TableCell>₦{(parseFloat(item.product.price) * item.quantity).toFixed(2)}</TableCell>
                    <TableCell>
                      <IconButton
                        color="error"
                        onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="h6">
            Total: ₦{calculateTotal().toFixed(2)}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Amount Paid"
            type="number"
            fullWidth
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            inputProps={{ min: calculateTotal() }}
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || !paidAmount || isPrinting ||isNaN(paidAmount) || parseFloat(paidAmount) < calculateTotal()}
            fullWidth
            size="large"
          >
            {isPrinting ? "Printing Receipt..." : "Complete Sale"}
          </Button>
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
    </>
  );
};

export default SalesPage;