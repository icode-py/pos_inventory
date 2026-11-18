import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Collapse, Grid, LinearProgress, Paper, Typography, useTheme,
} from "@mui/material";
import {
  ArrowBack as BackIcon, Loyalty as PointsIcon, Payments as SpentIcon, Repeat as VisitsIcon, ShoppingBasket as AvgIcon,
  WhatsApp as WhatsAppIcon, ReceiptLong as HistoryIcon, Person as PersonIcon, ExpandMore as MoreIcon,
} from "@mui/icons-material";
import axiosInstance from "../utils/axiosInstance";
import { useStore } from "../context/StoreContext";
import { loyaltyRules, loyaltyTier } from "../utils/loyalty";
import { toWhatsAppNumber } from "../utils/receiptText";
import { BRAND_GRADIENT, EmptyState, Section, StatTile, count, initials, naira, timeAgo } from "../components/PagePieces";

const PAY = { CASH: "Cash", TRANSFER: "Transfer", POS: "POS", SPLIT: "Split" };

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { store } = useStore();
  const rules = loyaltyRules(store);
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, h] = await Promise.all([
        axiosInstance.get(`/customers/${id}/`),
        axiosInstance.get("/customer-transactions/", { params: { customer_id: id } }),
      ]);
      setCustomer(c.data);
      setHistory(h.data);
    } catch (err) {
      setError(err.response?.status === 404 ? "Customer not found" : "Could not load this customer");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>;
  if (error || !customer) {
    return (
      <Box sx={{ p: 2 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate("/customers")}>Customers</Button>
        <Alert severity="error" sx={{ mt: 2 }}>{error || "Customer not found"}</Alert>
      </Box>
    );
  }

  const tier = loyaltyTier(customer.loyalty_points, store);
  const avg = customer.total_visits ? Number(customer.total_spent) / customer.total_visits : 0;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate("/customers")} sx={{ mb: 1 }}>Customers</Button>

      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 4, background: BRAND_GRADIENT, color: "#fff" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Avatar sx={{ width: 60, height: 60, fontSize: 22, fontWeight: 800, bgcolor: "rgba(255,255,255,0.22)" }}>{initials(customer.name)}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} noWrap>{customer.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Customer since {new Date(customer.created_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" })} · last visit {timeAgo(customer.last_visit)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
            <Chip label={tier.label} sx={{ fontWeight: 800, bgcolor: "#fff", color: tier.color }} />
            <Button size="small" variant="contained" startIcon={<WhatsAppIcon />} href={`https://wa.me/${toWhatsAppNumber(customer.phone)}`} target="_blank"
              sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebe5a" } }}>WhatsApp</Button>
          </Box>
        </Box>
        {rules.enabled && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={Math.min(tier.progress, 100)} sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.25)", "& .MuiLinearProgress-bar": { bgcolor: "#fff" } }} />
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {tier.next ? `${count(tier.next.needed)} more points to ${tier.next.label}` : "Top tier reached"}
            </Typography>
          </Box>
        )}
      </Paper>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Points" value={count(customer.loyalty_points)} note={`worth ${naira(customer.loyalty_points * rules.pointValue)}`} icon={PointsIcon} color={theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Spent" value={naira(customer.total_spent)} note="all time" icon={SpentIcon} color={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Visits" value={count(customer.total_visits)} note="purchases" icon={VisitsIcon} color={theme.palette.info.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Avg. spend" value={naira(avg)} note="per visit" icon={AvgIcon} color={theme.palette.secondary.main} /></Grid>
      </Grid>

      {customer.notes && (
        <Alert icon={<PersonIcon />} severity="info" sx={{ mb: 2 }}>{customer.notes}</Alert>
      )}

      <Section title={`Purchase history (${count(history.length)})`} icon={HistoryIcon} color={theme.palette.info.main}>
        {history.length === 0 ? <EmptyState icon={HistoryIcon}>No purchases yet.</EmptyState> : history.map((t) => {
          const sale = t.sale_details || {};
          const items = sale.items || [];
          return (
            <Box key={t.id} sx={{ borderBottom: 1, borderColor: "divider", py: 1 }}>
              <Box onClick={() => setOpen(open === t.id ? null : t.id)} sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>{naira(sale.total_amount, 2)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(t.created_at).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    {` · ${items.reduce((n, i) => n + i.quantity, 0)} items`}{sale.payment_method ? ` · ${PAY[sale.payment_method] || sale.payment_method}` : ""}
                  </Typography>
                </Box>
                {t.points_redeemed > 0 && <Chip size="small" color="warning" variant="outlined" label={`-${count(t.points_redeemed)} pts`} />}
                {t.points_earned > 0 && <Chip size="small" color="success" variant="outlined" label={`+${count(t.points_earned)} pts`} />}
                <MoreIcon sx={{ color: "text.disabled", transform: open === t.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </Box>
              <Collapse in={open === t.id}>
                <Box sx={{ pl: 1, pt: 1 }}>
                  {items.map((i) => (
                    <Box key={i.id} sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
                      <Typography variant="caption">{i.quantity} × {i.product?.name}</Typography>
                      <Typography variant="caption" fontWeight={700}>{naira(i.quantity * Number(i.price_at_sale), 2)}</Typography>
                    </Box>
                  ))}
                  {Number(sale.points_discount) > 0 && (
                    <Typography variant="caption" color="success.main">Points discount: -{naira(sale.points_discount, 2)}</Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Section>
    </Box>
  );
}
