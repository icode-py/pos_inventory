import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Paper, Tab, Tabs, TextField, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  RateReview as ReviewIcon, Inventory2 as StockIcon, PriceChange as PriceIcon, Loyalty as PointsIcon, HelpOutline as OtherIcon,
  CheckCircle as ApproveIcon, Block as DismissIcon, History as HistoryIcon,
} from "@mui/icons-material";
import axiosInstance from "../utils/axiosInstance";
import { EmptyState, IconBadge, PageHeader, naira } from "../components/PagePieces";

const PAY = { CASH: "Cash", TRANSFER: "Transfer", POS: "POS card", SPLIT: "Split" };
const errorText = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== "object") return err.response ? "Something went wrong" : "No connection";
  return Object.values(d).flat(Infinity).map(String).join(" ");
};

export default function RefusedSalesPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");

  const KINDS = {
    stock: { label: "Not enough stock", icon: StockIcon, color: theme.palette.warning.main,
      explain: "The till sold more than the server had in stock. Recording it sets those products to zero; check the shelf afterwards." },
    price: { label: "Below the listed price", icon: PriceIcon, color: theme.palette.error.main,
      explain: "The till charged less than the current price, often because it was offline when prices changed. Record it if the customer really paid this." },
    points: { label: "Loyalty points", icon: PointsIcon, color: theme.palette.secondary.main,
      explain: "The customer used points they no longer had by the time the sale synced." },
    other: { label: "Needs a decision", icon: OtherIcon, color: theme.palette.grey[600], explain: "" },
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, h] = await Promise.all([axiosInstance.get("refused-sales/"), axiosInstance.get("refused-sales/", { params: { status: "reviewed" } })]);
      setPending(p.data);
      setHistory(h.data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (sale, action) => {
    const question = action === "approve"
      ? "Record this sale as it happened? It will count in Reports and take the stock."
      : "Dismiss this sale? It won't be recorded and stock won't change. Only do this if the money was returned or the sale didn't happen.";
    if (!window.confirm(question)) return;
    setBusy(sale.id);
    setError("");
    try {
      await axiosInstance.post(`refused-sales/${sale.id}/${action}/`, { note: notes[sale.id] || "" });
      window.dispatchEvent(new Event("refused-sales-changed"));
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const itemsTable = (sale) => (
    <Box sx={{ mt: 1 }}>
      {sale.items.map((it, i) => {
        const cheap = it.listed != null && it.charged + 1 < it.listed;
        const short = it.stock != null && it.stock < it.quantity;
        return (
          <Box key={i} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{it.quantity} × {it.name}</Typography>
              {it.stock != null && <Typography variant="caption" color={short ? "warning.main" : "text.secondary"} fontWeight={short ? 700 : 400}>{it.stock} in stock now</Typography>}
            </Box>
            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography variant="body2" fontWeight={700} color={cheap ? "error.main" : "text.primary"}>{naira(it.charged, 2)}</Typography>
              {it.listed != null && <Typography variant="caption" color="text.secondary">listed {naira(it.listed, 2)}</Typography>}
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  const meta = (sale) => [
    `Sold ${new Date(sale.sold_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`,
    `by ${sale.cashier || "a removed staff member"}`,
    PAY[sale.payment_method] || sale.payment_method,
    sale.customer_name && `customer ${sale.customer_name}`,
  ].filter(Boolean).join(" · ");

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1000, mx: "auto" }}>
      <PageHeader icon={ReviewIcon} title="Sale reviews" onRefresh={load} loading={loading}
        subtitle="Offline sales the server couldn't accept when they synced. The customer already paid, so decide what happens to each one." />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Waiting (${pending.length})`} icon={<ReviewIcon fontSize="small" />} iconPosition="start" />
        <Tab label="History" icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {loading && <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress /></Box>}

      {!loading && tab === 0 && (pending.length === 0 ? (
        <Card><EmptyState icon={ApproveIcon} title="Nothing to review">Every offline sale was accepted.</EmptyState></Card>
      ) : pending.map((sale) => {
        const k = KINDS[sale.kind] || KINDS.other;
        return (
          <Card key={sale.id} sx={{ mb: 2, borderLeft: 5, borderLeftColor: k.color }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
                <IconBadge icon={k.icon} color={k.color} size={38} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>{naira(sale.total_amount, 2)}</Typography>
                  <Typography variant="caption" color="text.secondary">{meta(sale)}</Typography>
                </Box>
                <Chip size="small" label={k.label} sx={{ fontWeight: 700, bgcolor: alpha(k.color, 0.14), color: k.color }} />
              </Box>
              {k.explain && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{k.explain}</Typography>}
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: alpha(k.color, 0.05), borderColor: alpha(k.color, 0.3) }}>
                <Typography variant="caption" color="text.secondary">Server said: {sale.reason}</Typography>
              </Paper>
              {itemsTable(sale)}
              <TextField fullWidth size="small" label="Note (optional)" placeholder="e.g. Checked with Amaka, customer paid ₦2,000"
                value={notes[sale.id] || ""} onChange={(e) => setNotes({ ...notes, [sale.id]: e.target.value })} sx={{ mt: 1.5 }} inputProps={{ maxLength: 200 }} />
              <Grid container spacing={1} sx={{ mt: 1 }}>
                <Grid size={{ xs: 6 }}>
                  <Button fullWidth variant="contained" color="success" startIcon={<ApproveIcon />} disabled={busy === sale.id} onClick={() => decide(sale, "approve")}>Record sale</Button>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Button fullWidth variant="outlined" color="error" startIcon={<DismissIcon />} disabled={busy === sale.id} onClick={() => decide(sale, "dismiss")}>Dismiss</Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );
      }))}

      {!loading && tab === 1 && (history.length === 0 ? (
        <Card><EmptyState icon={HistoryIcon} title="No decisions yet" /></Card>
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            {history.map((sale) => {
              const approved = sale.status === "APPROVED";
              return (
                <Box key={sale.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
                  <IconBadge icon={approved ? ApproveIcon : DismissIcon} color={approved ? theme.palette.success.main : theme.palette.error.main} size={34} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>{naira(sale.total_amount, 2)} · {approved ? "Recorded" : "Dismissed"} by {sale.reviewed_by || "unknown"}</Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {sale.reviewed_at && new Date(sale.reviewed_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {(KINDS[sale.kind] || KINDS.other).label} · {meta(sale)}
                    </Typography>
                    {sale.review_note && <Typography variant="caption" sx={{ fontStyle: "italic" }}>"{sale.review_note}"</Typography>}
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
