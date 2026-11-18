import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Collapse, InputAdornment, MenuItem, TextField, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  History as AuditIcon, Search as SearchIcon, Inventory2 as ProductIcon, LocalShipping as RestockIcon, Tune as AdjustIcon,
  ManageAccounts as StaffIcon, Groups as CustomerIcon, Settings as SettingsIcon, RateReview as ReviewIcon, Category as CategoryIcon,
  ExpandMore as MoreIcon, Close as CloseIcon,
} from "@mui/icons-material";
import axiosInstance from "../utils/axiosInstance";
import { IconBadge, PageHeader, EmptyState } from "../components/PagePieces";

const TYPES = [
  ["", "Everything"],
  ["Product,Category", "Products & prices"],
  ["Restock,StockAdjustment", "Stock"],
  ["Staff", "Staff"],
  ["Customer", "Customers"],
  ["StoreSettings", "Settings"],
  ["RefusedSale", "Sale reviews"],
];
const FIELD_LABELS = {
  price: "price", cost_price: "cost price", bulk_price: "carton price", bulk_quantity: "carton size", name: "name",
  barcode: "barcode", category: "category", unit_of_measure: "unit", is_bulk_product: "sold in cartons", phone: "phone",
  email: "email", notes: "notes", stock: "stock", role: "role", active: "can log in", is_archived: "archived",
  tagline: "tagline", address: "address", receipt_footer: "receipt message", low_stock_threshold: "low stock level",
  loyalty_enabled: "loyalty", loyalty_amount_per_point: "spend per point", loyalty_point_value: "point value",
  loyalty_silver_points: "Silver points", loyalty_gold_points: "Gold points",
};
const MONEY_FIELDS = ["price", "cost_price", "bulk_price", "loyalty_amount_per_point", "loyalty_point_value"];
const fmt = (field, v) => {
  if (v === null || v === undefined || v === "None" || v === "") return "empty";
  if (MONEY_FIELDS.includes(field) && !isNaN(Number(v))) return `₦${Number(v).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  if (v === "True") return "yes";
  if (v === "False") return "no";
  return String(v);
};
// Changes stored as {field: {from, to}}; others are plain notes
const diffs = (changes) => Object.entries(changes || {}).filter(([, v]) => v && typeof v === "object" && "from" in v);

/** One audit entry as a sentence with an icon. */
function describe(log, theme) {
  const who = log.changed_by_username || "Someone";
  const what = log.object_repr;
  const c = log.changes || {};
  const d = diffs(c);
  const P = theme.palette;
  switch (log.model_name) {
    case "Product": {
      if (c.source === "bulk_upload") return { icon: ProductIcon, color: P.info.main, text: `${who} ${log.action === "CREATE" ? "added" : "updated"} ${what} from an Excel upload` };
      if (log.action === "CREATE") return { icon: ProductIcon, color: P.success.main, text: `${who} added product ${what}` };
      if (log.action === "DELETE") return { icon: ProductIcon, color: P.error.main, text: `${who} deleted product ${what}` };
      const archived = d.find(([f]) => f === "is_archived");
      if (archived) return { icon: ProductIcon, color: P.warning.main, text: `${who} ${archived[1].to === "True" ? "archived" : "restored"} ${what}` };
      const price = d.find(([f]) => f === "price");
      if (price && d.length === 1) return { icon: ProductIcon, color: P.primary.main, text: `${who} changed the price of ${what} from ${fmt("price", price[1].from)} to ${fmt("price", price[1].to)}` };
      return { icon: ProductIcon, color: P.primary.main, text: `${who} edited ${what}` };
    }
    case "Category":
      return { icon: CategoryIcon, color: P.secondary.main, text: `${who} ${log.action === "CREATE" ? "added" : log.action === "DELETE" ? "deleted" : "edited"} category ${what}` };
    case "Restock": {
      const cost = c.unit_cost ? ` at ₦${Number(c.unit_cost).toLocaleString("en-NG")} each` : "";
      return { icon: RestockIcon, color: P.success.main, text: `${who} restocked ${what}${c.new_stock != null ? ` (now ${Number(c.new_stock).toLocaleString("en-NG")})` : ""}${cost}` };
    }
    case "StockAdjustment": {
      const removed = c.stock && Number(c.stock.to) < Number(c.stock.from);
      return { icon: AdjustIcon, color: removed ? P.error.main : P.info.main, text: `${who} adjusted ${what}${c.stock ? `: stock ${c.stock.from} → ${c.stock.to}` : ""}${c.note ? ` · "${c.note}"` : ""}` };
    }
    case "Staff": {
      if (c.action === "password_reset") return { icon: StaffIcon, color: P.warning.main, text: `${who} set a new password for ${what}` };
      if (c.action === "own_password_changed") return { icon: StaffIcon, color: P.info.main, text: `${who} changed their own password` };
      if (log.action === "CREATE") return { icon: StaffIcon, color: P.success.main, text: `${who} added staff member ${what}` };
      if (log.action === "DELETE") return { icon: StaffIcon, color: P.error.main, text: `${who} deleted staff member ${what}` };
      const active = d.find(([f]) => f === "active");
      if (active && d.length === 1) return { icon: StaffIcon, color: active[1].to === "True" ? P.success.main : P.warning.main, text: `${who} ${active[1].to === "True" ? "re-activated" : "deactivated"} ${what}` };
      return { icon: StaffIcon, color: P.primary.main, text: `${who} changed ${what}'s account` };
    }
    case "Customer":
      return { icon: CustomerIcon, color: P.secondary.main, text: `${who} ${log.action === "CREATE" ? "added" : log.action === "DELETE" ? "deleted" : "edited"} customer ${what}` };
    case "StoreSettings":
      return { icon: SettingsIcon, color: P.grey[600], text: `${who} changed store settings${Object.keys(c).length ? `: ${Object.keys(c).map((k) => FIELD_LABELS[k] || k).join(", ")}` : ""}` };
    case "RefusedSale": {
      const to = c.status?.to;
      return { icon: ReviewIcon, color: to === "APPROVED" ? P.success.main : P.error.main, text: `${who} ${to === "APPROVED" ? "recorded" : "dismissed"} a held offline sale` };
    }
    default:
      return { icon: AuditIcon, color: P.grey[600], text: `${who} ${log.action.toLowerCase()}d ${log.model_name} ${what}` };
  }
}

