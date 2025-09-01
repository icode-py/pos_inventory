import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Container, Typography, Grid, Card, CardContent, Button,
  TextField, Box, Divider
} from "@mui/material";

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");

  useEffect(() => {
    axiosInstance.get("products/")
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);

  const addToCart = (product) => {
    const exists = cart.find(item => item.product.id === product.id);
    if (exists) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, price: product.price }]);
    }
  };

  const handleQuantityChange = (id, qty) => {
    setCart(cart.map(item =>
      item.product.id === id
        ? { ...item, quantity: parseInt(qty) || 1 }
        : item
    ));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.quantity * item.price, 0);
  const change = paidAmount ? paidAmount - totalAmount : 0;

  const submitSale = () => {
    const payload = {
      total_amount: totalAmount,
      paid_amount: paidAmount,
      change_given: change,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_sale: item.price
      }))
    };

    axiosInstance.post("sales/", payload)
      .then(res => {
        alert("Sale successful!");
        setCart([]);
        setPaidAmount("");
      })
      .catch(err => {
        console.error(err);
        alert("Failed to complete sale.");
      });
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Sales Dashboard
        </Typography>

        <Grid container spacing={3}>
          {/* Products */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Products</Typography>
            <Grid container spacing={2}>
              {products.map(product => (
                <Grid item xs={6} sm={4} key={product.id}>
                  <Card>
                    <CardContent>
                      <Typography>{product.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ₦{product.price}
                      </Typography>
                      <Button
                        variant="contained"
                        fullWidth
                        sx={{ mt: 1 }}
                        onClick={() => addToCart(product)}
                      >
                        Add
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Cart */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Cart</Typography>
            {cart.map(item => (
              <Box key={item.product.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ flex: 1 }}>
                  {item.product.name} - ₦{item.price}
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={item.quantity}
                  onChange={e => handleQuantityChange(item.product.id, e.target.value)}
                  sx={{ width: 60, ml: 2 }}
                />
              </Box>
            ))}
            <Divider sx={{ my: 2 }} />

            <Typography>Total: ₦{totalAmount.toFixed(2)}</Typography>
            <TextField
              label="Amount Paid"
              type="number"
              fullWidth
              sx={{ my: 2 }}
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
            />
            <Typography>Change: ₦{change.toFixed(2)}</Typography>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2 }}
              onClick={submitSale}
              disabled={!cart.length || !paidAmount}
            >
              Complete Sale
            </Button>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
}

export default Dashboard;
