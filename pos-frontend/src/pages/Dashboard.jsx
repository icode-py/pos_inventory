import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Grid, IconButton, Paper, Skeleton, Tooltip, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip as ChartTooltip,
} from "chart.js";
import {
  Refresh as RefreshIcon, PointOfSale as SellIcon, LocalShipping as RestockIcon, Assessment as ReportsIcon,
  Savings as ProfitIcon, ReceiptLong as ReceiptIcon, ShoppingCart as CartIcon,
  ArrowUpward, ArrowDownward, Lock as LockIcon, Payments as CashIcon, AccountBalance as BankIcon,
  CreditCard as CardIcon, HelpOutline as UnknownIcon, RateReview as ReviewIcon, CloudUpload as SyncIcon,
  RemoveShoppingCart as OutIcon, WarningAmber as WarningIcon, TrendingDown as LossIcon, CheckCircle as OkIcon,
  EmojiEvents as TrophyIcon, ChevronRight as ChevronIcon, Wallet as WalletIcon, FactCheck as CountIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useOffline } from "../context/OfflineManager";
import { useStore } from "../context/StoreContext";
import axiosInstance from "../utils/axiosInstance";
import { fetchProducts, readCachedProducts } from "../utils/productCache";
import { lowStockLevel } from "../utils/loyalty";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, ChartTooltip);

const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const MEDALS = ["#F5B700", "#A0AEC0", "#CD7F32"];
const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const count = (n) => Number(n || 0).toLocaleString("en-NG");
const plural = (n, w) => `${count(n)} ${w}${Number(n) === 1 ? "" : "s"}`;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};
const PAY = { CASH: "Cash", TRANSFER: "Transfer", POS: "POS", SPLIT: "Split" };

// ── Pieces ───────────────────────────────────────────────────────────────────
function IconBadge({ icon: Icon, color, size = 34 }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: size > 32 ? 2.5 : 2, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.14), color }}>
      <Icon sx={{ fontSize: Math.round(size * 0.55) }} />
    </Box>
  );
}

function ChangePill({ pct, onBrand }) {
  const theme = useTheme();
  if (pct === null || pct === undefined) {
    return <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>Nothing to compare yet</Typography>;
  }
  const color = pct === 0 ? theme.palette.text.secondary : pct > 0 ? theme.palette.success.main : theme.palette.error.main;
  const Icon = pct >= 0 ? ArrowUpward : ArrowDownward;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.15, borderRadius: 999,
      bgcolor: onBrand ? "rgba(255,255,255,0.22)" : alpha(color, 0.12), color: onBrand ? "#fff" : color }}>
      <Icon sx={{ fontSize: 13 }} />
      <Typography variant="caption" fontWeight={700}>{Math.abs(pct).toFixed(1)}%</Typography>
    </Box>
  );
}

