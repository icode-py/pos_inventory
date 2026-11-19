import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Grid, InputAdornment, Paper, Snackbar, Switch, Tab, Tabs,
  TextField, Typography, useTheme,
} from "@mui/material";
import {
  Settings as SettingsIcon, Storefront as StoreIcon, Loyalty as LoyaltyIcon, Inventory2 as StockIcon,
  WorkspacePremium as PlanIcon, AccountCircle as AccountIcon, Save as SaveIcon, CheckCircle as YesIcon,
  Cancel as NoIcon, WhatsApp as WhatsAppIcon, Lock as LockIcon,
} from "@mui/icons-material";
import { AuthContext } from "../context/AuthContext";
import { CASHIER_LIMITS, TIER_LABELS, hasFeatureForTier, useStore } from "../context/StoreContext";
import axiosInstance from "../utils/axiosInstance";
import Receipt from "../components/Receipt";
import { WHATSAPP_NUMBER } from "../components/UpgradePrompt";
import { BRAND_GRADIENT, PageHeader, Section, naira } from "../components/PagePieces";

const STORE_FIELDS = ["name", "tagline", "phone", "email", "address", "receipt_footer", "low_stock_threshold", "loyalty_enabled",
  "loyalty_amount_per_point", "loyalty_point_value", "loyalty_silver_points", "loyalty_gold_points"];
const pick = (store) => Object.fromEntries(STORE_FIELDS.map((k) => [k, store?.[k] ?? ""]));
const FEATURES = [
  ["Selling, receipts, offline mode", null], ["Products, restock, stock counts", null], ["Sales reports", null],
  ["Customers & loyalty points", "customer_loyalty"], ["Excel bulk upload", "bulk_upload"], ["Bulk discounts", "bulk_discounts"],
  ["Audit log", "audit_log"], ["Profit & margins", "margin_analytics"],
];
const SAMPLE_SALE = {
  total_amount: 1900, paid_amount: 2000, change_given: 100, payment_method: "CASH", timestamp: new Date().toLocaleString(),
  items: [{ product: { name: "Coca-Cola 50cl" }, quantity: 2, line_total: 1000 }, { product: { name: "Indomie Chicken 70g" }, quantity: 3, line_total: 900 }],
};
const errorText = (err) => {
  const d = err.response?.data;
  if (!d || typeof d !== "object") return err.response ? "Could not save" : "No connection";
  return d.error || Object.entries(d).map(([k, v]) => `${k.replace(/_/g, " ")}: ${[].concat(v).join(" ")}`).join(" · ");
};

