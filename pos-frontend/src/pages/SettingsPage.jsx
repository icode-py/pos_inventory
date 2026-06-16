import { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Grid, Divider,
  Alert, CircularProgress, Snackbar
} from '@mui/material';
import { Save as SaveIcon, Store as StoreIcon } from '@mui/icons-material';
import { useStore } from '../context/StoreContext';
import axiosInstance from '../utils/axiosInstance';

export default function SettingsPage() {
  const { store, setStore } = useStore();
  const [form, setForm] = useState({ ...store });
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Keep form in sync if store loads after mount
  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.patch('/store-settings/update/', form);
      setStore(res.data);
      setSnack({ open: true, message: 'Settings saved successfully', severity: 'success' });
    } catch (err) {
      const detail = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Failed to save settings';
      setSnack({ open: true, message: detail, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <StoreIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight="bold">Store Settings</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Branding
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Store Name"
              name="name"
              value={form.name || ''}
              onChange={handleChange}
              fullWidth
              required
              helperText="Shown on receipts, sidebar, and top bar"
            />
          </Grid>
          <Grid item size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Tagline"
              name="tagline"
              value={form.tagline || ''}
              onChange={handleChange}
              fullWidth
              helperText="Short description shown below store name"
            />
          </Grid>

          <Grid item size={{ xs: 12 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Phone Number"
              name="phone"
              value={form.phone || ''}
              onChange={handleChange}
              fullWidth
              helperText="Printed on receipt"
            />
          </Grid>
          <Grid item size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email Address"
              name="email"
              value={form.email || ''}
              onChange={handleChange}
              fullWidth
              type="email"
              helperText="Optional"
            />
          </Grid>
          <Grid item size={{ xs: 12 }}>
            <TextField
              label="Address"
              name="address"
              value={form.address || ''}
              onChange={handleChange}
              fullWidth
              helperText="Printed on receipt"
            />
          </Grid>

          <Grid item size={{ xs: 12 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
              Receipt
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item size={{ xs: 12 }}>
            <TextField
              label="Receipt Footer Message"
              name="receipt_footer"
              value={form.receipt_footer || ''}
              onChange={handleChange}
              fullWidth
              helperText='e.g. "Thank you for shopping with us!"'
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
