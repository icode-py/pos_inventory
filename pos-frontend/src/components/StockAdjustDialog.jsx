// Remove or correct stock with a reason, so missing goods are recorded instead of vanishing
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import axiosInstance from '../utils/axiosInstance';

export const ADJUST_REASONS = [
  { value: 'DAMAGED', label: 'Damaged', direction: 'remove' },
  { value: 'EXPIRED', label: 'Expired', direction: 'remove' },
  { value: 'STOLEN', label: 'Stolen or missing', direction: 'remove' },
  { value: 'RETURNED', label: 'Returned to supplier', direction: 'remove' },
  { value: 'COUNT', label: 'Count correction', direction: 'both' },
  { value: 'OTHER', label: 'Other (say why)', direction: 'both' },
];

const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const whole = (v) => (v === '' ? 0 : Number(v));

export default function StockAdjustDialog({ open, product, onClose, onDone }) {
  const [direction, setDirection] = useState('remove');
  const [packs, setPacks] = useState('');
  const [singles, setSingles] = useState('');
  const [reason, setReason] = useState('DAMAGED');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDirection('remove'); setPacks(''); setSingles(''); setReason('DAMAGED'); setNote(''); setError('');
    }
  }, [open, product?.id]);

  if (!product) return null;
  const packSize = product.is_bulk_product && Number(product.bulk_quantity) > 1 ? Number(product.bulk_quantity) : 1;
  const unit = product.unit_of_measure && product.unit_of_measure !== 'units' ? product.unit_of_measure : 'items';
  const amount = packSize > 1 ? whole(packs) * packSize + whole(singles) : whole(singles);
  const valid = Number.isInteger(amount) && amount > 0 && whole(packs) >= 0 && whole(singles) >= 0;
  const change = direction === 'remove' ? -amount : amount;
  const after = product.stock + change;
  const tooMany = after < 0;
  const reasons = ADJUST_REASONS.filter((r) => r.direction === 'both' || r.direction === direction);
  const needsNote = reason === 'OTHER' && !note.trim();
  const cost = product.cost_price != null ? Number(product.cost_price) : null;

  const switchDirection = (value) => {
    if (!value) return;
    setDirection(value);
    setReason(value === 'add' ? 'COUNT' : 'DAMAGED');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axiosInstance.post('/stock-adjustments/', {
        items: [{ product_id: product.id, change, reason, note: note.trim() }],
      });
      onDone?.(res.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (err.response ? 'Could not save the adjustment' : 'No connection. Nothing was changed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Adjust stock</DialogTitle>
      <DialogContent>
        <Typography fontWeight={700}>{product.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          In stock: <b>{product.stock.toLocaleString('en-NG')} {unit}</b>{packSize > 1 && ` · carton of ${packSize}`}
        </Typography>

        <ToggleButtonGroup exclusive fullWidth size="small" value={direction} onChange={(e, v) => switchDirection(v)} sx={{ mb: 2 }}>
          <ToggleButton value="remove" color="error" sx={{ fontWeight: 700 }}>Remove stock</ToggleButton>
          <ToggleButton value="add" color="success" sx={{ fontWeight: 700 }}>Add stock</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {packSize > 1 && (
            <TextField label="Cartons" type="number" size="small" value={packs} onChange={(e) => setPacks(e.target.value)}
              inputProps={{ min: 0, step: 1, inputMode: 'numeric' }} sx={{ flex: 1 }} />
          )}
          <TextField label={packSize > 1 ? `Extra ${unit}` : `How many ${unit}`} type="number" size="small" value={singles}
            onChange={(e) => setSingles(e.target.value)} inputProps={{ min: 0, step: 1, inputMode: 'numeric' }} sx={{ flex: 1 }} autoFocus />
        </Box>

        <TextField select fullWidth size="small" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mb: 2 }}>
          {reasons.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
        </TextField>
        <TextField fullWidth size="small" label={reason === 'OTHER' ? 'Note (required)' : 'Note (optional)'} value={note}
          onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 200 }} placeholder="e.g. 2 cans burst in the crate" sx={{ mb: 2 }} />

        {direction === 'add' && (
          <Alert severity="info" sx={{ mb: 1.5 }}>For a supplier delivery use the Restock page, so spending is tracked.</Alert>
        )}
        {valid && !tooMany && (
          <Alert severity={direction === 'remove' ? 'warning' : 'success'} icon={false}>
            Stock {product.stock.toLocaleString('en-NG')} → <b>{after.toLocaleString('en-NG')}</b>
            {cost !== null && <> · worth {naira(Math.abs(change) * cost)} at cost</>}
          </Alert>
        )}
        {valid && tooMany && <Alert severity="error">Only {product.stock.toLocaleString('en-NG')} in stock.</Alert>}
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" color={direction === 'remove' ? 'error' : 'success'} onClick={save}
          disabled={!valid || tooMany || needsNote || saving}>
          {saving ? 'Saving…' : direction === 'remove' ? `Remove ${amount || ''}` : `Add ${amount || ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
