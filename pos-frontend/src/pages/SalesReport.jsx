import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, IconButton, LinearProgress,
  MenuItem, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler,
  Tooltip as ChartTooltip, Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Lock as LockIcon,
  ArrowUpward, ArrowDownward,
  TrendingUp as TrendingUpIcon, ShowChart as ShowChartIcon, EmojiEvents as TrophyIcon,
  AccountBalanceWallet as WalletIcon, Category as CategoryIcon, Groups as GroupsIcon,
  Schedule as ScheduleIcon, Payments as CashIcon, AccountBalance as BankIcon, CreditCard as CardIcon,
  HelpOutline as UnknownIcon, Inventory2 as InventoryIcon, LocalOffer as TagIcon,
  RemoveShoppingCart as OutOfStockIcon, WarningAmber as WarningIcon, ShoppingCart as CartIcon,
  HourglassEmpty as HourglassIcon, ReceiptLong as ReceiptIcon, PointOfSale as PointOfSaleIcon,
  ShoppingBasket as BasketIcon, Savings as SavingsIcon,
} from "@mui/icons-material";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, ChartTooltip, Legend);

// ── Dates: always the phone's local day (the server reports in Lagos time too) ──
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const PAY_LABELS = { CASH: "Cash", TRANSFER: "Transfer", POS: "POS card", SPLIT: "Split" };

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

function rangeFor(key) {
  const today = new Date();
  switch (key) {
    case "today": return [today, today];
    case "yesterday": { const y = addDays(today, -1); return [y, y]; }
    case "30d": return [addDays(today, -29), today];
    case "month": return [new Date(today.getFullYear(), today.getMonth(), 1), today];
    case "lastmonth": return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
    default: return [addDays(today, -6), today];
  }
}

const naira = (n, decimals = 0) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
const compactNaira = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return `₦${(v / 1e6).toFixed(1)}m`;
  if (Math.abs(v) >= 1e3) return `₦${(v / 1e3).toFixed(0)}k`;
  return `₦${v}`;
};
const count = (n) => Number(n || 0).toLocaleString("en-NG");
const shortDate = (s) => parseYmd(s).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
const hourLabel = (h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);

