import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Grid, IconButton, ListItemIcon, Menu, MenuItem, Snackbar, Switch, TextField, Typography, useTheme,
} from "@mui/material";
import {
  ManageAccounts as StaffIcon, PersonAdd as AddIcon, MoreVert as MoreIcon, Edit as EditIcon, Lock as LockIcon,
  Delete as DeleteIcon, Block as DeactivateIcon, CheckCircle as ActivateIcon, PointOfSale as CashierIcon,
  SupervisorAccount as ManagerIcon, PersonOff as InactiveIcon, Groups as ActiveIcon,
} from "@mui/icons-material";
import { AuthContext } from "../context/AuthContext";
import { useStore, TIER_LABELS } from "../context/StoreContext";
import axiosInstance from "../utils/axiosInstance";
import { BRAND_GRADIENT, EmptyState, PageHeader, StatTile, count, initials, naira, timeAgo } from "../components/PagePieces";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const roleOf = (m) => (m.is_admin ? "Owner" : m.is_manager ? "Manager" : m.is_cashier ? "Cashier" : "No role");
const errorText = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== "object") return err.response ? "Something went wrong" : "No connection";
  return d.error || Object.values(d).flat().join(" ");
};

export default function StaffPage() {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const { store, cashierLimit } = useStore();
  const isOwner = user?.role === "admin";
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // { type: add|edit|password, member?, form }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState({ anchor: null, member: null });
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setSnack({ open: true, message, severity });

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const [list, month] = await Promise.allSettled([
      axiosInstance.get("/staff/"),
      axiosInstance.get("analytics/", { params: { start_date: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end_date: ymd(now) } }),
    ]);
    if (list.status === "fulfilled") setStaff(list.value.data);
    else notify(errorText(list.reason), "error");
    if (month.status === "fulfilled") setSales(Object.fromEntries(month.value.data.cashiers.map((c) => [c.id, c])));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const isMe = (m) => String(m.id) === String(user?.user_id);
  // Managers look after cashiers; only the owner looks after managers
  const canManage = (m) => !isMe(m) && !m.is_admin && (isOwner || !m.is_manager);

  const stats = useMemo(() => ({
    active: staff.filter((m) => m.is_active).length,
    cashiers: staff.filter((m) => m.is_active && m.is_cashier).length,
    managers: staff.filter((m) => m.is_active && (m.is_manager || m.is_admin)).length,
    inactive: staff.filter((m) => !m.is_active).length,
  }), [staff]);

  const sorted = useMemo(() => [...staff].sort((a, b) => (b.is_active - a.is_active)
    || ((b.is_admin * 2 + b.is_manager) - (a.is_admin * 2 + a.is_manager)) || a.username.localeCompare(b.username)), [staff]);

  const open = (type, member) => {
    setError("");
    setDialog({
      type, member,
      form: type === "add" ? { first_name: "", username: "", role: "cashier", password: "", confirm: "" }
        : type === "edit" ? { first_name: member.first_name || "", role: member.is_manager ? "manager" : "cashier", active: member.is_active }
          : { password: "", confirm: "" },
    });
  };
  const setForm = (patch) => setDialog((d) => ({ ...d, form: { ...d.form, ...patch } }));

  const submit = async () => {
    const { type, member, form } = dialog;
    setSaving(true);
    setError("");
    try {
      if (type === "add") {
        await axiosInstance.post("/register-staff/", {
          username: form.username.trim(), first_name: form.first_name.trim(), password: form.password, confirm_password: form.confirm,
          is_cashier: form.role === "cashier", is_manager: form.role === "manager",
        });
        notify(`${form.first_name || form.username} can now log in`);
      } else if (type === "edit") {
        await axiosInstance.patch(`/staff/${member.id}/update/`, {
          first_name: form.first_name.trim(), is_cashier: form.role === "cashier", is_manager: form.role === "manager", is_active: form.active,
        });
        notify(`${member.username} updated`);
      } else {
        await axiosInstance.post(`/staff/${member.id}/reset-password/`, { new_password: form.password });
        notify(`New password set for ${member.username}`);
      }
      setDialog(null);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (m, active) => {
    if (!active && !window.confirm(`Deactivate ${m.first_name || m.username}? They won't be able to log in. Their past sales keep their name.`)) return;
    try {
      await axiosInstance.patch(`/staff/${m.id}/update/`, { is_active: active });
      notify(active ? `${m.username} can log in again` : `${m.username} deactivated`);
      load();
    } catch (err) {
      notify(errorText(err), "error");
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete ${m.username} for good?`)) return;
    try {
      await axiosInstance.delete(`/staff/${m.id}/delete/`);
      notify(`${m.username} deleted`);
      load();
    } catch (err) {
      if (err.response?.data?.can_deactivate) {
        if (window.confirm(`${errorText(err)}\n\nDeactivate ${m.username} now?`)) setActive(m, false);
      } else notify(errorText(err), "error");
    }
  };

  const f = dialog?.form;
  // Managers and owners see takings and costs, so the server asks more of their passwords
  const minPassword = !f ? 6 : dialog.type === "add" ? (f.role === "manager" ? 8 : 6)
    : (dialog.member?.is_manager || dialog.member?.is_admin ? 8 : 6);
  const passwordOk = f && (dialog.type === "edit" || (f.password.length >= minPassword && f.password === f.confirm));
  const valid = f && passwordOk && (dialog.type !== "add" || /^[a-zA-Z0-9_]{3,}$/.test(f.username.trim()));
  const limitText = cashierLimit == null ? "unlimited on your plan" : `${stats.cashiers} of ${cashierLimit} on ${TIER_LABELS[store.plan_tier] || store.plan_tier}`;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1300, mx: "auto" }}>
      <PageHeader icon={StaffIcon} title="Staff" subtitle="Who can log in, what they can do, and how they're selling."
        onRefresh={load} loading={loading}
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => open("add")} sx={{ background: BRAND_GRADIENT }}>Add staff</Button>} />

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Active" value={count(stats.active)} note="can log in" icon={ActiveIcon} color={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Cashiers" value={count(stats.cashiers)} note={limitText} icon={CashierIcon} color={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Managers" value={count(stats.managers)} note="incl. the owner" icon={ManagerIcon} color={theme.palette.secondary.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Deactivated" value={count(stats.inactive)} note="kept for history" icon={InactiveIcon} color={theme.palette.grey[500]} /></Grid>
      </Grid>

      {loading && !staff.length ? <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box> : sorted.length === 0 ? (
        <EmptyState icon={StaffIcon} title="No staff yet">Add your cashiers so each sale shows who made it.</EmptyState>
      ) : (
        <Grid container spacing={1.5}>
          {sorted.map((m) => {
            const s = sales[m.id];
            return (
              <Grid key={m.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card sx={{ height: "100%", opacity: m.is_active ? 1 : 0.6 }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Avatar sx={{ width: 44, height: 44, fontWeight: 800, background: m.is_active ? BRAND_GRADIENT : theme.palette.grey[500] }}>
                        {initials(m.first_name || m.username)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={800} noWrap>
                          {m.first_name || m.username}{isMe(m) && <Typography component="span" variant="caption" color="text.secondary"> (you)</Typography>}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">@{m.username} · last login {timeAgo(m.last_login)}</Typography>
                      </Box>
                      {canManage(m) && <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, member: m })}><MoreIcon /></IconButton>}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.75, mt: 1.25, flexWrap: "wrap" }}>
                      <Chip size="small" label={roleOf(m)} color={m.is_admin ? "secondary" : m.is_manager ? "warning" : "primary"} sx={{ fontWeight: 700 }} />
                      {!m.is_active && <Chip size="small" label="Deactivated" variant="outlined" />}
                    </Box>
                    <Box sx={{ display: "flex", gap: 2, mt: 1.5 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Sales this month</Typography>
                        <Typography fontWeight={800}>{naira(s?.revenue)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Transactions</Typography>
                        <Typography fontWeight={800}>{count(s?.transactions)}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {!isOwner && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>Only the store owner can add or change managers.</Typography>}

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, member: null })}>
        {menu.member && [
          <MenuItem key="e" onClick={() => { const m = menu.member; setMenu({ anchor: null }); open("edit", m); }}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit name & role</MenuItem>,
          <MenuItem key="p" onClick={() => { const m = menu.member; setMenu({ anchor: null }); open("password", m); }}><ListItemIcon><LockIcon fontSize="small" /></ListItemIcon>Set new password</MenuItem>,
          menu.member.is_active
            ? <MenuItem key="d" onClick={() => { const m = menu.member; setMenu({ anchor: null }); setActive(m, false); }}><ListItemIcon><DeactivateIcon fontSize="small" /></ListItemIcon>Deactivate</MenuItem>
            : <MenuItem key="a" onClick={() => { const m = menu.member; setMenu({ anchor: null }); setActive(m, true); }}><ListItemIcon><ActivateIcon fontSize="small" /></ListItemIcon>Activate</MenuItem>,
          <MenuItem key="x" sx={{ color: "error.main" }} onClick={() => { const m = menu.member; setMenu({ anchor: null }); remove(m); }}>
            <ListItemIcon sx={{ color: "error.main" }}><DeleteIcon fontSize="small" /></ListItemIcon>Delete</MenuItem>,
        ]}
      </Menu>

      <Dialog open={Boolean(dialog)} onClose={() => !saving && setDialog(null)} maxWidth="xs" fullWidth>
        {dialog && (
          <>
            <DialogTitle>
              {dialog.type === "add" ? "Add staff" : dialog.type === "edit" ? `Edit ${dialog.member.username}` : `New password for ${dialog.member.username}`}
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
              {error && <Alert severity="error">{error}</Alert>}
              {dialog.type !== "password" && (
                <TextField label="Display name" value={f.first_name} onChange={(e) => setForm({ first_name: e.target.value })}
                  helperText="Shown in Reports and receipts, e.g. Amaka" autoFocus />
              )}
              {dialog.type === "add" && (
                <TextField label="Username (for logging in)" value={f.username} onChange={(e) => setForm({ username: e.target.value.replace(/\s/g, "") })}
                  helperText="3+ letters, numbers or _" required />
              )}
              {dialog.type !== "password" && (
                <TextField select label="Role" value={f.role} onChange={(e) => setForm({ role: e.target.value })}
                  helperText={f.role === "manager" ? "Can see reports, profit, restock, staff and settings" : "Can sell and see their own sales"}>
                  <MenuItem value="cashier">Cashier</MenuItem>
                  {isOwner && <MenuItem value="manager">Manager</MenuItem>}
                </TextField>
              )}
              {dialog.type === "edit" && (
                <FormControlLabel control={<Switch checked={f.active} onChange={(e) => setForm({ active: e.target.checked })} color="success" />}
                  label={f.active ? "Can log in" : "Deactivated (cannot log in)"} />
              )}
              {dialog.type !== "edit" && (
                <>
                  <TextField label="Password" type="password" value={f.password} onChange={(e) => setForm({ password: e.target.value })} helperText={`At least ${minPassword} characters. Avoid simple ones like 123456 or password.`} required />
                  <TextField label="Confirm password" type="password" value={f.confirm} onChange={(e) => setForm({ confirm: e.target.value })} required
                    error={f.confirm !== "" && f.confirm !== f.password} helperText={f.confirm !== "" && f.confirm !== f.password ? "Passwords don't match" : " "} />
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog(null)} disabled={saving}>Cancel</Button>
              <Button variant="contained" onClick={submit} disabled={!valid || saving}>{saving ? "Saving…" : dialog.type === "add" ? "Add" : "Save"}</Button>
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
