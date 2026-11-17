// Walk the shelves, type what is there, and save only the differences as count corrections
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Dialog, IconButton, InputAdornment, MenuItem,
  Paper, TextField, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Close as CloseIcon, Search as SearchIcon, Download as DownloadIcon, FactCheck as CountIcon } from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import { storeKey } from '../utils/storeKey';

const DRAFT_KEY = 'stock-count-draft';
const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const count = (n) => Number(n || 0).toLocaleString('en-NG');

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey(DRAFT_KEY)));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

export default function StockCountDialog({ open, onClose, products, categories, onDone }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [counts, setCounts] = useState(readDraft);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [show, setShow] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try { localStorage.setItem(storeKey(DRAFT_KEY), JSON.stringify(counts)); } catch { /* storage blocked */ }
  }, [counts]);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const entered = Object.entries(counts).filter(([id, v]) => v !== '' && byId[id]);
  const diffs = entered.map(([id, v]) => {
    const p = byId[id];
    return { p, counted: Number(v), diff: Number(v) - p.stock };
  });
  const changed = diffs.filter((d) => d.diff !== 0);
  const invalid = diffs.some((d) => !Number.isInteger(d.counted) || d.counted < 0);
  const shortValue = changed.filter((d) => d.diff < 0).reduce((s, d) => s + -d.diff * Number(d.p.cost_price || 0), 0);
  const overValue = changed.filter((d) => d.diff > 0).reduce((s, d) => s + d.diff * Number(d.p.cost_price || 0), 0);

  const visible = products.filter((p) => {
    const term = search.trim().toLowerCase();
    if (term && !p.name.toLowerCase().includes(term) && String(p.barcode).toLowerCase() !== term) return false;
    if (category !== 'all' && String(p.category?.id) !== category) return false;
    const v = counts[p.id];
    if (show === 'todo' && v !== undefined && v !== '') return false;
    if (show === 'diff' && (v === undefined || v === '' || Number(v) === p.stock)) return false;
    return true;
  });

  const setCount = (id, value) => setCounts((prev) => ({ ...prev, [id]: value }));

  const downloadSheet = async () => {
    try {
      const res = await axiosInstance.get('products/count-sheet/', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_count_${new Date().toLocaleDateString('en-CA')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download the count sheet.');
    }
  };

  const save = async () => {
    if (!entered.length || invalid) return;
    if (!window.confirm(`Save this count? ${changed.length} product(s) will be corrected to what you counted.`)) return;
    setSaving(true);
    setError('');
    try {
      const res = await axiosInstance.post('/stock-adjustments/', {
        items: entered.map(([id, v]) => ({ product_id: Number(id), counted: Number(v) })),
      });
      setCounts({});
      onDone?.(res.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (err.response ? 'Could not save the count' : 'No connection. Your counts are kept; try again when online.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullScreen={fullScreen} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: fullScreen ? '100%' : '90vh' } }}>
      <AppBar position="sticky" elevation={0} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Toolbar sx={{ gap: 1 }}>
          <CountIcon />
          <Typography sx={{ flex: 1, fontWeight: 700 }}>Stock count</Typography>
          <Button color="inherit" size="small" startIcon={<DownloadIcon />} onClick={downloadSheet}>Sheet</Button>
          <IconButton color="inherit" edge="end" onClick={onClose} disabled={saving}><CloseIcon /></IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Type what is on the shelf. Blank products are skipped. Only differences are saved, as count corrections.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="Search or barcode" value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: '2 1 180px' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <TextField select size="small" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ flex: '1 1 140px' }}>
            <MenuItem value="all">All categories</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          {[['all', 'All'], ['todo', 'Not counted'], ['diff', 'Differences']].map(([k, label]) => (
            <Chip key={k} size="small" label={label} onClick={() => setShow(k)} color={show === k ? 'primary' : 'default'}
              variant={show === k ? 'filled' : 'outlined'} />
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1, sm: 2 } }}>
        {visible.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Nothing to show.</Typography>}
        {visible.map((p) => {
          const v = counts[p.id] ?? '';
          const diff = v === '' ? null : Number(v) - p.stock;
          const pack = p.is_bulk_product && Number(p.bulk_quantity) > 1 ? Number(p.bulk_quantity) : 0;
          const color = diff === null ? 'divider' : diff === 0 ? 'success.main' : diff < 0 ? 'error.main' : 'info.main';
          return (
            <Paper key={p.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, mb: 0.75, borderRadius: 2, borderLeft: 4, borderLeftColor: color }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  System: <b>{count(p.stock)}</b>{pack ? ` · carton of ${pack}` : ''}
                  {diff !== null && diff !== 0 && (
                    <Box component="span" sx={{ color, fontWeight: 700 }}> · {diff > 0 ? '+' : ''}{count(diff)}</Box>
                  )}
                  {diff === 0 && <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}> · matches</Box>}
                </Typography>
              </Box>
              <TextField size="small" type="number" placeholder="Count" value={v} onChange={(e) => setCount(p.id, e.target.value)}
                inputProps={{ min: 0, step: 1, inputMode: 'numeric' }} sx={{ width: 96 }} />
            </Paper>
          );
        })}
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2 }, borderTop: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {invalid && <Alert severity="warning" sx={{ mb: 1 }}>Counts must be whole numbers, 0 or more.</Alert>}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="body2">{count(entered.length)} counted · <b>{count(changed.length)}</b> different</Typography>
          <Typography variant="body2">
            {shortValue > 0 && <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Short {naira(shortValue)}</Box>}
            {shortValue > 0 && overValue > 0 && ' · '}
            {overValue > 0 && <Box component="span" sx={{ color: 'info.main', fontWeight: 700 }}>Extra {naira(overValue)}</Box>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="error" disabled={!entered.length || saving} onClick={() => window.confirm('Clear all counts entered?') && setCounts({})}>Clear</Button>
          <Button fullWidth variant="contained" onClick={save} disabled={!entered.length || invalid || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            {saving ? 'Saving…' : `Save count (${count(entered.length)})`}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
