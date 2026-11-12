import { useContext, useEffect, useMemo, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { AuthContext } from "../context/AuthContext";
import { TIER_LABELS } from "../context/StoreContext";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Grid, InputAdornment, MenuItem, Stack, Switch, TextField, Typography
} from "@mui/material";
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Key as KeyIcon, ContentCopy as CopyIcon
} from "@mui/icons-material";

// Monthly list prices in USD, used only for the income estimate
const PLAN_PRICES_USD = { STARTER: 30, GROWTH: 60, BUSINESS: 90 };
const PLAN_COLORS = { STARTER: 'default', GROWTH: 'primary', BUSINESS: 'secondary' };

const naira = (amount) => `₦${parseFloat(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const date = (value) => new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const errorMessage = (err) => {
  const data = err.response?.data;
  if (!data || typeof data !== 'object') return 'Something went wrong. Please try again.';
  return Object.values(data).flat().join(' ');
};

const PlanSelect = ({ value, onChange }) => (
  <TextField select label="Plan" fullWidth value={value} onChange={(e) => onChange(e.target.value)}>
    {Object.entries(TIER_LABELS).map(([tier, label]) => (
      <MenuItem key={tier} value={tier}>{label} (${PLAN_PRICES_USD[tier]}/month)</MenuItem>
    ))}
  </TextField>
);

function NewStoreDialog({ open, onClose, onCreated }) {
  const empty = { name: '', plan_tier: 'STARTER', admin_username: '', admin_password: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setForm(empty);
    setError('');
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axiosInstance.post('platform/stores/', form);
      setCreated({ ...form, store: res.data });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const loginDetails = created && [
    `Your ${created.name} till is ready.`,
    `Log in at: ${window.location.origin}/login`,
    `Username: ${created.admin_username}`,
    `Password: ${created.admin_password}`,
    'Please change your password after you log in.',
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(loginDetails);
      setCopied(true);
    } catch {
      setError('Could not copy. Select the text and copy it instead.');
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{created ? 'Store created' : 'New store'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {created ? (
          <>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Send these login details to the store owner. The password is not shown again.
            </Typography>
            <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', fontSize: '0.85rem', m: 0 }}>
              {loginDetails}
            </Box>
          </>
        ) : (
          <Stack spacing={2}>
            <TextField label="Store name" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <PlanSelect value={form.plan_tier} onChange={(plan_tier) => setForm({ ...form, plan_tier })} />
            <TextField
              label="Owner's username"
              fullWidth
              value={form.admin_username}
              onChange={(e) => setForm({ ...form, admin_username: e.target.value })}
              helperText="Letters, numbers and _ only. Must not be used by any other store."
            />
            <TextField
              label="Owner's first password"
              fullWidth
              value={form.admin_password}
              onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
              helperText="At least 8 characters, not too simple."
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {created ? (
          <>
            <Button startIcon={<CopyIcon />} onClick={copy}>{copied ? 'Copied' : 'Copy details'}</Button>
            <Button variant="contained" onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Creating...' : 'Create store'}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function EditStoreDialog({ store, isOwnStore, onClose, onSaved }) {
  const [form, setForm] = useState(store);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (store.is_active && !form.is_active &&
        !window.confirm(`Suspend ${store.name}? Its staff will be logged out and cannot log in until you reactivate it.`)) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axiosInstance.patch(`platform/stores/${store.id}/`, {
        name: form.name, plan_tier: form.plan_tier, is_active: form.is_active,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {store.name}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Store name" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <PlanSelect value={form.plan_tier} onChange={(plan_tier) => setForm({ ...form, plan_tier })} />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                disabled={isOwnStore}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
            }
            label={form.is_active ? 'Active' : 'Suspended: staff cannot log in'}
          />
          {isOwnStore && (
            <Typography variant="caption" color="text.secondary">
              This is your own store. Suspending it would lock you out, so it stays active.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ResetPasswordDialog({ store, onClose }) {
  const [username, setUsername] = useState(store.admins[0] || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axiosInstance.post(`platform/stores/${store.id}/reset-password/`, { username, password });
      setDone(res.data.detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reset a password at {store.name}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {done ? (
          <Alert severity="success">{done} Send the new password to them privately.</Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Username"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              helperText={store.admins.length ? `Admins: ${store.admins.join(', ')}. Any staff member of this store works.` : 'Any staff member of this store'}
            />
            <TextField label="New password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{done ? 'Done' : 'Cancel'}</Button>
        {!done && (
          <Button variant="contained" onClick={submit} disabled={saving || !username || !password}>
            {saving ? 'Saving...' : 'Set password'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const SummaryCard = ({ label, value, detail }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 'bold', my: 0.5 }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">{detail}</Typography>
    </CardContent>
  </Card>
);

export default function PlatformPage() {
  const { user } = useContext(AuthContext);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);

  const load = async () => {
    try {
      const res = await axiosInstance.get('platform/stores/');
      setStores(res.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = stores.filter((s) => s.is_active);
  const monthlyIncome = active.reduce((sum, s) => sum + (PLAN_PRICES_USD[s.plan_tier] || 0), 0);
  const planCounts = Object.keys(TIER_LABELS)
    .map((tier) => `${active.filter((s) => s.plan_tier === tier).length} ${TIER_LABELS[tier]}`)
    .join(' · ');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stores;
    return stores.filter((s) => s.name.toLowerCase().includes(term) || s.admins.some((a) => a.toLowerCase().includes(term)));
  }, [stores, search]);

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: { xs: '1.2rem', md: '1.5rem' } }}>Platform</Typography>
          <Typography variant="body2" color="text.secondary">Every store on your system</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>New store</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SummaryCard label="STORES" value={`${active.length} active`} detail={`${stores.length - active.length} suspended · ${planCounts}`} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SummaryCard label="EST. MONTHLY INCOME" value={`$${monthlyIncome.toLocaleString()}`} detail="Active stores at monthly list price" />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            size="small"
            placeholder="Search by store or owner username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 2 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          />

          <Stack spacing={2}>
            {shown.map((store) => (
              <Card key={store.id} sx={{ opacity: store.is_active ? 1 : 0.75 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', overflowWrap: 'anywhere' }}>
                        {store.name}
                        {store.id === user?.store_id && <Chip label="Your store" size="small" variant="outlined" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Owner: {store.admins.join(', ') || 'no admin yet'} · since {date(store.created_at)}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1}>
                      <Chip label={TIER_LABELS[store.plan_tier]} color={PLAN_COLORS[store.plan_tier]} size="small" />
                      <Chip label={store.is_active ? 'Active' : 'Suspended'} color={store.is_active ? 'success' : 'error'} size="small" />
                    </Box>
                  </Box>

                  <Grid container spacing={1} sx={{ mt: 1.5 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Sales, 30 days</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{naira(store.sales_30d_total)}</Typography>
                      <Typography variant="caption" color="text.secondary">{store.sales_30d_count} sales</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Last sale</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{store.last_sale_at ? date(store.last_sale_at) : 'None yet'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Staff</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{store.staff_count}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Products</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{store.product_count}</Typography>
                    </Grid>
                  </Grid>

                  <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(store)}>
                      Edit plan or status
                    </Button>
                    <Button size="small" startIcon={<KeyIcon />} onClick={() => setResetting(store)}>
                      Reset password
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {shown.length === 0 && <Alert severity="info">No stores match "{search}".</Alert>}
          </Stack>
        </>
      )}

      <NewStoreDialog open={creating} onClose={() => setCreating(false)} onCreated={load} />
      {editing && (
        <EditStoreDialog
          store={editing}
          isOwnStore={editing.id === user?.store_id}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {resetting && <ResetPasswordDialog store={resetting} onClose={() => setResetting(null)} />}
    </Box>
  );
}
