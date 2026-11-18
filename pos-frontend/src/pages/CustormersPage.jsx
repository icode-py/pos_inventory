import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, InputAdornment, ListItemIcon, Menu, MenuItem, Paper, Snackbar, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import {
  Groups as CustomersIcon, PersonAdd as AddIcon, Search as SearchIcon, Download as DownloadIcon, Edit as EditIcon,
  Delete as DeleteIcon, MoreVert as MoreIcon, Loyalty as PointsIcon, EventAvailable as ActiveIcon,
  WorkspacePremium as GoldIcon, Close as CloseIcon, WhatsApp as WhatsAppIcon, Visibility as ViewIcon,
} from "@mui/icons-material";
import axiosInstance from "../utils/axiosInstance";
import { useStore } from "../context/StoreContext";
import { loyaltyRules, loyaltyTier } from "../utils/loyalty";
import { toWhatsAppNumber } from "../utils/receiptText";
import { BRAND_GRADIENT, EmptyState, PageHeader, Section, StatTile, count, initials, naira, timeAgo } from "../components/PagePieces";

const EMPTY = { phone: "", name: "", email: "", notes: "" };
const errorText = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== "object") return err.response ? "Something went wrong" : "No connection";
  return Object.values(d).flat().join(" ");
};

export default function CustomersPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { store } = useStore();
  const rules = loyaltyRules(store);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [sort, setSort] = useState("recent");
  const [form, setForm] = useState(null); // { ...fields, id? }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [menu, setMenu] = useState({ anchor: null, customer: null });
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setSnack({ open: true, message, severity });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/customers/");
      setCustomers(res.data);
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const monthAgo = Date.now() - 30 * 86400000;
  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => c.last_visit && new Date(c.last_visit) >= monthAgo).length,
    points: customers.reduce((s, c) => s + (c.loyalty_points || 0), 0),
    gold: customers.filter((c) => (c.loyalty_points || 0) >= rules.gold).length,
  }), [customers, rules.gold, monthAgo]);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const rows = customers.filter((c) => {
      if (term && !c.name.toLowerCase().includes(term) && !(digits && c.phone.replace(/\D/g, "").includes(digits))) return false;
      if (tier !== "all" && loyaltyTier(c.loyalty_points, store).label.toLowerCase() !== tier) return false;
      return true;
    });
    const by = {
      recent: (a, b) => new Date(b.last_visit || 0) - new Date(a.last_visit || 0),
      spent: (a, b) => Number(b.total_spent) - Number(a.total_spent),
      points: (a, b) => b.loyalty_points - a.loyalty_points,
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return [...rows].sort(by);
  }, [customers, search, tier, sort, store]);

  const save = async () => {
    setSaving(true);
    setFormError("");
    const payload = { phone: form.phone.trim(), name: form.name.trim(), email: form.email.trim(), notes: form.notes };
    try {
      if (form.id) {
        const res = await axiosInstance.patch(`/customers/${form.id}/`, payload);
        setCustomers((prev) => prev.map((c) => (c.id === form.id ? { ...c, ...res.data } : c)));
        notify("Customer updated");
      } else {
        const res = await axiosInstance.post("/customers/", payload);
        setCustomers((prev) => [res.data, ...prev]);
        notify(`${res.data.name} added`);
      }
      setForm(null);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? Their past sales stay in Reports, but their points (${count(c.loyalty_points)}) are lost.`)) return;
    try {
      await axiosInstance.delete(`/customers/${c.id}/`);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      notify("Customer deleted");
    } catch (err) {
      notify(errorText(err), "error");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await axiosInstance.get("/customers/export/", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers_${new Date().toLocaleDateString("en-CA")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notify("Export failed", "error");
    }
  };

  const TierChip = ({ points }) => {
    const t = loyaltyTier(points, store);
    return <Chip size="small" label={t.label} sx={{ fontWeight: 700, height: 20, fontSize: 11, bgcolor: `${t.color}26`, color: t.color, border: `1px solid ${t.color}` }} />;
  };
  const avatar = (c) => (
    <Avatar sx={{ width: 40, height: 40, fontWeight: 700, fontSize: 15, background: BRAND_GRADIENT }}>{initials(c.name)}</Avatar>
  );
  const openMenu = (e, c) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, customer: c }); };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <PageHeader icon={CustomersIcon} title="Customers" subtitle="Loyalty members, their points and how often they buy."
        onRefresh={load} loading={loading}
        actions={<>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Export</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...EMPTY }); setFormError(""); }} sx={{ background: BRAND_GRADIENT }}>Add</Button>
        </>} />

      {!rules.enabled && <Alert severity="info" sx={{ mb: 2 }}>Loyalty points are switched off. Turn them on in Settings → Loyalty.</Alert>}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Customers" value={count(stats.total)} note="registered" icon={CustomersIcon} color={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Active" value={count(stats.active)} note="bought in the last 30 days" icon={ActiveIcon} color={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Points owed" value={naira(stats.points * rules.pointValue)} note={`${count(stats.points)} points customers can spend`} icon={PointsIcon} color={theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Gold members" value={count(stats.gold)} note={`${count(rules.gold)}+ points`} icon={GoldIcon} color="#F5B700" onClick={() => setTier("gold")} active={tier === "gold"} /></Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField size="small" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: "3 1 220px" }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: search && <IconButton size="small" onClick={() => setSearch("")}><CloseIcon fontSize="small" /></IconButton> }} />
            <TextField select size="small" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ flex: "1 1 160px" }}>
              <MenuItem value="recent">Sort: Last visit</MenuItem>
              <MenuItem value="spent">Sort: Spent most</MenuItem>
              <MenuItem value="points">Sort: Most points</MenuItem>
              <MenuItem value="name">Sort: Name</MenuItem>
            </TextField>
          </Box>
          <Box sx={{ display: "flex", gap: 1, mt: 1.25, overflowX: "auto" }}>
            {[["all", "All"], ["gold", "Gold"], ["silver", "Silver"], ["bronze", "Bronze"]].map(([k, l]) => (
              <Chip key={k} label={l} onClick={() => setTier(k)} color={tier === k ? "primary" : "default"} variant={tier === k ? "filled" : "outlined"} sx={{ fontWeight: 600 }} />
            ))}
          </Box>
        </CardContent>
      </Card>

      <Section title={`Customers (${count(list.length)})`}>
        {loading ? <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress /></Box> : list.length === 0 ? (
          <EmptyState icon={CustomersIcon} title={customers.length ? "No customers match" : "No customers yet"}>
            {customers.length ? "Try another search or tier." : "Add customers here or at the till, so they earn points on every purchase."}
          </EmptyState>
        ) : isDesktop ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell><TableCell>Phone</TableCell><TableCell align="right">Points</TableCell>
                  <TableCell align="right">Spent</TableCell><TableCell align="right">Visits</TableCell><TableCell>Last visit</TableCell><TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/customers/${c.id}`)}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        {avatar(c)}
                        <Box><Typography variant="body2" fontWeight={700}>{c.name}</Typography><TierChip points={c.loyalty_points} /></Box>
                      </Box>
                    </TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{count(c.loyalty_points)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>{naira(c.total_spent)}</TableCell>
                    <TableCell align="right">{count(c.total_visits)}</TableCell>
                    <TableCell>{timeAgo(c.last_visit)}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}><IconButton size="small" onClick={(e) => openMenu(e, c)}><MoreIcon fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : list.map((c) => (
          <Paper key={c.id} variant="outlined" onClick={() => navigate(`/customers/${c.id}`)}
            sx={{ p: 1.25, mb: 1, borderRadius: 3, display: "flex", alignItems: "center", gap: 1.25, cursor: "pointer" }}>
            {avatar(c)}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{c.name}</Typography>
                <TierChip points={c.loyalty_points} />
              </Box>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>{c.phone} · {timeAgo(c.last_visit)}</Typography>
            </Box>
            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography variant="body2" fontWeight={800} color="primary">{naira(c.total_spent)}</Typography>
              <Typography variant="caption" color="text.secondary">{count(c.loyalty_points)} pts</Typography>
            </Box>
            <IconButton size="small" onClick={(e) => openMenu(e, c)}><MoreIcon /></IconButton>
          </Paper>
        ))}
      </Section>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, customer: null })}>
        {menu.customer && [
          <MenuItem key="v" onClick={() => { const c = menu.customer; setMenu({ anchor: null }); navigate(`/customers/${c.id}`); }}><ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>Profile & history</MenuItem>,
          <MenuItem key="w" component="a" href={`https://wa.me/${toWhatsAppNumber(menu.customer.phone)}`} target="_blank" rel="noopener" onClick={() => setMenu({ anchor: null })}>
            <ListItemIcon><WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} /></ListItemIcon>WhatsApp</MenuItem>,
          <MenuItem key="e" onClick={() => { const c = menu.customer; setMenu({ anchor: null }); setForm({ id: c.id, phone: c.phone, name: c.name, email: c.email || "", notes: c.notes || "" }); setFormError(""); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit</MenuItem>,
          <MenuItem key="d" sx={{ color: "error.main" }} onClick={() => { const c = menu.customer; setMenu({ anchor: null }); remove(c); }}>
            <ListItemIcon sx={{ color: "error.main" }}><DeleteIcon fontSize="small" /></ListItemIcon>Delete</MenuItem>,
        ]}
      </Menu>

      <Dialog open={Boolean(form)} onClose={() => !saving && setForm(null)} maxWidth="xs" fullWidth>
        {form && (
          <>
            <DialogTitle>{form.id ? "Edit customer" : "Add customer"}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField label="Phone number" required autoFocus value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 08012345678" inputProps={{ inputMode: "tel" }} />
              <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextField label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <TextField label="Notes (optional)" multiline minRows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Buys a carton of Malta every Friday" />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
              <Button variant="contained" onClick={save} disabled={saving || !form.phone.trim() || form.name.trim().length < 2}>{saving ? "Saving…" : "Save"}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert variant="filled" severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