function Hero({ label, value, pct, compareText, subtitle, spark, loading, onClick }) {
  return (
    <Card onClick={onClick} sx={{ height: "100%", background: BRAND_GRADIENT, color: "#fff", position: "relative", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}>
      <Box sx={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)", top: -60, right: -40 }} />
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } }, position: "relative" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, opacity: 0.9 }}>{label}</Typography>
            {loading ? <Skeleton width={160} height={50} sx={{ bgcolor: "rgba(255,255,255,0.2)" }} /> : (
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.9rem", sm: "2.2rem" }, lineHeight: 1.15, letterSpacing: "-0.5px" }}>{value}</Typography>
            )}
          </Box>
          <Box sx={{ width: 42, height: 42, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }}><SellIcon /></Box>
        </Box>
        {!loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mt: 0.75 }}>
            {compareText !== undefined && <ChangePill pct={pct} onBrand />}
            {compareText && pct != null && <Typography variant="caption" sx={{ opacity: 0.9 }}>{compareText}</Typography>}
          </Box>
        )}
        {subtitle && <Typography variant="caption" display="block" sx={{ opacity: 0.85, mt: 0.25 }}>{subtitle}</Typography>}
        {spark?.some((v) => v > 0) && (
          <Box sx={{ height: 46, mt: 1, mx: -0.5 }}>
            <Line data={{ labels: spark.map((_, i) => i), datasets: [{ data: spark, borderColor: "rgba(255,255,255,0.95)", backgroundColor: "rgba(255,255,255,0.18)", fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] }}
              options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, icon, color, pct, note, locked, loading }) {
  return (
    <Card sx={{ height: "100%", backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, transparent 60%)` }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, pt: 0.5 }}>{label}</Typography>
          <IconBadge icon={icon} color={color} size={32} />
        </Box>
        {loading ? <Skeleton width="70%" height={36} /> : locked ? (
          <Box sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LockIcon sx={{ fontSize: 18 }} color="disabled" />
              <Typography variant="body2" fontWeight={700} color="text.secondary">Business plan</Typography>
            </Box>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.25, mt: 0.5, overflowWrap: "anywhere" }}>{value}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              {pct !== undefined && <ChangePill pct={pct} />}
              {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, icon, color, action, children }) {
  const theme = useTheme();
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.25, gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <IconBadge icon={icon} color={color || theme.palette.primary.main} size={30} />
            <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ icon, color, title, sub, right, onClick, lead }) {
  return (
    <Box onClick={onClick} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1, px: 0.5, borderRadius: 2, cursor: onClick ? "pointer" : "default",
      "&:hover": onClick ? { bgcolor: "action.hover" } : {} }}>
      {lead}
      {icon && <IconBadge icon={icon} color={color} size={32} />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} noWrap>{title}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" component="div" noWrap>{sub}</Typography>}
      </Box>
      {right}
      {onClick && <ChevronIcon sx={{ color: "text.disabled" }} />}
    </Box>
  );
}

const SectionError = ({ children = "Couldn't load this part. Pull to refresh or tap the refresh button." }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>{children}</Typography>
);

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { store } = useStore();
  const { pendingSales, isOnline } = useOffline();
  const isManager = user?.role === "manager" || user?.role === "admin";
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const today = ymd(new Date());
    const jobs = isManager ? {
      today: axiosInstance.get("analytics/", { params: { start_date: today, end_date: today } }),
      stock: axiosInstance.get("analytics/stock/"),
      recent: axiosInstance.get("sales/", { params: { today: 1, limit: 5 } }),
      reviews: axiosInstance.get("refused-sales/"),
    } : {
      mine: axiosInstance.get("user-today-performance/"),
      recent: axiosInstance.get("sales/", { params: { today: 1, limit: 5 } }),
      // Stock warnings come from the products saved for the till; fetch them if this device has none yet
      products: readCachedProducts() ? Promise.resolve({ data: readCachedProducts() }) : fetchProducts().then((list) => ({ data: list })),
    };
    const keys = Object.keys(jobs);
    const results = await Promise.allSettled(Object.values(jobs));
    const next = {};
    const errs = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") next[keys[i]] = r.value.data;
      else errs[keys[i]] = true;
    });
    setData(next);
    setFailed(errs);
    setLoading(false);
  }, [isManager]);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user?.first_name || user?.username;
  const allOffline = !isOnline && Object.keys(failed).length > 0;

  const header = (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.25rem", md: "1.6rem" }, lineHeight: 1.2 }}>{greeting}, {name} 👋</Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}{store?.name ? ` · ${store.name}` : ""}
        </Typography>
      </Box>
      <Tooltip title="Refresh"><span><IconButton onClick={load} disabled={loading} color="primary"><RefreshIcon /></IconButton></span></Tooltip>
    </Box>
  );

  const recentList = (rows) => (
    !rows ? <SectionError /> : rows.length === 0 ? (
      <SectionError>No sales yet today.</SectionError>
    ) : rows.map((s) => (
      <Row key={s.id} icon={ReceiptIcon} color={theme.palette.info.main}
        title={naira(s.total_amount)}
        sub={`${ago(s.created_at)} · ${plural(s.items?.reduce((n, i) => n + i.quantity, 0) || 0, "item")}${isManager && s.cashier ? ` · ${s.cashier}` : ""}${s.customer_name ? ` · ${s.customer_name}` : ""}`}
        right={s.payment_method ? <Chip size="small" variant="outlined" label={PAY[s.payment_method] || s.payment_method} /> : null} />
    ))
  );

  // ── Cashier view ─────────────────────────────────────────────────────────
  if (!isManager) {
    const mine = data.mine;
    const cached = data.products || readCachedProducts() || [];
    const out = cached.filter((p) => p.stock === 0);
    const low = cached.filter((p) => p.stock > 0 && p.stock <= lowStockLevel(store));
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
        {header}
        {allOffline && <Alert severity="warning" sx={{ mb: 2 }}>Offline. You can keep selling; totals update when you're back online.</Alert>}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Hero label="My sales today" loading={loading} value={naira(mine?.total_sales)}
              subtitle={mine ? `${plural(mine.transaction_count, "sale")} · avg ${naira(mine.average_sale)}` : failed.mine ? "Couldn't load" : ""} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Button fullWidth variant="contained" onClick={() => navigate("/salespage")} startIcon={<SellIcon sx={{ fontSize: "32px !important" }} />}
              sx={{ height: "100%", minHeight: 110, fontSize: 22, fontWeight: 800, borderRadius: 4, background: BRAND_GRADIENT }}>
              Start selling
            </Button>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Section title="Needs attention" icon={WarningIcon} color={theme.palette.warning.main}>
              {pendingSales.length > 0 && <Row icon={SyncIcon} color={theme.palette.info.main} title={`${plural(pendingSales.length, "sale")} waiting to sync`}
                sub={isOnline ? "Open Sell and tap Sync" : "They'll sync when you're back online"} onClick={() => navigate("/salespage")} />}
              {out.length > 0 && <Row icon={OutIcon} color={theme.palette.error.main} title={`${plural(out.length, "product")} out of stock`}
                sub={out.slice(0, 3).map((p) => p.name).join(", ") + (out.length > 3 ? "…" : "") + " · tell your manager"} />}
              {low.length > 0 && <Row icon={WarningIcon} color={theme.palette.warning.main} title={`${plural(low.length, "product")} almost finished`}
                sub={low.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", ")} />}
              {!pendingSales.length && !out.length && !low.length && <Row icon={OkIcon} color={theme.palette.success.main} title="All good" sub="Nothing needs your attention" />}
            </Section>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Section title="My recent sales" icon={ReceiptIcon} color={theme.palette.info.main}>
              {loading ? <Skeleton height={120} /> : recentList(data.recent)}
            </Section>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // ── Owner / manager view ────────────────────────────────────────────────
  const t = data.today;
  const s = t?.summary;
  const c = t?.change_pct || {};
  const canProfit = !!t?.can_view_profit;
  const stock = data.stock;
  const reviews = Array.isArray(data.reviews) ? data.reviews.length : 0;
  const lost = t?.stock_loss?.total || 0;
  const pay = t?.payments;
  const share = (v) => (s?.revenue ? (v / s.revenue) * 100 : 0);
  const restock = stock ? [...stock.out_of_stock_selling.map((x) => ({ ...x, urgent: true, note: "Out of stock" })),
    ...stock.running_out.map((x) => ({ ...x, urgent: x.days_left <= 3, note: `${count(x.stock)} left · ~${Math.max(Math.round(x.days_left), 1)}d` }))].slice(0, 5) : [];

  const attention = [
    reviews > 0 && { icon: ReviewIcon, color: theme.palette.secondary.main, title: `${plural(reviews, "sale")} waiting for review`, sub: "Offline sales the server held back", go: "/sale-reviews" },
    pendingSales.length > 0 && { icon: SyncIcon, color: theme.palette.info.main, title: `${plural(pendingSales.length, "sale")} on this device not synced`, sub: isOnline ? "Open Sell to sync" : "Will sync when online", go: "/salespage" },
    stock?.totals.out_of_stock > 0 && { icon: OutIcon, color: theme.palette.error.main, title: `${plural(stock.totals.out_of_stock, "product")} out of stock`,
      sub: stock.missed_per_day_total > 0 ? `About ${naira(stock.missed_per_day_total)} in sales missed a day` : "Restock or archive them", go: "/restock" },
    stock?.running_out_count > 0 && { icon: WarningIcon, color: theme.palette.warning.main, title: `${plural(stock.running_out_count, "product")} running out soon`, sub: "Within 14 days at today's pace", go: "/restock" },
    lost > 0 && { icon: LossIcon, color: theme.palette.error.main, title: `${naira(lost)} of stock lost today`, sub: t.stock_loss.by_reason.map((r) => r.label).join(", "), go: "/reports/sales" },
  ].filter(Boolean);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {header}
      {allOffline && <Alert severity="warning" sx={{ mb: 2 }}>Offline. These figures update when you're back online.</Alert>}

      {/* Today */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Hero label="Sales today" loading={loading} value={failed.today ? "—" : naira(s?.revenue)} pct={c.revenue}
            compareText="vs this time yesterday" onClick={() => navigate("/reports/sales")}
            subtitle={s ? `${plural(s.transactions, "transaction")} · ${plural(s.items, "item")}` : failed.today ? "Couldn't load" : ""}
            spark={t?.hourly?.filter((h) => h.hour >= 7 && h.hour <= 22).map((h) => h.revenue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={1.5} sx={{ height: "100%" }}>
            <Grid size={{ xs: 6, md: 4 }}>
              <Kpi label="Profit" icon={ProfitIcon} color={theme.palette.success.main} loading={loading} locked={!canProfit && !!t}
                value={naira(s?.profit)} pct={c.profit} note={s?.margin_pct != null ? `${s.margin_pct}% margin` : ""} />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Kpi label="Transactions" icon={ReceiptIcon} color={theme.palette.info.main} loading={loading} value={count(s?.transactions)} pct={c.transactions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Kpi label="Avg. sale" icon={CartIcon} color={theme.palette.secondary.main} loading={loading} value={naira(s?.average_sale)} pct={c.average_sale} />
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Needs attention */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Needs attention" icon={WarningIcon} color={theme.palette.warning.main}>
            {loading ? <Skeleton height={120} /> : attention.length === 0 ? (
              <Row icon={OkIcon} color={theme.palette.success.main} title="All good" sub="No reviews, stock problems or losses right now" />
            ) : attention.map((a) => <Row key={a.title} icon={a.icon} color={a.color} title={a.title} sub={a.sub} onClick={() => navigate(a.go)} />)}
          </Section>
        </Grid>

        {/* Money in */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Money in today" icon={WalletIcon} color={theme.palette.success.main}>
            {loading ? <Skeleton height={120} /> : !pay ? <SectionError /> : (
              <Grid container spacing={1}>
                {[["Cash", pay.cash, CashIcon, theme.palette.success.main, "In the drawer"], ["Transfer", pay.transfer, BankIcon, theme.palette.primary.main, "Check bank alerts"],
                  ["POS", pay.card, CardIcon, theme.palette.secondary.main, "Check settlement"],
                  ...(pay.unrecorded > 0 ? [["Not recorded", pay.unrecorded, UnknownIcon, theme.palette.grey[500], "Older app version"]] : [])].map(([label, v, Icon, color, hint]) => (
                  <Grid key={label} size={{ xs: 6, sm: pay.unrecorded > 0 ? 3 : 4, md: 6, lg: pay.unrecorded > 0 ? 3 : 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2.5, height: "100%", borderColor: alpha(color, 0.3), backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, transparent 70%)` }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                        <IconBadge icon={Icon} color={color} size={26} />
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase" }}>{label}</Typography>
                      </Box>
                      <Typography fontWeight={800}>{naira(v)}</Typography>
                      <Typography variant="caption" color="text.secondary">{share(v).toFixed(0)}% · {hint}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Section>
        </Grid>

        {/* Restock soon */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Section title="Restock soon" icon={RestockIcon} color={theme.palette.warning.main}
            action={<Button size="small" onClick={() => navigate("/restock")}>Restock</Button>}>
            {loading ? <Skeleton height={140} /> : !stock ? <SectionError /> : restock.length === 0 ? (
              <SectionError>Nothing is about to run out.</SectionError>
            ) : restock.map((x) => (
              <Row key={x.id} title={x.name} sub={x.note} onClick={() => navigate("/restock")}
                right={<Typography variant="body2" fontWeight={800} color={x.urgent ? "error.main" : "warning.main"}>+{count(x.reorder_qty)}</Typography>} />
            ))}
          </Section>
        </Grid>

        {/* Top sellers today */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Section title="Top sellers today" icon={TrophyIcon} color={MEDALS[0]}
            action={<Button size="small" onClick={() => navigate("/reports/sales")}>Reports</Button>}>
            {loading ? <Skeleton height={140} /> : !t ? <SectionError /> : t.products.length === 0 ? (
              <SectionError>No sales yet today.</SectionError>
            ) : t.products.slice(0, 5).map((p, i) => (
              <Row key={p.id} title={p.name} sub={`${count(p.quantity)} sold`}
                lead={<Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 800, border: i < 3 ? `1.5px solid ${MEDALS[i]}` : "none",
                  bgcolor: i < 3 ? alpha(MEDALS[i], 0.2) : "action.hover", color: i < 3 ? MEDALS[i] : "text.secondary" }}>{i + 1}</Avatar>}
                right={<Typography variant="body2" fontWeight={800}>{naira(p.revenue)}</Typography>} />
            ))}
          </Section>
        </Grid>

        {/* Recent sales */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Section title="Recent sales" icon={ReceiptIcon} color={theme.palette.info.main}
            action={<Button size="small" onClick={() => navigate("/reports/sales")}>All</Button>}>
            {loading ? <Skeleton height={140} /> : recentList(data.recent)}
          </Section>
        </Grid>

        {/* Quick actions */}
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={1.5}>
            {[["Sell", "Open the till", SellIcon, theme.palette.primary.main, "/salespage"],
              ["Restock", "Add a delivery", RestockIcon, theme.palette.warning.main, "/restock"],
              ["Products", "Prices, stock & counts", CountIcon, theme.palette.info.main, "/products"],
              ["Reports", "Sales, profit & stock", ReportsIcon, theme.palette.success.main, "/reports/sales"]].map(([label, sub, Icon, color, go]) => (
              <Grid key={label} size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" onClick={() => navigate(go)} sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25,
                  "&:hover": { bgcolor: alpha(color, 0.06), borderColor: color } }}>
                  <IconBadge icon={Icon} color={color} size={38} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">{sub}</Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
