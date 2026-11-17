import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { storeKey } from '../utils/storeKey';
import BarcodeScannerDialog from '../components/BarcodeScannerDialog';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, IconButton,
  InputAdornment, Paper, Snackbar, TextField, Tooltip, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Inventory2 as InventoryIcon, QrCodeScanner as ScanIcon, Delete as DeleteIcon, Search as SearchIcon,
  ShoppingCart as CartIcon, LocalShipping as TruckIcon, History as HistoryIcon, Payments as SpendIcon,
  RemoveShoppingCart as OutIcon, WarningAmber as WarningIcon, AddCircle as AddIcon, Refresh as RefreshIcon,
  CheckCircle as DoneIcon, AutoAwesome as SuggestIcon,
} from '@mui/icons-material';

const BRAND_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const DELIVERY_KEY = 'restock-delivery';

const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const count = (n) => Number(n || 0).toLocaleString('en-NG');
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const isPack = (p) => p && p.is_bulk_product && Number(p.bulk_quantity) > 1;
const unitWord = (p, n = 2) => {
  const u = p?.unit_of_measure && p.unit_of_measure !== 'units' ? p.unit_of_measure : 'items';
  return n === 1 ? u.replace(/s$/, '') : u;
};

function IconBadge({ icon: Icon, color, size = 36 }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: 2.5, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: alpha(color, 0.14), color }}>
      <Icon sx={{ fontSize: Math.round(size * 0.55) }} />
    </Box>
  );
}