function rangeText(start, end) {
  if (start === end) return parseYmd(start).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${shortDate(start)} – ${parseYmd(end).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`;
}

// ── Small pieces ─────────────────────────────────────────────────────────────
const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const MEDALS = ["#F5B700", "#A0AEC0", "#CD7F32"];

function IconBadge({ icon: Icon, color, size = 40 }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: size > 34 ? 3 : 2, flexShrink: 0,
      display: "grid", placeItems: "center", bgcolor: alpha(color, 0.14), color,
    }}>
      <Icon sx={{ fontSize: Math.round(size * 0.55) }} />
    </Box>
  );
}

function Change({ pct, previous, onBrand = false }) {
  const theme = useTheme();
  if (pct === null || pct === undefined) {
    return (
      <Typography variant="caption" sx={{ color: onBrand ? "rgba(255,255,255,0.85)" : "text.secondary", fontWeight: 600 }}>
        {previous ? "—" : "New"}
      </Typography>
    );
  }
  const flat = pct === 0;
  const color = flat ? theme.palette.text.secondary : pct > 0 ? theme.palette.success.main : theme.palette.error.main;
  const Icon = pct >= 0 ? ArrowUpward : ArrowDownward;
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.15, borderRadius: 999,
      bgcolor: onBrand ? "rgba(255,255,255,0.22)" : alpha(color, 0.12),
      color: onBrand ? "#fff" : color,
    }}>
      <Icon sx={{ fontSize: 13 }} />
      <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.6 }}>{Math.abs(pct).toFixed(1)}%</Typography>
    </Box>
  );
}

function Kpi({ label, value, icon, color, pct, previousValue, previousText, note, locked }) {
  return (
    <Card sx={{
      height: "100%", position: "relative", overflow: "hidden",
      backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.10)} 0%, transparent 60%)`,
    }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, pt: 0.5 }}>
            {label}
          </Typography>
          <IconBadge icon={icon} color={color} size={34} />
        </Box>
        {locked ? (
          <Box sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LockIcon sx={{ fontSize: 18 }} color="disabled" />
              <Typography variant="body2" fontWeight={700} color="text.secondary">Business plan</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">See profit on every sale</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.5rem" }, lineHeight: 1.25, mt: 0.5, overflowWrap: "anywhere", letterSpacing: "-0.3px" }}>
              {value}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              <Change pct={pct} previous={previousValue} />
              {previousText && <Typography variant="caption" color="text.secondary">vs {previousText}</Typography>}
            </Box>
            {note && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>{note}</Typography>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// The headline card: total sales on the brand gradient, with a small trend line
function HeroKpi({ label, value, pct, previousValue, previousText, subtitle, spark }) {
  return (
    <Card sx={{ height: "100%", background: BRAND_GRADIENT, color: "#fff", position: "relative", overflow: "hidden" }}>
      <Box sx={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)", top: -60, right: -40 }} />
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } }, position: "relative" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, opacity: 0.9 }}>{label}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.9rem", sm: "2.2rem" }, lineHeight: 1.15, letterSpacing: "-0.5px", overflowWrap: "anywhere" }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ width: 42, height: 42, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
            <PointOfSaleIcon />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mt: 0.75 }}>
          <Change pct={pct} previous={previousValue} onBrand />
          {previousText && <Typography variant="caption" sx={{ opacity: 0.9 }}>vs {previousText}</Typography>}
        </Box>
        {subtitle && <Typography variant="caption" display="block" sx={{ opacity: 0.85, mt: 0.25 }}>{subtitle}</Typography>}
        {spark?.length > 1 && (
          <Box sx={{ height: 44, mt: 1, mx: -0.5 }}>
            <Line
              data={{ labels: spark.map((_, i) => i), datasets: [{ data: spark, borderColor: "rgba(255,255,255,0.95)", backgroundColor: "rgba(255,255,255,0.18)", fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] }}
              options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }}
            />
          </Box>
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
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            {icon && <IconBadge icon={icon} color={color || theme.palette.primary.main} size={32} />}
            <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function ShareBar({ label, sub, value, share, color, rank }) {
  const theme = useTheme();
  return (
    <Box sx={{ mb: 1.75, display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      {rank !== undefined && (
        <Box sx={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", mt: 0.1,
          fontSize: 12, fontWeight: 800,
          bgcolor: rank < 3 ? alpha(MEDALS[rank], 0.2) : alpha(theme.palette.text.primary, 0.06),
          color: rank < 3 ? (rank === 1 ? theme.palette.text.secondary : MEDALS[rank]) : "text.secondary",
          border: rank < 3 ? `1.5px solid ${MEDALS[rank]}` : "none",
        }}>
          {rank + 1}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0 }}>{label}</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>{value}</Typography>
        </Box>
        <LinearProgress variant="determinate" value={Math.min(share, 100)}
          sx={{ height: 7, borderRadius: 4, my: 0.6, bgcolor: alpha(color, 0.12), "& .MuiLinearProgress-bar": { borderRadius: 4, background: `linear-gradient(90deg, ${alpha(color, 0.75)}, ${color})` } }} />
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </Box>
    </Box>
  );
}

function StatTile({ label, value, note, icon, color }) {
  return (
    <Paper variant="outlined" sx={{
      p: 1.5, height: "100%", borderRadius: 3, borderColor: alpha(color, 0.3),
      backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, transparent 70%)`,
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <IconBadge icon={icon} color={color} size={30} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
      </Box>
      <Typography fontWeight={800} sx={{ fontSize: { xs: "1.1rem", sm: "1.3rem" }, overflowWrap: "anywhere" }}>{value}</Typography>
      {note}
    </Paper>
  );
}

const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const Empty = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>{children}</Typography>
);

// ── Stock: what to restock and what's stuck, as of now ───────────────────────
function StockPanel() {
  const theme = useTheme();
  const [stock, setStock] = useState(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setFailed("");
    try {
      const res = await axiosInstance.get("analytics/stock/");
      setStock(res.data);
    } catch (err) {
      setFailed(err.response ? "Could not load stock insights." : "No connection. Stock insights need the internet.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (busy && !stock) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  if (failed) return <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{failed}</Alert>;
  if (!stock) return null;

  const t = stock.totals;
  const cfg = stock.settings;
  const units = (n, unit) => `${count(n)} ${unit && unit !== "units" ? unit : ""}`.trim();
  const perDay = (d) => (d >= 1 ? `${Number(d.toFixed(1))}/day` : `${Math.round(d * 7 * 10) / 10}/week`);
  const daysText = (d) => (d < 1 ? "less than a day" : `${Math.floor(d)} day${Math.floor(d) === 1 ? "" : "s"}`);

  const exportRestock = () => {
    const rows = [
      ...stock.out_of_stock_selling.map((x) => ({ product: x.name, category: x.category, in_stock: 0, sells_per_day: x.daily, status: "Out of stock", reorder_qty: x.reorder_qty })),
      ...stock.running_out.map((x) => ({ product: x.name, category: x.category, in_stock: x.stock, sells_per_day: x.daily, status: `About ${daysText(x.days_left)} left`, reorder_qty: x.reorder_qty })),
    ];
    saveAs(new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" }), `restock_list_${ymd(new Date())}.csv`);
  };

  const Row = ({ title, sub, right, rightSub, rightColor }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 1, pl: 1.25, mb: 0.75, borderRadius: 2, borderLeft: 4, borderLeftColor: rightColor || "divider", bgcolor: (th) => alpha(th.palette.text.primary, 0.025) }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography variant="body2" fontWeight={700} color={rightColor}>{right}</Typography>
        {rightSub && <Typography variant="caption" color="text.secondary">{rightSub}</Typography>}
      </Box>
    </Box>
  );

  const restockCount = stock.running_out_count + stock.out_of_stock_selling.length;

  return (
    <Box sx={{ opacity: busy ? 0.6 : 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Stock right now. Selling speed is from the last {cfg.window_days} days.
        </Typography>
        <IconButton size="small" onClick={load} disabled={busy}><RefreshIcon fontSize="small" /></IconButton>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          ["Stock value (cost)", naira(t.value_cost), `${count(t.units)} items · ${count(t.products)} products`, InventoryIcon, theme.palette.primary.main],
          ["Selling value", naira(t.value_retail), stock.can_view_profit ? `${naira(t.potential_profit)} profit if all sold` : "At today's prices", TagIcon, theme.palette.success.main],
          ["Out of stock", count(t.out_of_stock), stock.missed_per_day_total > 0 ? `About ${naira(stock.missed_per_day_total)} in sales missed a day` : "products", OutOfStockIcon, theme.palette.error.main],
          ["Low stock", count(t.low_stock), `${cfg.low_stock_threshold} or fewer left`, WarningIcon, theme.palette.warning.main],
        ].map(([label, value, note, icon, color]) => (
          <Grid key={label} size={{ xs: 6, md: 3 }}>
            <StatTile label={label} value={value} icon={icon} color={color}
              note={<Typography variant="caption" color="text.secondary" display="block">{note}</Typography>} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section
            title={`Restock soon (${restockCount})`}
            icon={CartIcon}
            color={theme.palette.warning.main}
            action={restockCount > 0 && <Button size="small" startIcon={<DownloadIcon />} onClick={exportRestock}>List</Button>}
          >
            {restockCount === 0 ? (
              <Empty>Nothing is about to run out. Every selling product has more than {cfg.running_out_days} days of stock.</Empty>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Order amounts cover about {cfg.reorder_cover_days} days of sales.
                  {stock.reorder_cost_total > 0 && <> Restocking the running-out items costs about <b>{naira(stock.reorder_cost_total)}</b>.</>}
                </Typography>
                {stock.out_of_stock_selling.map((x) => (
                  <Row key={`o${x.id}`} title={x.name} sub={`Out of stock · sells ${perDay(x.daily)}`}
                    right={`Order ${count(x.reorder_qty)}`} rightSub={`missing ${naira(x.missed_per_day)}/day`} rightColor="error.main" />
                ))}
                {stock.running_out.map((x) => (
                  <Row key={x.id} title={x.name} sub={`${units(x.stock, x.unit)} left · sells ${perDay(x.daily)}`}
                    right={`Order ${count(x.reorder_qty)}`} rightSub={`~${daysText(x.days_left)} left`}
                    rightColor={x.days_left <= 3 ? "error.main" : "warning.main"} />
                ))}
              </>
            )}
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Section title={`Not selling (${stock.slow_count})`} icon={HourglassIcon} color={theme.palette.info.main}>
            {stock.slow_count === 0 ? (
              <Empty>Every product in stock sold at least once in the last {cfg.window_days} days.</Empty>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  No sales in {cfg.window_days} days. <b>{naira(stock.slow_value_total)}</b> is tied up here. Try a discount, a better shelf spot, or stop reordering.
                </Typography>
                {stock.slow_movers.map((x) => (
                  <Row key={x.id} title={x.name}
                    sub={`${units(x.stock, x.unit)} · ${x.days_since_sale != null ? `last sold ${x.days_since_sale} days ago` : "never sold"}`}
                    right={naira(x.value_cost)} rightSub="at cost" rightColor="info.main" />
                ))}
              </>
            )}
          </Section>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Section title="Stock value by category" icon={CategoryIcon} color={theme.palette.secondary.main}>
            {stock.categories.map((x) => (
              <ShareBar key={x.name} label={x.name} value={naira(x.value_cost)} color={theme.palette.secondary.main}
                share={t.value_cost ? (x.value_cost / t.value_cost) * 100 : 0}
                sub={`${t.value_cost ? ((x.value_cost / t.value_cost) * 100).toFixed(0) : 0}% · ${count(x.units)} items · ${naira(x.value_retail)} at selling price`} />
            ))}
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const SalesReport = () => {
  const theme = useTheme();
  const [period, setPeriod] = useState("7d");
  const [range, setRange] = useState(() => rangeFor("7d").map(ymd));
  const [custom, setCustom] = useState(() => rangeFor("7d").map(ymd));
  const [cashier, setCashier] = useState("");
  const [product, setProduct] = useState("");
  const [cashiers, setCashiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [salesPage, setSalesPage] = useState({ results: [], count: 0, page: 0 });
  const [salesLoading, setSalesLoading] = useState(false);
  const latest = useRef(0);

  const params = useMemo(() => ({
    start_date: range[0], end_date: range[1], cashier_id: cashier || undefined, product_id: product || undefined,
  }), [range, cashier, product]);

  useEffect(() => {
    axiosInstance.get("staff/").then((r) => setCashiers(r.data)).catch(() => {});
    axiosInstance.get("products/").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get("analytics/", { params });
      if (id !== latest.current) return; // a newer request has started
      setData(res.data);
      setSalesPage({ results: [], count: 0, page: 0 });
    } catch (err) {
      if (id !== latest.current) return;
      setError(err.response?.data?.error || (err.response ? "Could not load the report." : "No connection. Reports need the internet."));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const loadSales = useCallback(async (page) => {
    setSalesLoading(true);
    try {
      const res = await axiosInstance.get("analytics/sales/", { params: { ...params, page } });
      setSalesPage((prev) => ({
        results: page === 1 ? res.data.results : [...prev.results, ...res.data.results],
        count: res.data.count, page,
      }));
    } catch {
      setError("Could not load the sales list.");
    } finally {
      setSalesLoading(false);
    }
  }, [params]);

  const canProfit = !!data?.can_view_profit;
  const tabs = ["Overview", "Products", "Staff", "Sales", ...(canProfit ? ["Profit"] : []), "Stock"];
  const current = tabs[Math.min(tab, tabs.length - 1)];
  useEffect(() => { if (current === "Sales" && data && salesPage.page === 0 && !salesLoading) loadSales(1); }, [current, data, salesPage.page, salesLoading, loadSales]);
  useEffect(() => { if (tab >= tabs.length) setTab(0); }, [tab, tabs.length]);

  const choosePeriod = (key) => {
    setPeriod(key);
    if (key !== "custom") setRange(rangeFor(key).map(ymd));
  };
  const applyCustom = () => {
    if (!custom[0] || !custom[1]) return;
    setRange(custom[0] <= custom[1] ? [...custom] : [custom[1], custom[0]]);
  };

  // ── Charts ───────────────────────────────────────────────────────────────
  const text = theme.palette.text.secondary;
  const grid = alpha(theme.palette.text.primary, 0.08);
  const colors = {
    revenue: theme.palette.primary.main,
    profit: theme.palette.success.main,
    cost: theme.palette.warning.main,
  };
  const baseOptions = (money = true) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: text, boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money ? naira(c.parsed.y) : count(c.parsed.y)}` } },
    },
    scales: {
      x: { ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: text, font: { size: 11 }, callback: (v) => (money ? compactNaira(v) : v) }, grid: { color: grid } },
    },
  });

  const singleDay = data?.range.days === 1;
  const activeHours = useMemo(() => {
    if (!data) return [];
    const used = data.hourly.filter((h) => h.transactions > 0).map((h) => h.hour);
    const from = Math.min(8, ...used);
    const to = Math.max(20, ...used);
    return data.hourly.filter((h) => h.hour >= from && h.hour <= to);
  }, [data]);

  const trendChart = data && (singleDay ? (
    <Bar
      data={{
        labels: activeHours.map((h) => hourLabel(h.hour)),
        datasets: [{ label: "Sales", data: activeHours.map((h) => h.revenue), backgroundColor: colors.revenue, borderRadius: 4 }],
      }}
      options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
    />
  ) : (
    <Line
      data={{
        labels: data.daily.map((d) => shortDate(d.date)),
        datasets: [
          { label: "Sales", data: data.daily.map((d) => d.revenue), borderColor: colors.revenue, backgroundColor: alpha(colors.revenue, 0.12), fill: true, tension: 0.3, pointRadius: data.daily.length > 31 ? 0 : 3 },
          ...(canProfit ? [{ label: "Profit", data: data.daily.map((d) => d.profit), borderColor: colors.profit, backgroundColor: "transparent", tension: 0.3, pointRadius: data.daily.length > 31 ? 0 : 3 }] : []),
        ],
      }}
      options={baseOptions()}
    />
  ));

  const busiest = data && [...data.hourly].sort((a, b) => b.revenue - a.revenue)[0];
  const bestDay = data && !singleDay && [...data.daily].sort((a, b) => b.revenue - a.revenue)[0];
  const revenueTotal = data?.summary.revenue || 0;
  const share = (v) => (revenueTotal ? (v / revenueTotal) * 100 : 0);
  const previousText = data && (data.range.days === 1
    ? (data.range.same_time ? "this time yesterday" : "day before")
    : `previous ${data.range.days} days${data.range.same_time ? " (same time)" : ""}`);

  // ── Exports ──────────────────────────────────────────────────────────────
  const fileTag = `${range[0]}_to_${range[1]}`;
  const exportRows = (rows, name) => {
    saveAs(new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" }), `${name}_${fileTag}.csv`);
  };
  const exportDaily = () => exportRows(data.daily.map((d) => ({
    date: d.date, sales_count: d.transactions, revenue: d.revenue, ...(canProfit ? { cost: d.cost, profit: d.profit } : {}),
  })), "daily_summary");
  const exportProducts = () => exportRows(data.products.map((p) => ({
    product: p.name, category: p.category, quantity_sold: p.quantity, revenue: p.revenue, sales_count: p.transactions,
    ...(canProfit ? { cost: p.cost, profit: p.profit, margin_pct: p.margin_pct } : {}),
  })), "products");
  const [itemsBusy, setItemsBusy] = useState(false);
  const exportItems = async () => {
    setItemsBusy(true);
    try {
      const res = await axiosInstance.get("analytics/items.csv", { params, responseType: "blob" });
      saveAs(res.data, `sales_items_${fileTag}.csv`);
    } catch {
      setError("Could not download the itemized file.");
    } finally {
      setItemsBusy(false);
    }
  };

  const s = data?.summary;
  const p = data?.previous;
  const c = data?.change_pct || {};
  const lowMargin = canProfit ? (data?.products || []).filter((x) => x.revenue > 0 && x.margin_pct < 10) : [];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: "grid", placeItems: "center", background: BRAND_GRADIENT, color: "#fff" }}>
              <ShowChartIcon fontSize="small" />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.3rem", md: "1.6rem" } }}>Reports</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {rangeText(range[0], range[1])}
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading} color="primary"><RefreshIcon /></IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Period */}
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: 1, mx: { xs: -1.5, sm: 0 }, px: { xs: 1.5, sm: 0 }, "&::-webkit-scrollbar": { display: "none" } }}>
        {PERIODS.map((x) => (
          <Chip key={x.key} label={x.label} onClick={() => choosePeriod(x.key)}
            color={period === x.key ? "primary" : "default"} variant={period === x.key ? "filled" : "outlined"}
            sx={{ flexShrink: 0, fontWeight: 600 }} />
        ))}
      </Box>

      {period === "custom" && (
        <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          <TextField type="date" size="small" label="From" value={custom[0]} InputLabelProps={{ shrink: true }}
            onChange={(e) => setCustom([e.target.value, custom[1]])} sx={{ flex: "1 1 140px" }} />
          <TextField type="date" size="small" label="To" value={custom[1]} InputLabelProps={{ shrink: true }}
            onChange={(e) => setCustom([custom[0], e.target.value])} sx={{ flex: "1 1 140px" }} />
          <Button variant="contained" onClick={applyCustom} sx={{ flex: "0 0 auto" }}>Show</Button>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField select size="small" label="Cashier" value={cashier} onChange={(e) => setCashier(e.target.value)} sx={{ flex: 1, minWidth: 0 }}>
          <MenuItem value="">Everyone</MenuItem>
          {cashiers.map((x) => <MenuItem key={x.id} value={x.id}>{x.first_name || x.username}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Product" value={product} onChange={(e) => setProduct(e.target.value)} sx={{ flex: 1, minWidth: 0 }}
          SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } }}>
          <MenuItem value="">All products</MenuItem>
          {products.map((x) => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
        </TextField>
      </Box>

      {loading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {!data && loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}

      {data && (
        <Box sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
          {/* Headline numbers */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <HeroKpi label="Total sales" value={naira(s.revenue)} pct={c.revenue} previousValue={p.revenue} previousText={previousText}
                subtitle={`${count(s.transactions)} transactions · ${count(s.items)} items`}
                spark={singleDay ? activeHours.map((h) => h.revenue) : data.daily.map((d) => d.revenue)} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={1.5} sx={{ height: "100%" }}>
                <Grid size={{ xs: 6 }}>
                  {canProfit ? (
                    <Kpi label="Profit" icon={SavingsIcon} color={theme.palette.success.main} value={naira(s.profit)} pct={c.profit}
                      previousValue={p.profit} previousText={previousText} note={`${s.margin_pct}% margin`} />
                  ) : (
                    <Kpi label="Profit" icon={SavingsIcon} color={theme.palette.success.main} locked />
                  )}
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Kpi label="Transactions" icon={ReceiptIcon} color={theme.palette.info.main} value={count(s.transactions)} pct={c.transactions}
                    previousValue={p.transactions} previousText={previousText} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Kpi label="Avg. sale" icon={CartIcon} color={theme.palette.secondary.main} value={naira(s.average_sale)} pct={c.average_sale}
                    previousValue={p.average_sale} previousText={previousText} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Kpi label="Items sold" icon={BasketIcon} color={theme.palette.warning.main} value={count(s.items)} pct={c.items}
                    previousValue={p.items} previousText={previousText} />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Paper sx={{ mb: 2 }}>
            <Tabs value={Math.min(tab, tabs.length - 1)} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
              {tabs.map((t) => <Tab key={t} label={t} sx={{ minWidth: 72 }} />)}
            </Tabs>
          </Paper>

          {current === "Stock" ? (
            <StockPanel />
          ) : s.transactions === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Typography fontWeight={600}>No sales in this period</Typography>
              <Typography variant="body2" color="text.secondary">Pick another period or clear the filters.</Typography>
            </Paper>
          ) : (
            <>

              {/* Overview */}
              {current === "Overview" && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Section title={singleDay ? "Sales by hour" : "Sales trend"} icon={ShowChartIcon}>
                      <Box sx={{ height: { xs: 220, md: 300 } }}>{trendChart}</Box>
                      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1.5 }}>
                        {busiest?.revenue > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Busiest hour: <b>{hourLabel(busiest.hour)}–{hourLabel((busiest.hour + 1) % 24)}</b> ({naira(busiest.revenue)})
                          </Typography>
                        )}
                        {bestDay?.revenue > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Best day: <b>{parseYmd(bestDay.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</b> ({naira(bestDay.revenue)})
                          </Typography>
                        )}
                      </Box>
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Section title="Top products" icon={TrophyIcon} color={MEDALS[0]} action={<Button size="small" onClick={() => setTab(1)}>See all</Button>}>
                      {data.products.slice(0, 5).map((x, i) => (
                        <ShareBar key={x.id} rank={i} label={x.name} value={naira(x.revenue)} share={share(x.revenue)} color={colors.revenue}
                          sub={`${count(x.quantity)} sold · ${share(x.revenue).toFixed(0)}% of sales${canProfit ? ` · ${naira(x.profit)} profit` : ""}`} />
                      ))}
                    </Section>
                  </Grid>
                  {data.payments && (
                    <Grid size={{ xs: 12 }}>
                      <Section title="How customers paid" icon={WalletIcon} color={theme.palette.success.main}>
                        <Grid container spacing={1.5}>
                          {[
                            ["Cash", data.payments.cash, data.payments.counts.cash, "In the drawer, after change", CashIcon, theme.palette.success.main],
                            ["Transfer", data.payments.transfer, data.payments.counts.transfer, "Check against bank alerts", BankIcon, theme.palette.primary.main],
                            ["POS card", data.payments.card, data.payments.counts.card, "Check against POS settlement", CardIcon, theme.palette.secondary.main],
                            ...(data.payments.unrecorded > 0 ? [["Not recorded", data.payments.unrecorded, data.payments.counts.unrecorded, "Sales before payment methods", UnknownIcon, theme.palette.grey[500]]] : []),
                          ].map(([label, amount, n, hint, icon, color]) => (
                            <Grid key={label} size={{ xs: 6, md: 3 }}>
                              <StatTile label={label} value={naira(amount)} icon={icon} color={color} note={
                                <>
                                  <LinearProgress variant="determinate" value={Math.min(share(amount), 100)}
                                    sx={{ height: 5, borderRadius: 3, my: 0.75, bgcolor: alpha(color, 0.12), "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 } }} />
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {share(amount).toFixed(0)}% · {count(n)} {label === "Not recorded" ? "sales" : "paid this way"}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ opacity: 0.8 }}>{hint}</Typography>
                                </>
                              } />
                            </Grid>
                          ))}
                        </Grid>
                        {data.payments.counts.split > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            {data.payments.counts.split === 1 ? "1 split payment is" : `${count(data.payments.counts.split)} split payments are`} shared across the boxes above.
                          </Typography>
                        )}
                      </Section>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Sales by category" icon={CategoryIcon} color={theme.palette.secondary.main}>
                      {data.categories.slice(0, 6).map((x) => (
                        <ShareBar key={x.name} label={x.name} value={naira(x.revenue)} share={share(x.revenue)} color={theme.palette.secondary.main}
                          sub={`${share(x.revenue).toFixed(0)}% · ${count(x.transactions)} transactions`} />
                      ))}
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Staff" icon={GroupsIcon} color={theme.palette.info.main} action={<Button size="small" onClick={() => setTab(2)}>Details</Button>}>
                      {data.cashiers.map((x) => (
                        <ShareBar key={x.id} label={x.name} value={naira(x.revenue)} share={share(x.revenue)} color={colors.profit}
                          sub={`${count(x.transactions)} transactions · avg ${naira(x.average_sale)}`} />
                      ))}
                    </Section>
                  </Grid>
                  {!singleDay && (
                    <Grid size={{ xs: 12 }}>
                      <Section title="Busy hours" icon={ScheduleIcon} color={theme.palette.warning.main}>
                        <Box sx={{ height: 200 }}>
                          <Bar
                            data={{ labels: activeHours.map((h) => hourLabel(h.hour)), datasets: [{ label: "Sales", data: activeHours.map((h) => h.revenue), backgroundColor: alpha(colors.revenue, 0.8), borderRadius: 4 }] }}
                            options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
                          />
                        </Box>
                      </Section>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Products */}
              {current === "Products" && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Section title={`Products sold (${data.products.length})`} icon={InventoryIcon}
                      action={<Button size="small" startIcon={<DownloadIcon />} onClick={exportProducts}>CSV</Button>}>
                      <TableContainer sx={{ maxHeight: 520 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Product</TableCell>
                              <TableCell align="right">Sold</TableCell>
                              <TableCell align="right">Sales</TableCell>
                              {canProfit && <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Profit</TableCell>}
                              {canProfit && <TableCell align="right">Margin</TableCell>}
                              {!canProfit && <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Share</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {data.products.map((x) => (
                              <TableRow key={x.id} hover>
                                <TableCell sx={{ maxWidth: 180 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>{x.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{x.category}</Typography>
                                </TableCell>
                                <TableCell align="right">{count(x.quantity)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{naira(x.revenue)}</TableCell>
                                {canProfit && <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" }, color: x.profit >= 0 ? "success.main" : "error.main", whiteSpace: "nowrap" }}>{naira(x.profit)}</TableCell>}
                                {canProfit && (
                                  <TableCell align="right">
                                    <Chip size="small" label={`${x.margin_pct}%`} color={x.margin_pct >= 20 ? "success" : x.margin_pct >= 10 ? "warning" : "error"} variant="outlined" />
                                  </TableCell>
                                )}
                                {!canProfit && <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>{share(x.revenue).toFixed(1)}%</TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Section title="Categories" icon={CategoryIcon} color={theme.palette.secondary.main}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Category</TableCell>
                              <TableCell align="right">Sales</TableCell>
                              <TableCell align="right">Share</TableCell>
                              <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Transactions</TableCell>
                              <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Products</TableCell>
                              {canProfit && <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>Profit</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {data.categories.map((x) => (
                              <TableRow key={x.name} hover>
                                <TableCell><Typography variant="body2" fontWeight={600}>{x.name}</Typography></TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{naira(x.revenue)}</TableCell>
                                <TableCell align="right">{share(x.revenue).toFixed(1)}%</TableCell>
                                <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>{count(x.transactions)}</TableCell>
                                <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>{x.products}</TableCell>
                                {canProfit && <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}>{naira(x.profit)}</TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Section>
                  </Grid>
                </Grid>
              )}

              {/* Staff */}
              {current === "Staff" && (
                <Grid container spacing={2}>
                  {data.cashiers.map((x, i) => (
                    <Grid key={x.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                              <Avatar sx={{ width: 40, height: 40, fontWeight: 700, fontSize: 15, background: BRAND_GRADIENT }}>{initials(x.name)}</Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography fontWeight={700} noWrap>{x.name}</Typography>
                                <Typography variant="caption" color={i < 3 ? MEDALS[i] : "text.secondary"} fontWeight={700}>
                                  {i === 0 ? "Top seller" : `#${i + 1}`}
                                </Typography>
                              </Box>
                            </Box>
                            <Typography variant="caption" color="text.secondary">{share(x.revenue).toFixed(0)}% of sales</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={700}>{naira(x.revenue)}</Typography>
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.5, px: 1, py: 0.25, borderRadius: 999, bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main" }}>
                            <CashIcon sx={{ fontSize: 15 }} />
                            <Typography variant="caption" fontWeight={700}>Cash to hand over: {naira(x.cash)}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={share(x.revenue)} sx={{ height: 6, borderRadius: 3, my: 1 }} />
                          <Grid container spacing={1}>
                            {[["Transactions", count(x.transactions)], ["Avg. sale", naira(x.average_sale)], ["Items", count(x.items)],
                              ["Cash", naira(x.cash)], ["Transfer", naira(x.transfer)], ["POS", naira(x.card)]].map(([k, v]) => (
                              <Grid key={k} size={{ xs: 4 }}>
                                <Typography variant="caption" color="text.secondary" display="block">{k}</Typography>
                                <Typography variant="body2" fontWeight={600}>{v}</Typography>
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* Sales list */}
              {current === "Sales" && (
                <Section title={`Transactions (${count(salesPage.count || s.transactions)})`} icon={ReceiptIcon} color={theme.palette.info.main}
                  action={<Button size="small" startIcon={itemsBusy ? <CircularProgress size={14} /> : <DownloadIcon />} onClick={exportItems} disabled={itemsBusy}>Items CSV</Button>}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Sale</TableCell>
                          <TableCell>When</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Cashier</TableCell>
                          <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Items</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {salesPage.results.map((x) => {
                          const at = new Date(x.created_at);
                          return (
                            <TableRow key={x.id} hover>
                              <TableCell>#{x.id}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <Typography variant="body2">{at.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {at.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
                                  <Box component="span" sx={{ display: { sm: "none" } }}> · {x.cashier}</Box>
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{x.cashier}</TableCell>
                              <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>{x.items}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                <Typography variant="body2" fontWeight={700}>{naira(x.total_amount, 2)}</Typography>
                                <Typography variant="caption" color="text.secondary">{PAY_LABELS[x.payment_method] || "—"}</Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {salesLoading && <Box sx={{ textAlign: "center", py: 2 }}><CircularProgress size={24} /></Box>}
                  {!salesLoading && salesPage.results.length < salesPage.count && (
                    <Button fullWidth sx={{ mt: 1 }} onClick={() => loadSales(salesPage.page + 1)}>
                      Show more ({count(salesPage.count - salesPage.results.length)} left)
                    </Button>
                  )}
                </Section>
              )}

              {/* Profit */}
              {current === "Profit" && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Section title={singleDay ? "Today's sales, cost and profit" : "Sales, cost and profit by day"} icon={ShowChartIcon} color={theme.palette.success.main}>
                      <Box sx={{ height: { xs: 240, md: 320 } }}>
                        <Bar
                          data={{
                            labels: data.daily.map((d) => shortDate(d.date)),
                            datasets: [
                              { label: "Sales", data: data.daily.map((d) => d.revenue), backgroundColor: alpha(colors.revenue, 0.85), borderRadius: 3 },
                              { label: "Cost", data: data.daily.map((d) => d.cost), backgroundColor: alpha(colors.cost, 0.85), borderRadius: 3 },
                              { label: "Profit", data: data.daily.map((d) => d.profit), backgroundColor: alpha(colors.profit, 0.85), borderRadius: 3 },
                            ],
                          }}
                          options={baseOptions()}
                        />
                      </Box>
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Most profitable" icon={TrendingUpIcon} color={theme.palette.success.main}>
                      {[...data.products].sort((a, b) => b.profit - a.profit).slice(0, 6).map((x) => (
                        <ShareBar key={x.id} label={x.name} value={naira(x.profit)} color={colors.profit}
                          share={s.profit > 0 ? (x.profit / s.profit) * 100 : 0}
                          sub={`${x.margin_pct}% margin · ${naira(x.revenue)} sales`} />
                      ))}
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Low margin (under 10%)" icon={WarningIcon} color={theme.palette.error.main}>
                      {lowMargin.length === 0 ? (
                        <Empty>Every product sold made at least 10% margin.</Empty>
                      ) : (
                        <>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Check the cost price or raise the selling price on these.
                          </Typography>
                          {lowMargin.slice(0, 8).map((x) => (
                            <Box key={x.id} sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: 1, borderColor: "divider", gap: 1 }}>
                              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{x.name}</Typography>
                              <Chip size="small" color="error" variant="outlined" label={`${x.margin_pct}%`} />
                            </Box>
                          ))}
                        </>
                      )}
                    </Section>
                  </Grid>
                </Grid>
              )}

              {/* Downloads */}
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
                <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportDaily}>Daily summary</Button>
                <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportProducts}>Products</Button>
                <Button size="small" variant="outlined" startIcon={itemsBusy ? <CircularProgress size={14} /> : <DownloadIcon />} onClick={exportItems} disabled={itemsBusy}>Every item sold</Button>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SalesReport;
