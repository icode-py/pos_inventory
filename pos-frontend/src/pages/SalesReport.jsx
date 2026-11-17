import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, IconButton, LinearProgress,
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
function Change({ pct, previous, invert = false }) {
  if (pct === null || pct === undefined) {
    return <Typography variant="caption" color="text.secondary">{previous ? "—" : "No sales before"}</Typography>;
  }
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpward : ArrowDownward;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", color: pct === 0 ? "text.secondary" : good ? "success.main" : "error.main" }}>
      <Icon sx={{ fontSize: 14 }} />
      <Typography variant="caption" fontWeight={700}>{Math.abs(pct).toFixed(1)}%</Typography>
    </Box>
  );
}

function Kpi({ label, value, pct, previousValue, previousText, note, locked }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
          {label}
        </Typography>
        {locked ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
            <LockIcon fontSize="small" color="disabled" />
            <Typography variant="body2" color="text.secondary">Business plan</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: "1.25rem", sm: "1.6rem" }, lineHeight: 1.3, mt: 0.25, overflowWrap: "anywhere" }}>
              {value}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
              <Change pct={pct} previous={previousValue} />
              {previousText && <Typography variant="caption" color="text.secondary">vs {previousText}</Typography>}
            </Box>
            {note && <Typography variant="caption" color="text.secondary" display="block">{note}</Typography>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, action, children }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function ShareBar({ label, sub, value, share, color }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>{value}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={Math.min(share, 100)} sx={{ height: 6, borderRadius: 3, my: 0.5, "& .MuiLinearProgress-bar": { bgcolor: color } }} />
      <Typography variant="caption" color="text.secondary">{sub}</Typography>
    </Box>
  );
}

