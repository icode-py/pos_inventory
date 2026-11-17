import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, IconButton, InputAdornment, List, ListItem, ListItemIcon,
  ListItemText, Menu, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import axiosInstance from "../utils/axiosInstance";
import AddProductModal from "../components/AddProductModal";
import CategoryManagerModal from "../components/CategoryManagerModal";
import EditProductModal from "../components/EditProductModal";
import StockAdjustDialog from "../components/StockAdjustDialog";
import StockCountDialog from "../components/StockCountDialog";
import BarcodeScannerDialog from "../components/BarcodeScannerDialog";
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Inventory2 as InventoryIcon, Category as CategoryIcon,
  Search as SearchIcon, QrCodeScanner as ScanIcon, Visibility as ViewIcon, Download as DownloadIcon,
  Upload as UploadIcon, MoreVert as MoreIcon, Archive as ArchiveIcon, Unarchive as RestoreIcon,
  LocalShipping as RestockIcon, Tune as AdjustIcon, FactCheck as CountIcon, WarningAmber as WarningIcon,
  RemoveShoppingCart as OutIcon, Savings as ValueIcon, CheckCircle as CheckIcon, Close as CloseIcon,
} from "@mui/icons-material";

const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const LOW_STOCK = 10;
const PAGE = 30;

const naira = (n, d = 0) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: d, maximumFractionDigits: 2 })}`;
const count = (n) => Number(n || 0).toLocaleString("en-NG");
const unitWord = (p) => (p?.unit_of_measure && p.unit_of_measure !== "units" ? p.unit_of_measure : "items");
const packOf = (p) => (p?.is_bulk_product && Number(p.bulk_quantity) > 1 ? Number(p.bulk_quantity) : 0);
// Profit as a share of the selling price, the same way Reports works it out
const marginOf = (p) => {
  const price = Number(p.price || 0);
  if (!price || p.cost_price == null) return null;
  return Math.round(((price - Number(p.cost_price)) / price) * 1000) / 10;
};
const stockState = (stock) => {
  if (stock === 0) return { label: "Out of stock", color: "error" };
  if (stock <= 5) return { label: "Very low", color: "error" };
  if (stock <= LOW_STOCK) return { label: "Low", color: "warning" };
  return { label: "In stock", color: "success" };
};
const timeAgo = (iso) => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

function IconBadge({ icon: Icon, color, size = 32 }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: 2, display: "grid", placeItems: "center", flexShrink: 0, bgcolor: alpha(color, 0.14), color }}>
      <Icon sx={{ fontSize: Math.round(size * 0.55) }} />
    </Box>
  );
}

function StatTile({ label, value, note, icon, color, onClick, active }) {
  return (
    <Paper variant="outlined" onClick={onClick} sx={{
      p: 1.5, height: "100%", borderRadius: 3, cursor: onClick ? "pointer" : "default",
      borderColor: active ? color : alpha(color, 0.3), borderWidth: active ? 2 : 1,
      backgroundImage: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, transparent 70%)`,
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <IconBadge icon={icon} color={color} size={30} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
      </Box>
      <Typography fontWeight={800} sx={{ fontSize: { xs: "1.15rem", sm: "1.35rem" }, overflowWrap: "anywhere" }}>{value}</Typography>
      {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
    </Paper>
  );
}

function StockPill({ product }) {
  const s = stockState(product.stock);
  const pack = packOf(product);
  return (
    <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
      <Chip size="small" color={s.color} variant={product.stock <= LOW_STOCK ? "filled" : "outlined"}
        label={`${count(product.stock)} ${unitWord(product)}`} sx={{ fontWeight: 700 }} />
      {pack > 0 && product.stock >= pack && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
          ≈ {Math.floor(product.stock / pack)} carton{Math.floor(product.stock / pack) === 1 ? "" : "s"}
        </Typography>
      )}
    </Box>
  );
}

function ProductsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { user } = useContext(AuthContext);
  const { hasFeature } = useStore();
  const canWrite = user?.role === "admin" || user?.role === "manager";
  const canBulkUpload = canWrite && hasFeature("bulk_upload");

  const [products, setProducts] = useState([]);
  const [archived, setArchived] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("all"); // all | low | out | archived
  const [sort, setSort] = useState("name");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [insights, setInsights] = useState(null);
  const [countOpen, setCountOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [menu, setMenu] = useState({ anchor: null, product: null });
  const [toolsAnchor, setToolsAnchor] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  const notify = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [axiosInstance.get("products/")];
      if (canWrite) requests.push(axiosInstance.get("products/", { params: { archived: 1 } }).catch(() => ({ data: [] })));
      const [active, old] = await Promise.all(requests);
      setProducts(active.data);
      setArchived(old?.data || []);
    } catch (err) {
      notify(err.response ? "Failed to load products" : "No connection. Products need the internet.", "error");
    } finally {
      setLoading(false);
    }
  }, [canWrite]);

  const fetchCategories = useCallback(() => axiosInstance.get("categories/").then((r) => setCategories(r.data)).catch(() => {}), []);

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim().toLowerCase()); setShown(PAGE); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setShown(PAGE); setSelected([]); }, [category, view, sort]);

  // ── Numbers and the visible list ─────────────────────────────────────────
  const stats = useMemo(() => ({
    total: products.length,
    low: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length,
    out: products.filter((p) => p.stock === 0).length,
    value: products.reduce((s, p) => s + p.stock * Number(p.cost_price || 0), 0),
  }), [products]);

  const list = useMemo(() => {
    const source = view === "archived" ? archived : products;
    const rows = source.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search) && !String(p.barcode).toLowerCase().includes(search)) return false;
      if (category !== "all" && String(p.category?.id) !== category) return false;
      if (view === "low") return p.stock > 0 && p.stock <= LOW_STOCK;
      if (view === "out") return p.stock === 0;
      return true;
    });
    const by = {
      name: (a, b) => a.name.localeCompare(b.name),
      stock: (a, b) => a.stock - b.stock || a.name.localeCompare(b.name),
      price: (a, b) => Number(b.price) - Number(a.price),
      margin: (a, b) => (marginOf(a) ?? 0) - (marginOf(b) ?? 0),
    }[sort];
    return [...rows].sort(by);
  }, [products, archived, view, search, category, sort]);
  const visible = list.slice(0, shown);

  // ── Actions ──────────────────────────────────────────────────────────────
  const archive = async (product, restore = false) => {
    try {
      await axiosInstance.post(`products/${product.id}/${restore ? "restore" : "archive"}/`);
      notify(restore ? `${product.name} is back in the till` : `${product.name} archived. Its sales history is kept.`);
      fetchProducts();
    } catch {
      notify("Could not update the product", "error");
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Delete "${product.name}" for good?`)) return;
    try {
      await axiosInstance.delete(`products/${product.id}/`);
      notify("Product deleted");
      fetchProducts();
    } catch (err) {
      if (err.response?.data?.can_archive) {
        if (window.confirm(`"${product.name}" has sales history, so it can't be deleted.\n\nArchive it instead? It will leave the till and lists but its history is kept.`)) {
          archive(product);
        }
      } else {
        notify(err.response?.data?.error || "Could not delete the product", "error");
      }
    }
  };

  const bulkArchive = async () => {
    if (!window.confirm(`Archive ${selected.length} product(s)? They leave the till but keep their history.`)) return;
    const results = await Promise.allSettled(selected.map((id) => axiosInstance.post(`products/${id}/archive/`)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    notify(`${ok} product(s) archived`, ok === selected.length ? "success" : "warning");
    setSelected([]);
    fetchProducts();
  };

  const openDetails = async (product) => {
    setDetailsProduct(product);
    setInsights(null);
    if (!canWrite) return;
    try {
      const res = await axiosInstance.get(`products/${product.id}/insights/`);
      setInsights(res.data);
    } catch {
      setInsights({ failed: true });
    }
  };

  const downloadFile = async (url, name) => {
    try {
      const res = await axiosInstance.get(url, { responseType: "blob" });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      notify("Download failed", "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadResults(null);
    setUploadOpen(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axiosInstance.post("products/bulk-upload/", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setUploadResults(res.data);
      fetchProducts();
      fetchCategories();
    } catch (err) {
      setUploadResults(err.response?.data?.errors ? err.response.data : { error: err.response?.data?.error || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const afterStockChange = (message) => {
    notify(message);
    fetchProducts();
    if (detailsProduct) setDetailsProduct(null);
  };

  const menuItems = (p) => (view === "archived" ? [
    { label: "Restore to till", icon: RestoreIcon, run: () => archive(p, true) },
    { label: "Delete", icon: DeleteIcon, run: () => remove(p), danger: true },
  ] : [
    { label: "View details", icon: ViewIcon, run: () => openDetails(p) },
    ...(canWrite ? [
      { label: "Edit details & prices", icon: EditIcon, run: () => setEditProduct(p) },
      { label: "Restock", icon: RestockIcon, run: () => navigate(`/restock?product=${p.id}`) },
      { label: "Adjust stock", icon: AdjustIcon, run: () => setAdjustProduct(p) },
      { label: "Archive", icon: ArchiveIcon, run: () => archive(p) },
      { label: "Delete", icon: DeleteIcon, run: () => remove(p), danger: true },
    ] : []),
  ]);

  const openMenu = (e, product) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, product }); };

  // ── Rendering pieces ─────────────────────────────────────────────────────
  const productAvatar = (p) => (
    <Avatar variant="rounded" sx={{ width: 38, height: 38, fontWeight: 700, fontSize: 15, background: BRAND_GRADIENT }}>
      {p.name.charAt(0).toUpperCase()}
    </Avatar>
  );

  const card = (p) => {
    const margin = marginOf(p);
    const pack = packOf(p);
    return (
      <Paper key={p.id} variant="outlined" onClick={() => openDetails(p)} sx={{
        p: 1.25, mb: 1, borderRadius: 3, cursor: "pointer", display: "flex", gap: 1.25, alignItems: "center",
        borderLeft: 4, borderLeftColor: `${stockState(p.stock).color}.main`,
      }}>
        {productAvatar(p)}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>{p.name}</Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {p.category?.name || "Uncategorized"}{pack ? ` · carton of ${pack}` : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
            <Typography variant="body2" fontWeight={800} color="primary">{naira(p.price)}</Typography>
            {margin !== null && <Typography variant="caption" color={margin < 10 ? "error.main" : "text.secondary"}>{margin}% margin</Typography>}
          </Box>
        </Box>
        <StockPill product={p} />
        <IconButton size="small" onClick={(e) => openMenu(e, p)}><MoreIcon /></IconButton>
      </Paper>
    );
  };

  const table = (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {canWrite && view !== "archived" && (
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={visible.length > 0 && selected.length === visible.length}
                  indeterminate={selected.length > 0 && selected.length < visible.length}
                  onChange={(e) => setSelected(e.target.checked ? visible.map((p) => p.id) : [])} />
              </TableCell>
            )}
            <TableCell>Product</TableCell>
            <TableCell>Category</TableCell>
            <TableCell align="right">Price</TableCell>
            {canWrite && <TableCell align="right">Cost</TableCell>}
            {canWrite && <TableCell align="right">Margin</TableCell>}
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((p) => {
            const margin = marginOf(p);
            return (
              <TableRow key={p.id} hover selected={selected.includes(p.id)} sx={{ cursor: "pointer" }} onClick={() => openDetails(p)}>
                {canWrite && view !== "archived" && (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox size="small" checked={selected.includes(p.id)}
                      onChange={() => setSelected((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))} />
                  </TableCell>
                )}
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    {productAvatar(p)}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700}>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.barcode}{packOf(p) ? ` · carton of ${packOf(p)}` : ""}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><Chip size="small" variant="outlined" label={p.category?.name || "Uncategorized"} /></TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main", whiteSpace: "nowrap" }}>{naira(p.price, 2)}</TableCell>
                {canWrite && <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{naira(p.cost_price, 2)}</TableCell>}
                {canWrite && (
                  <TableCell align="right">
                    {margin !== null && <Chip size="small" variant="outlined" label={`${margin}%`}
                      color={margin >= 20 ? "success" : margin >= 10 ? "warning" : "error"} />}
                  </TableCell>
                )}
                <TableCell align="right"><StockPill product={p} /></TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: "nowrap" }}>
                  {canWrite && view !== "archived" && (
                    <>
                      <Tooltip title="Restock"><IconButton size="small" color="primary" onClick={() => navigate(`/restock?product=${p.id}`)}><RestockIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Adjust stock"><IconButton size="small" onClick={() => setAdjustProduct(p)}><AdjustIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditProduct(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    </>
                  )}
                  <IconButton size="small" onClick={(e) => openMenu(e, p)}><MoreIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const d = detailsProduct;
  const dMargin = d ? marginOf(d) : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: "grid", placeItems: "center", background: BRAND_GRADIENT, color: "#fff" }}>
              <InventoryIcon fontSize="small" />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.3rem", md: "1.6rem" } }}>Products</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Your items, prices and stock levels.</Typography>
        </Box>
        {canWrite && (
          <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" }, "& .MuiButton-root": { flex: { xs: 1, sm: "none" }, px: { xs: 1, sm: 2 }, whiteSpace: "nowrap" } }}>
            <Button variant="outlined" startIcon={<CountIcon />} onClick={() => setCountOpen(true)}>Count</Button>
            <Button variant="outlined" startIcon={<MoreIcon />} onClick={(e) => setToolsAnchor(e.currentTarget)}>More</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ background: BRAND_GRADIENT }}>Add</Button>
          </Box>
        )}
      </Box>

      {/* Headline numbers; tap one to filter */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Products" value={count(stats.total)} note={`${categories.length} categories`} icon={InventoryIcon}
            color={theme.palette.primary.main} onClick={() => setView("all")} active={view === "all"} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Low stock" value={count(stats.low)} note={`${LOW_STOCK} or fewer left`} icon={WarningIcon}
            color={theme.palette.warning.main} onClick={() => setView("low")} active={view === "low"} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Out of stock" value={count(stats.out)} note="Tap to see them" icon={OutIcon}
            color={theme.palette.error.main} onClick={() => setView("out")} active={view === "out"} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          {canWrite ? (
            <StatTile label="Stock value" value={naira(stats.value)} note="At cost price" icon={ValueIcon} color={theme.palette.success.main} />
          ) : (
            <StatTile label="In stock" value={count(stats.total - stats.out)} note="products available" icon={CheckIcon} color={theme.palette.success.main} />
          )}
        </Grid>
      </Grid>

      {/* Search and filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField size="small" placeholder="Search name or barcode" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              sx={{ flex: "3 1 220px" }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    {searchInput && <IconButton size="small" onClick={() => setSearchInput("")}><CloseIcon fontSize="small" /></IconButton>}
                    <Tooltip title="Scan barcode"><IconButton size="small" color="primary" onClick={() => setScanOpen(true)}><ScanIcon fontSize="small" /></IconButton></Tooltip>
                  </InputAdornment>
                ),
              }} />
            <TextField select size="small" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ flex: "1 1 150px" }}>
              <MenuItem value="all">All categories</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ flex: "1 1 150px" }}>
              <MenuItem value="name">Sort: Name</MenuItem>
              <MenuItem value="stock">Sort: Lowest stock</MenuItem>
              <MenuItem value="price">Sort: Highest price</MenuItem>
              {canWrite && <MenuItem value="margin">Sort: Lowest margin</MenuItem>}
            </TextField>
          </Box>
          <Box sx={{ display: "flex", gap: 1, mt: 1.25, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}>
            {[["all", `All (${count(stats.total)})`], ["low", `Low (${stats.low})`], ["out", `Out (${stats.out})`],
              ...(canWrite ? [["archived", `Archived (${archived.length})`]] : [])].map(([k, label]) => (
              <Chip key={k} label={label} onClick={() => setView(k)} color={view === k ? "primary" : "default"}
                variant={view === k ? "filled" : "outlined"} sx={{ fontWeight: 600, flexShrink: 0 }} />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* The list */}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1, flexWrap: "wrap" }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {view === "archived" ? "Archived products" : "Products"} ({count(list.length)})
            </Typography>
            {selected.length > 0 && (
              <Button size="small" color="warning" variant="contained" startIcon={<ArchiveIcon />} onClick={bulkArchive}>
                Archive {selected.length} selected
              </Button>
            )}
          </Box>
          {view === "archived" && (
            <Alert severity="info" sx={{ mb: 1.5 }}>Archived products aren't sold or counted. Their sales history stays in Reports.</Alert>
          )}
          {loading ? (
            <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>
          ) : list.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <InventoryIcon sx={{ fontSize: 56, color: "text.disabled" }} />
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {search || category !== "all" || view !== "all" ? "No products match." : "No products yet."}
              </Typography>
              {canWrite && view === "all" && !search && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ mt: 2 }}>Add your first product</Button>
              )}
            </Box>
          ) : (
            <>
              {isDesktop ? table : visible.map(card)}
              {shown < list.length && (
                <Button fullWidth onClick={() => setShown((n) => n + PAGE)} sx={{ mt: 1 }}>
                  Show more ({count(list.length - shown)} left)
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Per-product menu */}
      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, product: null })}>
        {menu.product && menuItems(menu.product).map((item) => (
          <MenuItem key={item.label} onClick={() => { const p = menu.product; setMenu({ anchor: null, product: null }); item.run(p); }}
            sx={item.danger ? { color: "error.main" } : undefined}>
            <ListItemIcon sx={item.danger ? { color: "error.main" } : undefined}><item.icon fontSize="small" /></ListItemIcon>
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Tools menu */}
      <Menu anchorEl={toolsAnchor} open={Boolean(toolsAnchor)} onClose={() => setToolsAnchor(null)}>
        <MenuItem onClick={() => { setToolsAnchor(null); setCategoryOpen(true); }}>
          <ListItemIcon><CategoryIcon fontSize="small" /></ListItemIcon>Categories
        </MenuItem>
        <MenuItem onClick={() => { setToolsAnchor(null); downloadFile("products/count-sheet/", `stock_count_${new Date().toLocaleDateString("en-CA")}.xlsx`); }}>
          <ListItemIcon><CountIcon fontSize="small" /></ListItemIcon>Download count sheet
        </MenuItem>
        {canBulkUpload && <Divider />}
        {canBulkUpload && (
          <MenuItem onClick={() => { setToolsAnchor(null); downloadFile("products/download-template/", "product_upload_template.xlsx"); }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Excel template
          </MenuItem>
        )}
        {canBulkUpload && (
          <MenuItem onClick={() => { setToolsAnchor(null); fileInputRef.current?.click(); }}>
            <ListItemIcon><UploadIcon fontSize="small" /></ListItemIcon>Upload Excel
          </MenuItem>
        )}
      </Menu>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />

      {/* Product details */}
      <Dialog open={Boolean(d)} onClose={() => setDetailsProduct(null)} maxWidth="sm" fullWidth>
        {d && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
              {productAvatar(d)}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={800} noWrap>{d.name}</Typography>
                <Typography variant="caption" color="text.secondary">{d.category?.name || "Uncategorized"} · {d.barcode}</Typography>
              </Box>
              <IconButton onClick={() => setDetailsProduct(null)}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {[
                  ["Selling price", naira(d.price, 2)],
                  ...(packOf(d) ? [["Carton", `${packOf(d)} for ${naira(d.bulk_price)}`]] : []),
                  ...(canWrite ? [["Cost price", naira(d.cost_price, 2)], ["Margin", dMargin !== null ? `${dMargin}%` : "—"]] : []),
                  ["In stock", `${count(d.stock)} ${unitWord(d)}`],
                  ...(canWrite ? [["Stock value", naira(d.stock * Number(d.cost_price || 0))]] : []),
                ].map(([k, v]) => (
                  <Grid key={k} size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography fontWeight={700}>{v}</Typography>
                  </Grid>
                ))}
              </Grid>

              {canWrite && (
                insights === null ? (
                  <Box sx={{ textAlign: "center", py: 2 }}><CircularProgress size={24} /></Box>
                ) : insights.failed ? (
                  <Alert severity="warning">Could not load sales details.</Alert>
                ) : (
                  <>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <Grid container spacing={1}>
                        {[
                          ["Sold (30 days)", count(insights.sold_30d)],
                          ["Sales (30 days)", naira(insights.revenue_30d)],
                          ["Sells about", insights.daily >= 1 ? `${insights.daily}/day` : insights.daily > 0 ? `${Math.round(insights.daily * 7 * 10) / 10}/week` : "—"],
                          ["Stock lasts", insights.days_left !== null ? `~${Math.max(Math.round(insights.days_left), insights.days_left < 1 ? 0 : 1)} days` : "—"],
                        ].map(([k, v]) => (
                          <Grid key={k} size={{ xs: 6, sm: 3 }}>
                            <Typography variant="caption" color="text.secondary">{k}</Typography>
                            <Typography variant="body2" fontWeight={700}>{v}</Typography>
                          </Grid>
                        ))}
                      </Grid>
                      <Typography variant="caption" color="text.secondary">Last sold {timeAgo(insights.last_sold)}</Typography>
                    </Paper>

                    {(insights.restocks.length > 0 || insights.adjustments.length > 0) && (
                      <>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recent stock changes</Typography>
                        <List dense disablePadding>
                          {[
                            ...insights.restocks.map((r) => ({ at: r.at, text: `Restocked +${count(r.quantity)}`, sub: `${r.by}${r.unit_cost != null ? ` · ${naira(r.unit_cost)} each` : ""}`, color: "success.main" })),
                            ...insights.adjustments.map((a) => ({ at: a.at, text: `${a.reason_label} ${a.change > 0 ? "+" : ""}${count(a.change)}`, sub: `${a.by}${a.note ? ` · ${a.note}` : ""}`, color: a.change < 0 ? "error.main" : "info.main" })),
                          ].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 8).map((e, i) => (
                            <ListItem key={i} disableGutters divider>
                              <ListItemText
                                primary={<Typography variant="body2" fontWeight={700} color={e.color}>{e.text}</Typography>}
                                secondary={`${new Date(e.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${e.sub}`} />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    )}
                  </>
                )
              )}
            </DialogContent>
            {canWrite && (
              <DialogActions sx={{ flexWrap: "wrap", gap: 1, p: 1.5 }}>
                <Button startIcon={<AdjustIcon />} onClick={() => { setAdjustProduct(d); setDetailsProduct(null); }}>Adjust</Button>
                <Button startIcon={<EditIcon />} onClick={() => { setEditProduct(d); setDetailsProduct(null); }}>Edit</Button>
                <Button variant="contained" startIcon={<RestockIcon />} onClick={() => navigate(`/restock?product=${d.id}`)}>Restock</Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>

      {/* Dialogs */}
      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)}
        onSuccess={() => { fetchProducts(); notify("Product added"); }}
        onError={(reason) => notify(reason ? `Could not add product: ${reason}` : "Failed to add product", "error")} />
      <EditProductModal open={Boolean(editProduct)} onClose={() => setEditProduct(null)} product={editProduct}
        onSuccess={() => { fetchProducts(); notify("Product updated"); }}
        onError={(reason) => notify(reason ? `Could not update product: ${reason}` : "Failed to update product", "error")} />
      <StockAdjustDialog open={Boolean(adjustProduct)} product={adjustProduct} onClose={() => setAdjustProduct(null)} onDone={afterStockChange} />
      <StockCountDialog open={countOpen} onClose={() => setCountOpen(false)} products={products} categories={categories} onDone={afterStockChange} />
      <CategoryManagerModal open={categoryOpen} onClose={() => setCategoryOpen(false)} onSuccess={() => { fetchCategories(); fetchProducts(); }} />
      <BarcodeScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} title="Scan to find a product"
        onDetected={(code) => { setScanOpen(false); setSearchInput(String(code)); setView("all"); }} />

      {/* Excel upload results */}
      <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk product upload</DialogTitle>
        <DialogContent>
          {uploading ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2 }}>
              <CircularProgress />
              <Typography>Processing your file...</Typography>
            </Box>
          ) : uploadResults?.error && !uploadResults?.errors ? (
            <Alert severity="error">{uploadResults.error}</Alert>
          ) : uploadResults ? (
            <Box>
              {uploadResults.errors?.length > 0 ? (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>Nothing was saved. Fix these rows and upload again:</Alert>
                  <List dense sx={{ maxHeight: 260, overflow: "auto", border: 1, borderColor: "error.light", borderRadius: 1 }}>
                    {uploadResults.errors.map((e, i) => (
                      <ListItem key={i} divider>
                        <ListItemText primary={`Row ${e.row}: ${e.name}`} secondary={e.error}
                          primaryTypographyProps={{ fontWeight: 600, variant: "body2" }} secondaryTypographyProps={{ color: "error.main", variant: "caption" }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              ) : (
                <>
                  <Alert severity="success">Upload complete: {uploadResults.created} created, {uploadResults.updated} updated.</Alert>
                  {uploadResults.stock_note && <Alert severity="info" sx={{ mt: 1.5 }}>{uploadResults.stock_note} Use Restock or Adjust stock to change it.</Alert>}
                </>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setUploadOpen(false)} disabled={uploading}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default ProductsPage;
