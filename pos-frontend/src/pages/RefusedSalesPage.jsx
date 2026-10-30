import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography
} from "@mui/material";

const formatCurrency = (amount) => `₦${parseFloat(amount || 0).toLocaleString('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const errorMessage = (err) => {
  const data = err.response?.data;
  if (typeof data === 'string' || !data) return 'Something went wrong. Please try again.';
  return Object.values(data).flat(Infinity).map(String).join(' ');
};

export default function RefusedSalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await axiosInstance.get('refused-sales/');
      setSales(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (sale, action, question) => {
    if (!window.confirm(question)) return;
    setBusyId(sale.id);
    setError('');
    try {
      await axiosInstance.post(`refused-sales/${sale.id}/${action}/`);
      window.dispatchEvent(new Event('refused-sales-changed'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
      load();
    }
  };

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', md: '1.5rem' }, mb: 1 }}>
        Sale Reviews
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These sales were made offline, but the server could not accept them when they synced.
        The customer has already paid, so please decide what happens to each one.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : sales.length === 0 ? (
        <Alert severity="success">No sales are waiting for review.</Alert>
      ) : (
        <Stack spacing={2}>
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{formatCurrency(sale.total_amount)}</Typography>
                  <Chip label="Needs review" color="warning" size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Sold {new Date(sale.sold_at).toLocaleString('en-NG')} by {sale.cashier || 'a removed staff member'}
                </Typography>
                <Alert severity="warning" sx={{ my: 1.5 }}>{sale.reason}</Alert>
                {sale.items.map((item, index) => (
                  <Box key={index} display="flex" justifyContent="space-between" gap={2} py={0.5}>
                    <Typography variant="body2">{item.quantity} × {item.name}</Typography>
                    {item.stock !== null && (
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {item.stock} in stock
                      </Typography>
                    )}
                  </Box>
                ))}
                <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
                  <Button
                    variant="contained"
                    disabled={busyId === sale.id}
                    onClick={() => decide(sale, 'approve', 'Record this sale? Any product that runs short will stop at zero stock.')}
                  >
                    Record sale
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={busyId === sale.id}
                    onClick={() => decide(sale, 'dismiss', 'Dismiss this sale? It will not be recorded and stock will not change.')}
                  >
                    Dismiss
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