const Empty = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>{children}</Typography>
);

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
  const tabs = ["Overview", "Products", "Staff", "Sales", ...(canProfit ? ["Profit"] : [])];
  useEffect(() => { if (tab === 3 && data && salesPage.page === 0 && !salesLoading) loadSales(1); }, [tab, data, salesPage.page, salesLoading, loadSales]);
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
          <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: "1.3rem", md: "1.6rem" } }}>Reports</Typography>
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
            <Grid size={{ xs: 6, md: canProfit ? 2.4 : 3 }}>
              <Kpi label="Sales" value={naira(s.revenue)} pct={c.revenue} previousValue={p.revenue} previousText={previousText} />
            </Grid>
            <Grid size={{ xs: 6, md: canProfit ? 2.4 : 3 }}>
              {canProfit ? (
                <Kpi label="Profit" value={naira(s.profit)} pct={c.profit} previousValue={p.profit} previousText={previousText}
                  note={`${s.margin_pct}% margin`} />
              ) : (
                <Kpi label="Profit" locked />
              )}
            </Grid>
            <Grid size={{ xs: 6, md: canProfit ? 2.4 : 2 }}>
              <Kpi label="Transactions" value={count(s.transactions)} pct={c.transactions} previousValue={p.transactions} previousText={previousText} />
            </Grid>
            <Grid size={{ xs: 6, md: canProfit ? 2.4 : 2 }}>
              <Kpi label="Avg. sale" value={naira(s.average_sale)} pct={c.average_sale} previousValue={p.average_sale} previousText={previousText} />
            </Grid>
            <Grid size={{ xs: 12, md: canProfit ? 2.4 : 2 }}>
              <Kpi label="Items sold" value={count(s.items)} pct={c.items} previousValue={p.items} previousText={previousText} />
            </Grid>
          </Grid>

          {s.transactions === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Typography fontWeight={600}>No sales in this period</Typography>
              <Typography variant="body2" color="text.secondary">Pick another period or clear the filters.</Typography>
            </Paper>
          ) : (
            <>
              <Paper sx={{ mb: 2 }}>
                <Tabs value={Math.min(tab, tabs.length - 1)} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                  {tabs.map((t) => <Tab key={t} label={t} sx={{ minWidth: 72 }} />)}
                </Tabs>
              </Paper>

              {/* Overview */}
              {tab === 0 && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Section title={singleDay ? "Sales by hour" : "Sales trend"}>
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
                    <Section title="Top products" action={<Button size="small" onClick={() => setTab(1)}>See all</Button>}>
                      {data.products.slice(0, 5).map((x, i) => (
                        <ShareBar key={x.id} label={`${i + 1}. ${x.name}`} value={naira(x.revenue)} share={share(x.revenue)} color={colors.revenue}
                          sub={`${count(x.quantity)} sold · ${share(x.revenue).toFixed(0)}% of sales${canProfit ? ` · ${naira(x.profit)} profit` : ""}`} />
                      ))}
                    </Section>
                  </Grid>
                  {data.payments && (
                    <Grid size={{ xs: 12 }}>
                      <Section title="How customers paid">
                        <Grid container spacing={1.5}>
                          {[
                            ["Cash", data.payments.cash, data.payments.counts.cash, "In the drawer, after change"],
                            ["Transfer", data.payments.transfer, data.payments.counts.transfer, "Check against bank alerts"],
                            ["POS card", data.payments.card, data.payments.counts.card, "Check against POS settlement"],
                            ...(data.payments.unrecorded > 0 ? [["Not recorded", data.payments.unrecorded, data.payments.counts.unrecorded, "Sales before payment methods"]] : []),
                          ].map(([label, amount, n, hint]) => (
                            <Grid key={label} size={{ xs: 6, md: 3 }}>
                              <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                                <Typography fontWeight={700} sx={{ fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>{naira(amount)}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {share(amount).toFixed(0)}% · {count(n)} {label === "Not recorded" ? "sales" : "paid this way"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ opacity: 0.8 }}>{hint}</Typography>
                              </Paper>
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
                    <Section title="Sales by category">
                      {data.categories.slice(0, 6).map((x) => (
                        <ShareBar key={x.name} label={x.name} value={naira(x.revenue)} share={share(x.revenue)} color={theme.palette.secondary.main}
                          sub={`${share(x.revenue).toFixed(0)}% · ${count(x.transactions)} transactions`} />
                      ))}
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Staff" action={<Button size="small" onClick={() => setTab(2)}>Details</Button>}>
                      {data.cashiers.map((x) => (
                        <ShareBar key={x.id} label={x.name} value={naira(x.revenue)} share={share(x.revenue)} color={colors.profit}
                          sub={`${count(x.transactions)} transactions · avg ${naira(x.average_sale)}`} />
                      ))}
                    </Section>
                  </Grid>
                  {!singleDay && (
                    <Grid size={{ xs: 12 }}>
                      <Section title="Busy hours">
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
              {tab === 1 && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Section title={`Products sold (${data.products.length})`}
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
                    <Section title="Categories">
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
              {tab === 2 && (
                <Grid container spacing={2}>
                  {data.cashiers.map((x, i) => (
                    <Grid key={x.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Card sx={{ height: "100%" }}>
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                              <Chip size="small" label={`#${i + 1}`} color={i === 0 ? "primary" : "default"} />
                              <Typography fontWeight={700} noWrap>{x.name}</Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">{share(x.revenue).toFixed(0)}% of sales</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={700}>{naira(x.revenue)}</Typography>
                          <Typography variant="caption" color="text.secondary">Cash to hand over: <b>{naira(x.cash)}</b></Typography>
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
              {tab === 3 && (
                <Section title={`Transactions (${count(salesPage.count || s.transactions)})`}
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
              {canProfit && tab === 4 && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Section title={singleDay ? "Today's sales, cost and profit" : "Sales, cost and profit by day"}>
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
                    <Section title="Most profitable">
                      {[...data.products].sort((a, b) => b.profit - a.profit).slice(0, 6).map((x) => (
                        <ShareBar key={x.id} label={x.name} value={naira(x.profit)} color={colors.profit}
                          share={s.profit > 0 ? (x.profit / s.profit) * 100 : 0}
                          sub={`${x.margin_pct}% margin · ${naira(x.revenue)} sales`} />
                      ))}
                    </Section>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Section title="Low margin (under 10%)">
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