function Details({ log }) {
  const c = log.changes || {};
  const d = diffs(c);
  const notes = Object.entries(c).filter(([k, v]) => !(v && typeof v === "object") && !["source", "action"].includes(k) && v !== null && v !== "");
  if (!d.length && !notes.length) return null;
  return (
    <Box sx={{ pl: 6, pr: 1, pb: 1 }}>
      {d.map(([field, v]) => (
        <Typography key={field} variant="caption" display="block">
          <b>{FIELD_LABELS[field] || field}:</b> <Box component="span" sx={{ textDecoration: "line-through", color: "error.main" }}>{fmt(field, v.from)}</Box> → <Box component="span" sx={{ color: "success.main", fontWeight: 700 }}>{fmt(field, v.to)}</Box>
        </Typography>
      ))}
      {notes.map(([k, v]) => (
        <Typography key={k} variant="caption" display="block" color="text.secondary"><b>{FIELD_LABELS[k] || k.replace(/_/g, " ")}:</b> {String(v)}</Typography>
      ))}
    </Box>
  );
}

export default function AuditLogPage() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({ model: "", user_id: "", start_date: "", end_date: "", search: "" });
  const [searchInput, setSearchInput] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => { axiosInstance.get("staff/").then((r) => setStaff(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput.trim() })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async (pageNo = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page: pageNo }).filter(([, v]) => v !== ""));
      const res = await axiosInstance.get("audit-log/", { params });
      setRows((prev) => (pageNo === 1 ? res.data.results : [...prev, ...res.data.results]));
      setCount(res.data.count);
      setHasMore(Boolean(res.data.next));
      setPage(pageNo);
    } catch (err) {
      setError(err.response?.status === 403 ? "The audit log is on the Growth plan and above." : "Could not load the audit log");
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { load(1); }, [load]);

  const groups = useMemo(() => {
    const out = [];
    rows.forEach((r) => {
      const day = new Date(r.timestamp).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, rows: [] });
      out[out.length - 1].rows.push(r);
    });
    return out;
  }, [rows]);

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <PageHeader icon={AuditIcon} title="Audit log" subtitle="Who changed what, and when: prices, stock, staff and settings." onRefresh={() => load(1)} loading={loading} />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1 }}>
            {TYPES.map(([value, label]) => (
              <Chip key={label} label={label} onClick={() => setFilters((f) => ({ ...f, model: value }))}
                color={filters.model === value ? "primary" : "default"} variant={filters.model === value ? "filled" : "outlined"} sx={{ fontWeight: 600, flexShrink: 0 }} />
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
            <TextField size="small" placeholder="Search product, staff or customer" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} sx={{ flex: "2 1 220px" }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: searchInput && <CloseIcon fontSize="small" sx={{ cursor: "pointer" }} onClick={() => setSearchInput("")} /> }} />
            <TextField select size="small" value={filters.user_id} onChange={setF("user_id")} sx={{ flex: "1 1 150px" }} SelectProps={{ displayEmpty: true }}>
              <MenuItem value="">Everyone</MenuItem>
              {staff.map((s) => <MenuItem key={s.id} value={s.id}>{s.first_name || s.username}</MenuItem>)}
            </TextField>
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.start_date} onChange={setF("start_date")} sx={{ flex: "1 1 140px" }} />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.end_date} onChange={setF("end_date")} sx={{ flex: "1 1 140px" }} />
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{count.toLocaleString("en-NG")} entries</Typography>
          {!loading && rows.length === 0 && !error && <EmptyState icon={AuditIcon} title="Nothing here">No changes match these filters.</EmptyState>}
          {groups.map((g) => (
            <Box key={g.day} sx={{ mb: 2 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{g.day}</Typography>
              {g.rows.map((log) => {
                const info = describe(log, theme);
                const expandable = diffs(log.changes).length > 0 || Object.keys(log.changes || {}).some((k) => !["source", "action"].includes(k));
                return (
                  <Box key={log.id} sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Box onClick={() => expandable && setOpen(open === log.id ? null : log.id)}
                      sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1, cursor: expandable ? "pointer" : "default", "&:hover": expandable ? { bgcolor: alpha(theme.palette.primary.main, 0.03) } : {} }}>
                      <IconBadge icon={info.icon} color={info.color} size={34} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{info.text}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(log.timestamp).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</Typography>
                      </Box>
                      {expandable && <MoreIcon sx={{ color: "text.disabled", transform: open === log.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                    </Box>
                    <Collapse in={open === log.id} unmountOnExit><Details log={log} /></Collapse>
                  </Box>
                );
              })}
            </Box>
          ))}
          {loading && <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={28} /></Box>}
          {!loading && hasMore && <Button fullWidth onClick={() => load(page + 1)}>Show more</Button>}
        </CardContent>
      </Card>
    </Box>
  );
}