export default function SettingsPage() {
  const theme = useTheme();
  const { user, replaceTokens } = useContext(AuthContext);
  const minPassword = user?.role === "cashier" ? 6 : 8;
  const { store, setStore, refreshStore } = useStore();
  const [params] = useSearchParams();
  // Cashiers only get their own account; managers and the owner get the store settings too
  const isManager = user?.role === "manager" || user?.role === "admin";
  const [tab, setTab] = useState(() => (!isManager || params.get("tab") === "account" ? 4 : 0));
  const [form, setForm] = useState(() => pick(store));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setSnack({ open: true, message, severity });

  // The store loads from the server after the page opens; follow it until the user starts editing
  useEffect(() => { if (isManager) refreshStore?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!dirty) setForm(pick(store)); }, [store, dirty]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value })); setDirty(true); };
  const changed = useMemo(() => Object.fromEntries(STORE_FIELDS.filter((k) => String(form[k]) !== String(store?.[k] ?? "")).map((k) => [k, form[k]])), [form, store]);

  const save = async () => {
    if (!Object.keys(changed).length) return;
    setSaving(true);
    try {
      const res = await axiosInstance.patch("/store-settings/update/", changed);
      setStore((s) => ({ ...s, ...res.data }));
      setDirty(false);
      notify("Settings saved");
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwSaving(true);
    try {
      const res = await axiosInstance.post("/me/password/", { current_password: pw.current, new_password: pw.next });
      if (res.data?.tokens) replaceTokens(res.data.tokens);
      setPw({ current: "", next: "", confirm: "" });
      notify("Password changed. Any other device logged in as you has been logged out.");
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setPwSaving(false);
    }
  };

  const tier = store?.plan_tier || "STARTER";
  const perPoint = Number(form.loyalty_amount_per_point) || 0;
  const pointValue = Number(form.loyalty_point_value) || 0;
  const tabs = [["Store & receipt", StoreIcon], ["Loyalty", LoyaltyIcon], ["Stock", StockIcon], ["My plan", PlanIcon], ["My account", AccountIcon]];
  const storeTab = isManager && tab <= 2;
  const upgradeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I'd like to upgrade ${store?.name || "my store"} from the ${TIER_LABELS[tier]} plan.`)}`;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1100, mx: "auto", pb: storeTab && dirty ? 12 : 3 }}>
      <PageHeader icon={SettingsIcon} title="Settings" subtitle={store?.name} />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {tabs.map(([label, Icon], i) => <Tab key={label} value={i} icon={<Icon fontSize="small" />} iconPosition="start" label={label} sx={{ minHeight: 52, display: isManager || i === 4 ? undefined : "none" }} />)}
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Section title="Store details" icon={StoreIcon}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Store name" value={form.name} onChange={set("name")} required helperText="On receipts and the top bar" /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Tagline" value={form.tagline} onChange={set("tagline")} helperText="Under the name on receipts" /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Phone" value={form.phone} onChange={set("phone")} inputProps={{ inputMode: "tel" }} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Email" type="email" value={form.email} onChange={set("email")} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth label="Address" value={form.address} onChange={set("address")} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth label="Receipt message" value={form.receipt_footer} onChange={set("receipt_footer")} helperText='e.g. "Thank you! Goods sold in good condition are not returnable."' /></Grid>
              </Grid>
            </Section>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Section title="Receipt preview">
              <Box sx={{ display: "flex", justifyContent: "center", bgcolor: "action.hover", borderRadius: 2, p: 2 }}>
                <Box sx={{ bgcolor: "#fff", color: "#000", boxShadow: 2 }}><Receipt sale={SAMPLE_SALE} store={{ ...store, ...form }} /></Box>
              </Box>
            </Section>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Section title="Loyalty points" icon={LoyaltyIcon} color={theme.palette.warning.main}>
          <FormControlLabel control={<Switch checked={!!form.loyalty_enabled} onChange={set("loyalty_enabled")} color="success" />}
            label={form.loyalty_enabled ? "Customers earn and use points" : "Points are switched off"} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="Spend to earn 1 point" value={form.loyalty_amount_per_point} onChange={set("loyalty_amount_per_point")}
                disabled={!form.loyalty_enabled} InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="1 point is worth" value={form.loyalty_point_value} onChange={set("loyalty_point_value")}
                disabled={!form.loyalty_enabled} InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }} helperText="Off the bill when used at the till" />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Silver from (points)" value={form.loyalty_silver_points} onChange={set("loyalty_silver_points")} disabled={!form.loyalty_enabled} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Gold from (points)" value={form.loyalty_gold_points} onChange={set("loyalty_gold_points")} disabled={!form.loyalty_enabled} />
            </Grid>
          </Grid>
          {form.loyalty_enabled && perPoint > 0 && pointValue > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              A customer who spends <b>{naira(10000)}</b> earns <b>{Math.floor(10000 / perPoint)} points</b>, worth <b>{naira(Math.floor(10000 / perPoint) * pointValue)}</b> off a later purchase
              {" "}({((pointValue / perPoint) * 100).toFixed(1)}% back).
            </Alert>
          )}
        </Section>
      )}

      {tab === 2 && (
        <Section title="Stock" icon={StockIcon} color={theme.palette.info.main}>
          <TextField type="number" label="Low stock level" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} sx={{ maxWidth: 260 }}
            helperText="Products with this many or fewer left show as Low stock across the app" inputProps={{ min: 0 }} />
        </Section>
      )}

      {tab === 3 && (
        <Section title={`You're on ${TIER_LABELS[tier] || tier}`} icon={PlanIcon} color={theme.palette.secondary.main}
          action={tier !== "BUSINESS" && <Button variant="contained" startIcon={<WhatsAppIcon />} href={upgradeUrl} target="_blank" sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1ebe5a" } }}>Upgrade</Button>}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Cashier accounts: {CASHIER_LIMITS[tier] == null ? "unlimited" : CASHIER_LIMITS[tier]}
          </Typography>
          <Grid container spacing={1}>
            {FEATURES.map(([label, feature]) => {
              const ok = !feature || hasFeatureForTier(feature, tier);
              return (
                <Grid key={label} size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                    {ok ? <YesIcon color="success" fontSize="small" /> : <NoIcon color="disabled" fontSize="small" />}
                    <Typography variant="body2" color={ok ? "text.primary" : "text.disabled"}>{label}</Typography>
                    {!ok && <Chip size="small" variant="outlined" label={feature === "margin_analytics" ? "Business" : "Growth"} />}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Section>
      )}

      {tab === 4 && (
        <Section title="My account" icon={AccountIcon}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Logged in as <b>{user?.username}</b> ({user?.role === "admin" ? "owner" : user?.role})
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Change my password</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 360 }}>
            <TextField type="password" label="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            <TextField type="password" label="New password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} helperText={`At least ${minPassword} characters, not a common password`} autoComplete="new-password" />
            <TextField type="password" label="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              error={pw.confirm !== "" && pw.confirm !== pw.next} helperText={pw.confirm !== "" && pw.confirm !== pw.next ? "Passwords don't match" : " "} autoComplete="new-password" />
            <Button variant="contained" startIcon={pwSaving ? <CircularProgress size={16} color="inherit" /> : <LockIcon />} onClick={changePassword}
              disabled={pwSaving || !pw.current || pw.next.length < minPassword || pw.next !== pw.confirm} sx={{ alignSelf: "flex-start" }}>
              Change password
            </Button>
          </Box>
        </Section>
      )}

      {storeTab && dirty && Object.keys(changed).length > 0 && (
        <Paper elevation={8} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: theme.zIndex.appBar, p: 1.25, pb: "calc(10px + env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", gap: 1 }}>
          <Button onClick={() => { setForm(pick(store)); setDirty(false); }} disabled={saving}>Discard</Button>
          <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            sx={{ background: BRAND_GRADIENT, px: 4 }}>Save {Object.keys(changed).length} change{Object.keys(changed).length === 1 ? "" : "s"}</Button>
        </Paper>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert variant="filled" severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