function Section({ title, icon, color, action, children }) {
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <IconBadge icon={icon} color={color || theme.palette.primary.main} size={32} />
            <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, note, icon, color }) {
  return (
    <Paper variant="outlined" sx={{
      p: 1.5, height: '100%', borderRadius: 3, borderColor: alpha(color, 0.3),
      backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, transparent 70%)`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <IconBadge icon={icon} color={color} size={30} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      </Box>
      <Typography fontWeight={800} sx={{ fontSize: { xs: '1.15rem', sm: '1.35rem' }, overflowWrap: 'anywhere' }}>{value}</Typography>
      {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
    </Paper>
  );
}

/** How many items a delivery line adds, from cartons + singles (or a plain quantity). */
const lineUnits = (line) => (line.packSize > 1 ? num(line.packs) * line.packSize + num(line.singles) : num(line.quantity));

function readDelivery() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey(DELIVERY_KEY)));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const Restock = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

  // The line being entered
  const [selected, setSelected] = useState(null);
  const [inputText, setInputText] = useState('');
  const [packs, setPacks] = useState('');
  const [singles, setSingles] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const packsRef = useRef(null);

  // Lines waiting to be saved together (one supplier delivery); kept if the page is refreshed
  const [delivery, setDelivery] = useState(readDelivery);
  const [saving, setSaving] = useState(false);

  // History
  const [history, setHistory] = useState({ results: [], count: 0, page: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');

  const notify = (message, severity = 'info') => setFeedback({ open: true, message, severity });
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  useEffect(() => {
    try { localStorage.setItem(storeKey(DELIVERY_KEY), JSON.stringify(delivery)); } catch { /* storage full or blocked */ }
  }, [delivery]);

  const loadProducts = useCallback(() => axiosInstance.get('/products/')
    .then((res) => setProducts(res.data))
    .catch((err) => notify(err.response ? 'Could not load products' : 'No connection. Restocking needs the internet.', 'error')), []);
  const loadSummary = useCallback(() => axiosInstance.get('/restock-summary/').then((res) => setSummary(res.data)).catch(() => {}), []);
  const loadSuggestions = useCallback(() => axiosInstance.get('/analytics/stock/').then((res) => setSuggestions(res.data)).catch(() => setSuggestions(null)), []);
  const loadHistory = useCallback(async (page = 1, term = search) => {
    setHistoryLoading(true);
    try {
      const res = await axiosInstance.get('/restock-history/', { params: { page, search: term || undefined } });
      setHistory((prev) => ({
        results: page === 1 ? res.data.results : [...prev.results, ...res.data.results],
        count: res.data.count, page,
      }));
    } catch {
      /* the products error already explains a lost connection */
    } finally {
      setHistoryLoading(false);
    }
  }, [search]);

  useEffect(() => { loadProducts(); loadSummary(); loadSuggestions(); }, [loadProducts, loadSummary, loadSuggestions]);
  useEffect(() => {
    const t = setTimeout(() => loadHistory(1, search), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entering a line ──────────────────────────────────────────────────────
  const choose = (product, suggestedQty) => {
    setSelected(product);
    setInputText('');
    if (!product) return;
    const size = isPack(product) ? Number(product.bulk_quantity) : 1;
    const qty = suggestedQty || 0;
    if (size > 1) {
      setPacks(qty ? String(Math.ceil(qty / size)) : '');
      setSingles('');
      setCost(String(num(product.cost_price) * size));
    } else {
      setQuantity(qty ? String(qty) : '');
      setCost(String(num(product.cost_price)));
    }
    setTimeout(() => packsRef.current?.focus(), 50);
  };

  const packSize = isPack(selected) ? Number(selected.bulk_quantity) : 1;
  const draftUnits = selected ? lineUnits({ packSize, packs, singles, quantity }) : 0;
  // Cost is typed per carton for carton products, per item otherwise
  const draftUnitCost = cost === '' ? null : num(cost) / packSize;
  const savedCost = selected ? num(selected.cost_price) : 0;
  const costDiffers = selected && draftUnitCost !== null && Math.abs(draftUnitCost - savedCost) >= 0.01;
  const draftValid = selected && Number.isInteger(draftUnits) && draftUnits > 0 && (cost === '' || num(cost) >= 0);

  const resetDraft = () => {
    setSelected(null); setPacks(''); setSingles(''); setQuantity(''); setCost('');
  };

  const addLine = () => {
    if (!draftValid) return;
    setDelivery((prev) => {
      const line = {
        product_id: selected.id, name: selected.name, packSize, packs, singles, quantity,
        unit_cost: draftUnitCost === null ? null : Math.round(draftUnitCost * 100) / 100,
      };
      const existing = prev.findIndex((l) => l.product_id === selected.id);
      if (existing >= 0) {
        const merged = [...prev];
        const old = merged[existing];
        const units = lineUnits(old) + draftUnits;
        merged[existing] = { ...line, packSize: 1, packs: '', singles: '', quantity: String(units) };
        return merged;
      }
      return [...prev, line];
    });
    notify(`${selected.name}: ${count(draftUnits)} added to this delivery`, 'success');
    resetDraft();
  };

  const onScan = (code) => {
    setScanOpen(false);
    const product = products.find((p) => String(p.barcode).trim() === String(code).trim());
    if (product) choose(product);
    else notify(`No product with barcode ${code}. Add it on the Products page first.`, 'warning');
  };

  // ── Saving the delivery ──────────────────────────────────────────────────
  const deliveryUnits = delivery.reduce((s, l) => s + lineUnits(l), 0);
  const deliveryCost = delivery.reduce((s, l) => s + (l.unit_cost === null ? 0 : l.unit_cost * lineUnits(l)), 0);
  const deliveryHasCost = delivery.some((l) => l.unit_cost !== null);

  const saveDelivery = async () => {
    if (!delivery.length || saving) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post('/restock/', {
        items: delivery.map((l) => ({ product_id: l.product_id, quantity: lineUnits(l), unit_cost: l.unit_cost })),
      });
      notify(res.data.message, 'success');
      setDelivery([]);
      loadProducts(); loadSummary(); loadSuggestions(); loadHistory(1, search);
    } catch (err) {
      notify(err.response?.data?.error || (err.response ? 'Restock failed' : 'No connection. Nothing was saved, try again when online.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Suggestions from sales speed ─────────────────────────────────────────
  const suggested = useMemo(() => {
    if (!suggestions) return [];
    const inDelivery = new Set(delivery.map((l) => l.product_id));
    return [
      ...suggestions.out_of_stock_selling.map((x) => ({ ...x, urgent: true, note: 'Out of stock' })),
      ...suggestions.running_out.map((x) => ({ ...x, urgent: x.days_left <= 3, note: `${count(x.stock)} left · ~${Math.max(Math.round(x.days_left), 1)} day${Math.round(x.days_left) === 1 ? '' : 's'}` })),
    ].filter((x) => !inDelivery.has(x.id)).slice(0, 8);
  }, [suggestions, delivery]);

  const historyByDay = useMemo(() => {
    const groups = [];
    history.results.forEach((r) => {
      const day = new Date(r.restocked_at).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, rows: [] });
      groups[groups.length - 1].rows.push(r);
    });
    return groups;
  }, [history.results]);

  const filterOptions = (options, { inputValue }) => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return options.slice(0, 50);
    const exact = options.filter((p) => String(p.barcode).toLowerCase() === term);
    if (exact.length) return exact;
    return options.filter((p) => p.name.toLowerCase().includes(term) || String(p.barcode).toLowerCase().includes(term)).slice(0, 50);
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: 'grid', placeItems: 'center', background: BRAND_GRADIENT, color: '#fff' }}>
              <TruckIcon fontSize="small" />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' } }}>Restock</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add a delivery to your stock. Prices are changed on the Products page.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton color="primary" onClick={() => { loadProducts(); loadSummary(); loadSuggestions(); loadHistory(1, search); }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Headline numbers */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Restocked today" icon={TruckIcon} color={theme.palette.primary.main}
            value={summary ? `${count(summary.today_items)} items` : '—'}
            note={summary ? `${count(summary.today_restocks)} restock${summary.today_restocks === 1 ? '' : 's'}` : ''} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Spent this month" icon={SpendIcon} color={theme.palette.success.main}
            value={summary ? naira(summary.month_spend) : '—'} note="On restocks with a cost entered" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Out of stock" icon={OutIcon} color={theme.palette.error.main}
            value={summary ? count(summary.out_of_stock) : '—'} note="products" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Low stock" icon={WarningIcon} color={theme.palette.warning.main}
            value={summary ? count(summary.low_stock) : '—'} note={summary ? `${summary.low_stock_threshold} or fewer left` : ''} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Add stock */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Add stock" icon={AddIcon}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Autocomplete
                fullWidth
                options={products}
                // A search box only: the chosen product shows in the card below and the box empties
                value={null}
                inputValue={inputText}
                onInputChange={(e, v, reason) => { if (reason === 'input' || reason === 'clear') setInputText(v); }}
                onChange={(e, p) => { if (p) choose(p); setInputText(''); }}
                blurOnSelect
                clearOnBlur={false}
                getOptionLabel={(p) => p?.name || ''}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                filterOptions={filterOptions}
                noOptionsText="No product found. Add it on the Products page."
                renderOption={(props, p) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={p.id} {...rest} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.barcode}{isPack(p) ? ` · carton of ${p.bulk_quantity}` : ''}</Typography>
                      </Box>
                      <Chip size="small" label={`${count(p.stock)} left`} color={p.stock === 0 ? 'error' : p.stock <= 10 ? 'warning' : 'default'} variant="outlined" />
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Search product or type barcode" size="small"
                    InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>{params.InputProps.startAdornment}</> }} />
                )}
              />
              <Tooltip title="Scan barcode">
                <IconButton color="primary" onClick={() => setScanOpen(true)} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <ScanIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {!selected ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Search, scan, or tap a suggestion to start.
              </Typography>
            ) : (
              <>
                <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <Typography fontWeight={700}>{selected.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    In stock: <b>{count(selected.stock)} {unitWord(selected, selected.stock)}</b>
                    {packSize > 1 && <> · Carton of {packSize}</>}
                    {' · '}Saved cost {naira(selected.cost_price)} per {unitWord(selected, 1)}
                  </Typography>
                </Paper>

                {packSize > 1 ? (
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField label="Cartons" type="number" size="small" value={packs} inputRef={packsRef}
                      onChange={(e) => setPacks(e.target.value)} inputProps={{ min: 0, step: 1, inputMode: 'numeric' }} sx={{ flex: 1 }} />
                    <TextField label={`Extra ${unitWord(selected)}`} type="number" size="small" value={singles}
                      onChange={(e) => setSingles(e.target.value)} inputProps={{ min: 0, step: 1, inputMode: 'numeric' }} sx={{ flex: 1 }} />
                  </Box>
                ) : (
                  <TextField fullWidth label={`Quantity (${unitWord(selected)})`} type="number" size="small" value={quantity} inputRef={packsRef}
                    onChange={(e) => setQuantity(e.target.value)} inputProps={{ min: 1, step: 1, inputMode: 'numeric' }} sx={{ mb: 1.5 }} />
                )}

                <TextField fullWidth size="small" type="number" value={cost} onChange={(e) => setCost(e.target.value)}
                  label={packSize > 1 ? 'Cost per carton (optional)' : `Cost per ${unitWord(selected, 1)} (optional)`}
                  helperText={packSize > 1 && cost !== '' ? `= ${naira(num(cost) / packSize)} per ${unitWord(selected, 1)}` : 'What you paid, to track spending'}
                  inputProps={{ min: 0, inputMode: 'decimal' }}
                  InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }} sx={{ mb: 1 }} />

                {costDiffers && (
                  <Alert severity="info" sx={{ mb: 1.5, py: 0 }}
                    action={<Button size="small" color="inherit" onClick={() => navigate('/products')}>Products</Button>}>
                    Different from the saved cost ({naira(savedCost)}). If the supplier price changed, update it on the Products page so profit stays right.
                  </Alert>
                )}

                {draftUnits > 0 && (
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    = <b>{count(draftUnits)} {unitWord(selected, draftUnits)}</b> · new stock <b>{count(selected.stock + draftUnits)}</b>
                    {draftUnitCost !== null && <> · {naira(draftUnitCost * draftUnits)}</>}
                  </Typography>
                )}
                {selected && (packSize > 1 ? (packs !== '' || singles !== '') : quantity !== '') && !draftValid && (
                  <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>Enter whole numbers above 0.</Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={addLine} disabled={!draftValid} fullWidth>
                    Add to delivery
                  </Button>
                  <Button onClick={resetDraft}>Cancel</Button>
                </Box>
              </>
            )}
          </Section>
        </Grid>

        {/* Delivery list */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title={`This delivery (${delivery.length})`} icon={CartIcon} color={theme.palette.success.main}
            action={delivery.length > 0 && <Button size="small" color="error" onClick={() => setDelivery([])}>Clear</Button>}>
            {delivery.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                Products you add appear here. Save them together when the delivery is checked.
              </Typography>
            ) : (
              <>
                {delivery.map((l) => {
                  const units = lineUnits(l);
                  const product = byId[l.product_id];
                  return (
                    <Box key={l.product_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, pl: 1.25, mb: 0.75, borderRadius: 2, borderLeft: 4, borderLeftColor: 'success.main', bgcolor: alpha(theme.palette.text.primary, 0.025) }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{l.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l.packSize > 1 ? `${count(num(l.packs))} carton${num(l.packs) === 1 ? '' : 's'}${num(l.singles) ? ` + ${count(num(l.singles))}` : ''} = ` : ''}
                          {count(units)} {unitWord(product, units)}
                          {product ? ` · stock ${count(product.stock)} → ${count(product.stock + units)}` : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="body2" fontWeight={700} color="success.main">+{count(units)}</Typography>
                        {l.unit_cost !== null && <Typography variant="caption" color="text.secondary">{naira(l.unit_cost * units)}</Typography>}
                      </Box>
                      <IconButton size="small" onClick={() => setDelivery((prev) => prev.filter((x) => x.product_id !== l.product_id))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, mb: 1.5, px: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{delivery.length} product{delivery.length === 1 ? '' : 's'} · {count(deliveryUnits)} items</Typography>
                  {deliveryHasCost && <Typography variant="body2" fontWeight={700}>{naira(deliveryCost)}</Typography>}
                </Box>
                <Button variant="contained" size="large" fullWidth onClick={saveDelivery} disabled={saving}
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <DoneIcon />}
                  sx={{ py: 1.25, background: BRAND_GRADIENT }}>
                  {saving ? 'Saving…' : `Save restock (${count(deliveryUnits)} items)`}
                </Button>
              </>
            )}
          </Section>
        </Grid>

        {/* Suggestions */}
        {suggested.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Section title="Suggested from your sales" icon={SuggestIcon} color={theme.palette.warning.main}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                These are running out. Amounts cover about {suggestions.settings.reorder_cover_days} days of sales. Tap one to fill it in.
              </Typography>
              <Grid container spacing={1}>
                {suggested.map((x) => (
                  <Grid key={x.id} size={{ xs: 12, sm: 6, md: 3 }}>
                    <Paper variant="outlined" onClick={() => byId[x.id] && choose(byId[x.id], x.reorder_qty)}
                      sx={{
                        p: 1.25, borderRadius: 2, cursor: 'pointer', height: '100%', borderLeft: 4,
                        borderLeftColor: x.urgent ? 'error.main' : 'warning.main',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                      }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>{x.name}</Typography>
                        <Typography variant="body2" fontWeight={700} color={x.urgent ? 'error.main' : 'warning.main'} sx={{ flexShrink: 0 }}>
                          +{count(x.reorder_qty)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{x.note}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Section>
          </Grid>
        )}

        {/* History */}
        <Grid size={{ xs: 12 }}>
          <Section title={`Restock history (${count(history.count)})`} icon={HistoryIcon} color={theme.palette.info.main}>
            <TextField fullWidth size="small" placeholder="Search by product or barcode" value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ mb: 1.5 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            {history.results.length === 0 && !historyLoading && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {search ? 'No restocks match your search.' : 'No restocks yet.'}
              </Typography>
            )}
            {historyByDay.map((g) => (
              <Box key={g.day} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.day}</Typography>
                {g.rows.map((r) => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                    <Chip label={`+${count(r.quantity_added)}`} size="small" sx={{ fontWeight: 700, minWidth: 56, bgcolor: alpha(theme.palette.success.main, 0.14), color: 'success.main' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{r.product_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(r.restocked_at).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })} · {r.restocked_by_username}
                        {r.stock_after != null && ` · stock now ${count(r.stock_after)}`}
                      </Typography>
                    </Box>
                    {r.total_cost != null && (
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="body2" fontWeight={700}>{naira(r.total_cost)}</Typography>
                        <Typography variant="caption" color="text.secondary">{naira(r.unit_cost)} each</Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ))}
            {historyLoading && <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>}
            {!historyLoading && history.results.length < history.count && (
              <Button fullWidth onClick={() => loadHistory(history.page + 1, search)}>
                Show more ({count(history.count - history.results.length)} left)
              </Button>
            )}
          </Section>
        </Grid>
      </Grid>

      <BarcodeScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onScan} title="Scan product to restock" />

      <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback((f) => ({ ...f, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={feedback.severity} variant="filled" onClose={() => setFeedback((f) => ({ ...f, open: false }))}>
          {feedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Restock;
