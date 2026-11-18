import {
  Alert, Autocomplete, Badge, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, IconButton, InputAdornment, ListItemIcon, Menu, MenuItem, Paper,
  Snackbar, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon, Search as SearchIcon, CameraAlt as CameraIcon,
  Keyboard as KeyboardIcon, Refresh as RefreshIcon, PersonAdd as PersonAddIcon, Person as PersonIcon,
  CloudOff as OfflineIcon, CloudDone as OnlineIcon, CloudUpload as SyncIcon, LocalOffer as DiscountIcon,
  MoreVert as MoreIcon, ShoppingCart as CartIcon, PointOfSale as PosIcon, Star as StarIcon, Close as CloseIcon,
  DeleteSweep as ClearCacheIcon, RemoveShoppingCart as ClearCartIcon, Receipt as ReceiptIcon, Save as SaveIcon,
  Loyalty as LoyaltyIcon, Payments as CashIcon, AccountBalance as BankIcon, CreditCard as CardIcon, CallSplit as SplitIcon,
} from "@mui/icons-material";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import CustomerLookupModal from "../components/CustomerLookupModal";
import CustomerQuickAddModal from "../components/CustomerQuickAddModal";
import BarcodeScannerDialog from "../components/BarcodeScannerDialog";
import ReceiptDialog from "../components/ReceiptDialog";
import { useOffline } from "../context/OfflineManager";
import { useStore } from "../context/StoreContext";
import { storeKey } from "../utils/storeKey";
import { loyaltyRules, loyaltyTier, pointsEarned } from "../utils/loyalty";
import {
  clearCachedProducts, deductCachedStock, deductStock, fetchProducts, readCachedProducts,
} from "../utils/productCache";

const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const TOP_SELLERS_KEY = "pos-top-sellers";

const formatCurrency = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (n === null || n === undefined || isNaN(n)) return "₦0.00";
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const r2 = (v) => Math.round(v * 100) / 100;
const packSize = (product) => (product?.is_bulk_product && Number(product.bulk_quantity) > 1 ? Number(product.bulk_quantity) : null);
const unitWord = (p) => (p?.unit_of_measure && p.unit_of_measure !== "units" ? p.unit_of_measure : "items");
const asNumbers = (product) => ({
  ...product,
  price: typeof product.price === "string" ? parseFloat(product.price) : product.price,
  bulk_price: product.bulk_price ? parseFloat(product.bulk_price) : null,
});
// Anything that changes what an item costs
const priceSignature = (p) => [p.price, p.bulk_price, p.bulk_quantity, p.is_bulk_product, JSON.stringify(p.bulk_discounts || [])].join("|");

const discountAmount = (discount, quantity, unitPrice) => {
  switch (discount.discount_type) {
    case "percentage": return unitPrice * quantity * (parseFloat(discount.discount_value) / 100);
    case "fixed": return parseFloat(discount.discount_value);
    case "bundle": return Math.floor(quantity / discount.minimum_quantity) * parseFloat(discount.discount_value) * unitPrice;
    default: return 0;
  }
};

/** What a line costs: carton pricing first, then the best active bulk discount (the server checks the same). */
const calculateItemPrice = (product, quantity) => {
  const unitPrice = parseFloat(product.price) || 0;
  const size = packSize(product);
  let total = size && product.bulk_price
    ? Math.floor(quantity / size) * parseFloat(product.bulk_price) + (quantity % size) * unitPrice
    : unitPrice * quantity;
  const now = new Date();
  const best = (product.bulk_discounts || [])
    .filter((d) => d.is_active && now >= new Date(d.start_date) && (!d.end_date || now <= new Date(d.end_date)) && quantity >= d.minimum_quantity)
    .reduce((max, d) => Math.max(max, discountAmount(d, quantity, unitPrice)), 0);
  total -= best;
  return Math.max(0, total);
};

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(key)));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

const SalesPage = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { isOnline, pendingSales, saveOfflineSale, syncPendingSales } = useOffline();
  const { store } = useStore();

  const [products, setProducts] = useState([]);
  const [topSellerIds, setTopSellerIds] = useState(() => readJSON(TOP_SELLERS_KEY, []));
  const [browse, setBrowse] = useState("top");
  const [searchText, setSearchText] = useState("");
  const [cart, setCart] = useState(() => readJSON("pos-cart", []));
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState("");
  const [pointsToUse, setPointsToUse] = useState("");
  const [usingPoints, setUsingPoints] = useState(false);
  const [transferPart, setTransferPart] = useState("");
  const [cardPart, setCardPart] = useState("");
  const [saving, setSaving] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [lastSale, setLastSale] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quantityEdit, setQuantityEdit] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [customerAddOpen, setCustomerAddOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [lastRefresh, setLastRefresh] = useState(null);

  const searchRef = useRef(null);
  const receiptRef = useRef(null);
  const completeRef = useRef(null);
  const restoredRef = useRef(cart.length > 0);

  const notify = (message, severity = "info") => setSnackbar({ open: true, message, severity });
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  // ── Products ─────────────────────────────────────────────────────────────
  const showProducts = (list) => setProducts(list.map(asNumbers));

  const loadProducts = useCallback(async ({ quiet = false } = {}) => {
    const cached = readCachedProducts();
    if (cached) showProducts(cached);
    if (!navigator.onLine) {
      if (!quiet) notify(cached ? "Using saved products (offline)" : "No saved products on this device yet", cached ? "info" : "warning");
      return;
    }
    try {
      showProducts(await fetchProducts());
      setLastRefresh(new Date());
      if (!quiet) notify("Products refreshed", "success");
    } catch {
      if (!cached) notify("Failed to load products", "error");
    }
    // Best sellers for the quick-pick tiles; kept on the device for offline use
    axiosInstance.get("products/top-sellers/").then((res) => {
      setTopSellerIds(res.data);
      try { localStorage.setItem(storeKey(TOP_SELLERS_KEY), JSON.stringify(res.data)); } catch { /* storage blocked */ }
    }).catch(() => {});
  }, []);

  useEffect(() => { loadProducts({ quiet: true }); }, [loadProducts]);

  // OfflineManager refreshes the saved products in the background
  useEffect(() => {
    const onRefreshed = () => { showProducts(readCachedProducts() || []); setLastRefresh(new Date()); };
    window.addEventListener("products-refreshed", onRefreshed);
    return () => window.removeEventListener("products-refreshed", onRefreshed);
  }, []);

  // Keep the cart on the latest prices: a cart restored from earlier, or one open while a
  // manager changes a price, must not charge the old amount
  useEffect(() => {
    if (!products.length) return;
    let changed = 0;
    let gone = 0;
    let differs = false;
    const next = cart.flatMap((item) => {
      const fresh = byId[item.product.id];
      if (!fresh) { gone += 1; differs = true; return []; }
      if (priceSignature(fresh) !== priceSignature(item.product)) changed += 1;
      if (fresh !== item.product) differs = true;
      return [{ ...item, quantity: Math.min(item.quantity, Math.max(fresh.stock, 1)), product: fresh }];
    });
    if (differs) setCart(next);
    if (restoredRef.current) {
      restoredRef.current = false;
      notify(changed ? `Cart restored. Prices updated for ${changed} item${changed === 1 ? "" : "s"}.` : "Previous cart restored", changed ? "warning" : "info");
    } else if (changed) {
      notify(`Prices changed for ${changed} item${changed === 1 ? "" : "s"} in the cart`, "warning");
    }
    if (gone) notify(`${gone} item${gone === 1 ? " is" : "s are"} no longer for sale and left the cart`, "warning");
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(storeKey("pos-cart"), JSON.stringify(cart)); } catch { /* storage blocked */ }
  }, [cart]);

  // ── Cart ─────────────────────────────────────────────────────────────────
  const findByBarcode = (code) => products.find((p) => String(p.barcode || "").trim().toLowerCase() === String(code).trim().toLowerCase());

  const addProduct = (product, amount = 1) => {
    const fresh = byId[product.id] || product;
    if (fresh.stock <= 0) { notify(`${fresh.name} is out of stock`, "warning"); return false; }
    const inCart = cart.find((i) => i.product.id === fresh.id)?.quantity || 0;
    const qty = Math.min(inCart + amount, fresh.stock);
    if (qty === inCart) { notify(`Only ${fresh.stock} ${unitWord(fresh)} in stock`, "warning"); return false; }
    setCart((prev) => (prev.some((i) => i.product.id === fresh.id)
      ? prev.map((i) => (i.product.id === fresh.id ? { ...i, quantity: qty } : i))
      : [...prev, { product: fresh, quantity: qty }]));
    setSaleError("");
    return true;
  };

  const setQuantity = (productId, qty) => {
    const product = byId[productId] || cart.find((i) => i.product.id === productId)?.product;
    const q = Math.max(1, parseInt(qty) || 1);
    if (product && q > product.stock) { notify(`Only ${product.stock} in stock`, "warning"); return; }
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity: q } : i)));
  };

  const removeItem = (productId) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const clearCart = (ask = true) => {
    if (!cart.length) return;
    if (ask && !window.confirm(`Clear all ${cart.length} item(s) from the cart?`)) return;
    setCart([]);
    setSaleError("");
  };

  const onSearchEnter = () => {
    const term = searchText.trim();
    if (!term) return;
    const product = findByBarcode(term);
    if (product) {
      if (addProduct(product)) notify(`Added ${product.name}`, "success");
      setSearchText("");
    }
  };

  const onCameraScan = (code) => {
    const product = findByBarcode(code);
    if (!product) { setCameraMessage(`No product with barcode ${code}`); return; }
    if (addProduct(product)) setCameraMessage(`Added: ${product.name}`);
  };

  const quantityFromEdit = (edit) => (parseInt(edit.packs) || 0) * (packSize(edit.product) || 0) + (parseInt(edit.singles) || 0);
  const openQuantityEdit = (item) => {
    const size = packSize(item.product);
    setQuantityEdit({
      product: item.product,
      packs: size ? String(Math.floor(item.quantity / size)) : "",
      singles: String(size ? item.quantity % size : item.quantity),
    });
  };
  const saveQuantityEdit = () => {
    const qty = quantityFromEdit(quantityEdit);
    if (qty < 1) { notify("Quantity must be at least 1", "warning"); return; }
    if (qty > quantityEdit.product.stock) { notify(`Only ${quantityEdit.product.stock} in stock`, "warning"); return; }
    setQuantity(quantityEdit.product.id, qty);
    setQuantityEdit(null);
  };

  // ── Totals and payment ───────────────────────────────────────────────────
  const lines = cart.map((item) => {
    const total = calculateItemPrice(item.product, item.quantity);
    const regular = (parseFloat(item.product.price) || 0) * item.quantity;
    return { ...item, total, regular, saving: regular - total };
  });
  const grossTotal = lines.reduce((s, l) => s + l.total, 0);
  // Loyalty points used on this sale: never more than the customer has, and at least ₦1 is left to pay
  const rules = loyaltyRules(store);
  const pointsAvailable = selectedCustomer && rules.enabled ? Number(selectedCustomer.loyalty_points) || 0 : 0;
  const maxPoints = Math.max(0, Math.min(pointsAvailable, Math.floor((grossTotal - 1) / rules.pointValue)));
  const pointsUsed = usingPoints ? Math.min(Math.max(parseInt(pointsToUse) || 0, 0), maxPoints) : 0;
  const pointsDiscount = r2(pointsUsed * rules.pointValue);
  const totalAmount = r2(grossTotal - pointsDiscount);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const payment = (() => {
    const total = totalAmount;
    const num = (v) => parseFloat(v) || 0;
    if (paymentMethod === "TRANSFER" || paymentMethod === "POS") {
      return { transfer: paymentMethod === "TRANSFER" ? total : 0, card: paymentMethod === "POS" ? total : 0,
        cashDue: 0, cashReceived: 0, paid: total, change: 0, ok: total > 0, reason: total > 0 ? "" : "Add products to the cart" };
    }
    const transfer = paymentMethod === "SPLIT" ? num(transferPart) : 0;
    const card = paymentMethod === "SPLIT" ? num(cardPart) : 0;
    const cashDue = Math.max(r2(total - transfer - card), 0);
    const cashReceived = num(paidAmount);
    const change = r2(cashReceived - cashDue);
    let reason = "";
    if (total <= 0) reason = "Add products to the cart";
    else if (paymentMethod === "SPLIT" && transfer + card <= 0) reason = "Enter the transfer or POS part";
    else if (transfer + card > total) reason = "Transfer and POS are more than the total";
    else if (cashDue > 0 && paidAmount === "") reason = paymentMethod === "SPLIT" ? "Enter the cash received" : "Enter amount paid";
    else if (change < 0) reason = `Short by ${formatCurrency(-change)}`;
    return { transfer, card, cashDue, cashReceived, paid: r2(cashReceived + transfer + card),
      change: Math.max(change, 0), short: change < 0 ? -change : 0, ok: !reason, reason };
  })();

  const quickAmounts = useMemo(() => {
    const due = payment.cashDue || totalAmount;
    if (due <= 0) return [];
    const options = [due, Math.ceil(due / 500) * 500, Math.ceil(due / 1000) * 1000, Math.ceil(due / 1000) * 1000 + 1000];
    return [...new Set(options.map((x) => r2(x)))].slice(0, 4);
  }, [payment.cashDue, totalAmount]);

  const resetAfterSale = () => {
    setCart([]);
    setPaidAmount("");
    setPaymentMethod("CASH");
    setTransferPart("");
    setCardPart("");
    setSelectedCustomer(null);
    setPointsToUse("");
    setUsingPoints(false);
    setCheckoutOpen(false);
    setSaleError("");
    setTimeout(() => searchRef.current?.focus(), 150);
  };

  // ── Receipt ──────────────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    pageStyle: "@page { size: 80mm auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; margin: 0 !important; padding: 0 !important; } }",
    onBeforeGetContent: () => { setIsPrinting(true); return Promise.resolve(); },
    onAfterPrint: () => setIsPrinting(false),
    onPrintError: () => { setIsPrinting(false); notify("Failed to print receipt", "error"); },
  });
  // Phones block automatic printing, so they get a receipt screen (share / WhatsApp / print)
  const presentReceipt = () => {
    if (window.matchMedia?.("(pointer: coarse)").matches) setReceiptOpen(true);
    else if (receiptRef.current) handlePrint();
  };

  // ── Completing a sale ────────────────────────────────────────────────────
  const completeSale = async () => {
    if (!payment.ok || saving || !cart.length) return;
    setSaving(true);
    setSaleError("");
    const saleData = {
      client_ref: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      total_amount: r2(totalAmount),
      paid_amount: payment.paid,
      change_given: payment.change,
      payment_method: paymentMethod,
      ...(paymentMethod === "SPLIT" ? { transfer_amount: payment.transfer, card_amount: payment.card } : {}),
      items: lines.map((l) => ({
        product_id: l.product.id, quantity: l.quantity,
        price_at_sale: r2(l.total / l.quantity), // average unit price; the server checks it against the list price
      })),
      ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
      ...(pointsUsed > 0 ? { points_redeemed: pointsUsed } : {}),
    };
    const receipt = (offline) => ({
      total_amount: r2(totalAmount), paid_amount: payment.paid, change_given: payment.change,
      payment_method: paymentMethod, transfer_amount: payment.transfer, card_amount: payment.card,
      items: lines.map((l) => ({ product: l.product, quantity: l.quantity, price_at_sale: r2(l.total / l.quantity), line_total: r2(l.total) })),
      points_redeemed: pointsUsed, points_discount: pointsDiscount, points_earned: selectedCustomer ? pointsEarned(totalAmount, store) : 0,
      timestamp: new Date().toLocaleString(),
      customer: selectedCustomer ? { ...selectedCustomer, loyalty_points: parseInt(selectedCustomer.loyalty_points) || 0 } : null,
      isOffline: offline,
    });
    const finishOffline = (message) => {
      const offlineId = saveOfflineSale(saleData);
      deductCachedStock(cart);
      setProducts((prev) => deductStock(prev, cart));
      setLastSale({ ...receipt(true), offline_id: offlineId });
      notify(message, "warning");
      setTimeout(() => { presentReceipt(); resetAfterSale(); }, 300);
    };

    if (!isOnline) {
      finishOffline("Sale saved offline. It will sync when you're back online.");
      setSaving(false);
      return;
    }
    try {
      await axiosInstance.post("/sales/", saleData);
      setLastSale(receipt(false));
      notify(selectedCustomer ? `Sale completed. ${selectedCustomer.name} earned loyalty points.` : "Sale completed", "success");
      setTimeout(() => { presentReceipt(); resetAfterSale(); }, 300);
      loadProducts({ quiet: true });
    } catch (err) {
      if (!err.response) {
        finishOffline("No connection. Sale saved offline and will sync later.");
      } else {
        const data = err.response.data;
        const reason = data && typeof data === "object" ? Object.values(data).flat().join(" ") : "";
        setSaleError(reason || "Sale could not be completed");
        notify("Sale not completed. See the reason in the cart.", "error");
        if (/listed price|match its items/i.test(reason)) loadProducts({ quiet: true }); // pick up new prices
      }
    } finally {
      setSaving(false);
    }
  };
  completeRef.current = completeSale;

  // ── Keyboard: shortcuts that can't lose a cart ───────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); completeRef.current?.(); return; }
      if (e.key === "F2" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "F1") { e.preventDefault(); setShortcutsOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Sync ─────────────────────────────────────────────────────────────────
  const manualSync = async () => {
    if (!isOnline) { notify("No internet connection", "warning"); return; }
    try {
      const synced = await syncPendingSales();
      if (synced > 0) { notify(`Synced ${synced} offline sale${synced === 1 ? "" : "s"}`, "success"); loadProducts({ quiet: true }); }
      else notify(pendingSales.length ? "Sales are still waiting to sync" : "Nothing waiting to sync", pendingSales.length ? "warning" : "info");
    } catch {
      notify("Sync failed", "error");
    }
  };

  // ── Product tiles ────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const seen = new Map();
    products.forEach((p) => { if (p.category) seen.set(p.category.id, p.category.name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const tiles = useMemo(() => {
    if (browse === "top") {
      const top = topSellerIds.map((id) => byId[id]).filter(Boolean);
      const fill = products.filter((p) => p.stock > 0 && !topSellerIds.includes(p.id));
      return [...top, ...fill].slice(0, isDesktop ? 12 : 8);
    }
    return products.filter((p) => String(p.category?.id) === browse).sort((a, b) => a.name.localeCompare(b.name));
  }, [browse, topSellerIds, byId, products, isDesktop]);

  const inCart = (id) => cart.find((i) => i.product.id === id)?.quantity || 0;

  const tile = (p) => {
    const qty = inCart(p.id);
    const out = p.stock <= 0;
    const size = packSize(p);
    return (
      <Grid key={p.id} size={{ xs: 6, sm: 4, md: 4, lg: 3 }}>
        <Paper variant="outlined" onClick={() => !out && addProduct(p)} sx={{
          p: 1.25, borderRadius: 2.5, height: "100%", cursor: out ? "not-allowed" : "pointer", opacity: out ? 0.5 : 1,
          position: "relative", userSelect: "none", transition: "transform .08s",
          borderColor: qty ? "primary.main" : "divider", borderWidth: qty ? 2 : 1,
          "&:active": { transform: out ? "none" : "scale(0.97)" },
          "&:hover": { bgcolor: out ? undefined : alpha(theme.palette.primary.main, 0.04) },
        }}>
          {qty > 0 && (
            <Box sx={{ position: "absolute", top: 6, right: 6, minWidth: 22, height: 22, px: 0.5, borderRadius: 11, background: BRAND_GRADIENT,
              color: "#fff", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center" }}>{qty}</Box>
          )}
          <Typography variant="body2" fontWeight={700} sx={{ pr: qty ? 3 : 0, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.5em" }}>
            {p.name}
          </Typography>
          <Typography variant="body2" fontWeight={800} color="primary" sx={{ mt: 0.5 }}>{naira(p.price)}</Typography>
          <Typography variant="caption" color={out ? "error.main" : p.stock <= 5 ? "warning.main" : "text.secondary"} display="block">
            {out ? "Out of stock" : `${p.stock.toLocaleString("en-NG")} left`}{size ? ` · ctn ${size}` : ""}
          </Typography>
        </Paper>
      </Grid>
    );
  };

  // ── Cart and payment panel (right column on laptops, full screen on phones) ──
  const cartLines = (
    <Box>
      {lines.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
          <CartIcon sx={{ fontSize: 44, opacity: 0.4 }} />
          <Typography variant="body2">Scan, search or tap a product to start.</Typography>
        </Box>
      ) : lines.map((l) => {
        const p = l.product;
        const size = packSize(p);
        return (
          <Box key={p.id} sx={{ py: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {naira(p.price)} each{size ? ` · ${size} for ${naira(p.bulk_price)}` : ""}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography variant="body2" fontWeight={800}>{formatCurrency(l.total)}</Typography>
                {l.saving > 0.005 && (
                  <Typography variant="caption" color="success.main" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                    <DiscountIcon sx={{ fontSize: 12 }} />saved {naira(l.saving)}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
              <IconButton size="small" onClick={() => setQuantity(p.id, l.quantity - 1)} disabled={l.quantity <= 1} sx={{ border: 1, borderColor: "divider" }}>
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Button size="small" variant="outlined" onClick={() => openQuantityEdit(l)} sx={{ minWidth: 52, fontWeight: 800 }}>{l.quantity}</Button>
              <IconButton size="small" onClick={() => setQuantity(p.id, l.quantity + 1)} sx={{ border: 1, borderColor: "divider" }}>
                <AddIcon fontSize="small" />
              </IconButton>
              {size && (
                <Button size="small" onClick={() => setQuantity(p.id, l.quantity + size)} sx={{ minWidth: 0, px: 1 }}>+1 ctn</Button>
              )}
              {size && l.quantity >= size && (
                <Typography variant="caption" color="text.secondary">
                  {Math.floor(l.quantity / size)} ctn{l.quantity % size ? ` + ${l.quantity % size}` : ""}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" color="error" onClick={() => removeItem(p.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  const paymentPanel = (
    <Box>
      {/* Customer */}
      {selectedCustomer ? (
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, mb: 1.5, display: "flex", alignItems: "center", gap: 1, borderColor: "success.main", bgcolor: alpha(theme.palette.success.main, 0.06) }}>
          <PersonIcon color="success" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{selectedCustomer.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              {selectedCustomer.phone} · <LoyaltyIcon sx={{ fontSize: 13 }} /> {selectedCustomer.loyalty_points} pts
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => { setSelectedCustomer(null); setPointsToUse(""); setUsingPoints(false); }}><CloseIcon fontSize="small" /></IconButton>
        </Paper>
      ) : (
        <Button fullWidth variant="text" startIcon={<PersonAddIcon />} onClick={() => setCustomerLookupOpen(true)} sx={{ mb: 1, justifyContent: "flex-start" }}>
          Add customer (loyalty points)
        </Button>
      )}

      {/* Loyalty points */}
      {selectedCustomer && rules.enabled && pointsAvailable > 0 && grossTotal > 1 && (
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, mb: 1.5, borderColor: alpha(loyaltyTier(pointsAvailable, store).color, 0.6) }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: usingPoints ? 1 : 0 }}>
            <Typography variant="body2">
              <b>{pointsAvailable.toLocaleString("en-NG")} points</b> = {naira(pointsAvailable * rules.pointValue)} off
            </Typography>
            {!usingPoints ? (
              <Button size="small" variant="outlined" onClick={() => { setUsingPoints(true); setPointsToUse(String(maxPoints)); }}>Use points</Button>
            ) : (
              <Button size="small" color="inherit" onClick={() => { setUsingPoints(false); setPointsToUse(""); }}>Don't use</Button>
            )}
          </Box>
          {usingPoints && (
            <TextField fullWidth size="small" type="number" label={`Points to use (max ${maxPoints.toLocaleString("en-NG")})`}
              value={pointsToUse} onChange={(e) => setPointsToUse(e.target.value)}
              inputProps={{ min: 0, max: maxPoints, inputMode: "numeric" }}
              helperText={pointsUsed > 0 ? `${naira(pointsDiscount)} off this sale` : "Enter how many points to use"} />
          )}
        </Paper>
      )}

      {/* Method */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.75, mb: 1.5 }}>
        {[["CASH", "Cash", CashIcon], ["TRANSFER", "Transfer", BankIcon], ["POS", "POS", CardIcon], ["SPLIT", "Split", SplitIcon]].map(([value, label, Icon]) => (
          <Button key={value} variant={paymentMethod === value ? "contained" : "outlined"} onClick={() => setPaymentMethod(value)}
            sx={{ minWidth: 0, px: 0.5, py: 0.75, flexDirection: "column", gap: 0.25, fontWeight: 700, fontSize: 12,
              ...(paymentMethod === value ? { background: BRAND_GRADIENT } : {}) }}>
            <Icon fontSize="small" />{label}
          </Button>
        ))}
      </Box>

      {(paymentMethod === "TRANSFER" || paymentMethod === "POS") && totalAmount > 0 && (
        <Alert severity="info" sx={{ mb: 1.5, py: 0.25 }}>
          {paymentMethod === "TRANSFER"
            ? <>Check the <b>{formatCurrency(totalAmount)}</b> transfer alert first.</>
            : <>Check the POS slip shows <b>{formatCurrency(totalAmount)}</b> approved.</>}
        </Alert>
      )}

      {paymentMethod === "SPLIT" && (
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <TextField label="Transfer part" type="number" size="small" value={transferPart} onChange={(e) => setTransferPart(e.target.value)}
            inputProps={{ min: 0, inputMode: "decimal" }} sx={{ flex: 1 }} />
          <TextField label="POS part" type="number" size="small" value={cardPart} onChange={(e) => setCardPart(e.target.value)}
            inputProps={{ min: 0, inputMode: "decimal" }} sx={{ flex: 1 }} />
        </Box>
      )}

      {(paymentMethod === "CASH" || (paymentMethod === "SPLIT" && payment.cashDue > 0)) && (
        <>
          {paymentMethod === "SPLIT" && (
            <Typography variant="body2" sx={{ mb: 1 }}>Cash to collect: <b>{formatCurrency(payment.cashDue)}</b></Typography>
          )}
          <TextField fullWidth size="small" type="number" label={paymentMethod === "SPLIT" ? "Cash received" : "Amount paid"}
            value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
            inputProps={{ min: 0, inputMode: "decimal" }}
            InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }} sx={{ mb: 1 }} />
          {quickAmounts.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
              {quickAmounts.map((a, i) => (
                <Chip key={a} size="small" color="primary" label={i === 0 ? `Exact ${naira(a)}` : naira(a)}
                  variant={parseFloat(paidAmount) === a ? "filled" : "outlined"} onClick={() => setPaidAmount(String(a))} sx={{ fontWeight: 600 }} />
              ))}
            </Box>
          )}
        </>
      )}

      {payment.ok && payment.change > 0 && (
        <Paper sx={{ p: 1.25, mb: 1.5, borderRadius: 2, textAlign: "center", bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main" }} elevation={0}>
          <Typography variant="caption" fontWeight={700}>CHANGE</Typography>
          <Typography variant="h5" fontWeight={800}>{formatCurrency(payment.change)}</Typography>
        </Paper>
      )}
      {/* Only once something has been typed: an empty box isn't an error yet */}
      {cart.length > 0 && payment.reason && (
        (paymentMethod === "CASH" && paidAmount !== "" && payment.short > 0) ||
        (paymentMethod === "SPLIT" && (transferPart !== "" || cardPart !== "" || paidAmount !== ""))
      ) && (
        <Alert severity="error" sx={{ mb: 1.5, py: 0.25 }}>{payment.reason}</Alert>
      )}
      {saleError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setSaleError("")}>{saleError}</Alert>}

      <Button fullWidth size="large" variant="contained" onClick={completeSale}
        disabled={!cart.length || !payment.ok || saving || isPrinting}
        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : isOnline ? <ReceiptIcon /> : <SaveIcon />}
        sx={{ py: 1.5, fontWeight: 800, fontSize: 16, ...(isOnline ? { background: BRAND_GRADIENT } : { bgcolor: "warning.main" }) }}>
        {saving ? "Saving…" : `${isOnline ? "Complete sale" : "Save sale offline"} · ${naira(totalAmount)}`}
      </Button>
      {isDesktop && cart.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 0.75 }}>Ctrl + Enter to complete</Typography>
      )}
    </Box>
  );

  const cartHeader = (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
      <Typography variant="subtitle1" fontWeight={800}>Cart {cart.length > 0 && `· ${itemCount.toLocaleString("en-NG")} item${itemCount === 1 ? "" : "s"}`}</Typography>
      {cart.length > 0 && <Button size="small" color="error" startIcon={<ClearCartIcon />} onClick={() => clearCart()}>Clear</Button>}
    </Box>
  );

  const totalBlock = (
    <Box sx={{ py: 1.25 }}>
      {pointsDiscount > 0 && (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2">{formatCurrency(grossTotal)}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", color: "success.main" }}>
            <Typography variant="body2">Points used ({pointsUsed.toLocaleString("en-NG")})</Typography>
            <Typography variant="body2" fontWeight={700}>-{formatCurrency(pointsDiscount)}</Typography>
          </Box>
        </>
      )}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography fontWeight={700}>Total</Typography>
        <Typography variant="h5" fontWeight={800} color="primary">{formatCurrency(totalAmount)}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, pb: { xs: cart.length ? 12 : 2, md: 3 }, maxWidth: 1500, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: "grid", placeItems: "center", background: BRAND_GRADIENT, color: "#fff", flexShrink: 0 }}>
            <PosIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" }, lineHeight: 1.1 }}>Sell</Typography>
            {lastRefresh && (
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                {products.length} products · updated {lastRefresh.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={pendingSales.length ? `${pendingSales.length} sale(s) waiting to sync. Tap to sync.` : isOnline ? "Online" : "Offline: sales are saved on this device"}>
            <Badge badgeContent={pendingSales.length} color="error">
              <Chip size="small" onClick={pendingSales.length ? manualSync : undefined}
                icon={pendingSales.length ? <SyncIcon /> : isOnline ? <OnlineIcon /> : <OfflineIcon />}
                label={isOnline ? (pendingSales.length ? "Sync" : "Online") : "Offline"}
                color={isOnline ? "success" : "warning"} variant={isOnline ? "outlined" : "filled"} sx={{ fontWeight: 700 }} />
            </Badge>
          </Tooltip>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}><MoreIcon /></IconButton>
        </Box>
      </Box>

      {!isOnline && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Offline. Keep selling: sales are saved on this device and sync when the internet is back
          {pendingSales.length > 0 && ` (${pendingSales.length} waiting)`}.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Products */}
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Autocomplete
                options={products}
                value={null}
                inputValue={searchText}
                onInputChange={(e, v, reason) => { if (reason === "input" || reason === "clear") setSearchText(v); }}
                onChange={(e, p) => {
                  if (!p) return;
                  // Enter on typed text: treat it as a barcode
                  const product = typeof p === "string" ? findByBarcode(p) : p;
                  if (product) { if (addProduct(product)) notify(`Added ${product.name}`, "success"); }
                  else notify(`No product with barcode or name "${p}"`, "error");
                  setSearchText("");
                }}
                autoHighlight
                getOptionLabel={(p) => p?.name || ""}
                filterOptions={(options, { inputValue }) => {
                  const t = inputValue.trim().toLowerCase();
                  if (!t) return [];
                  return options.filter((p) => p.name.toLowerCase().includes(t) || String(p.barcode || "").toLowerCase().includes(t)).slice(0, 30);
                }}
                blurOnSelect={!isDesktop}
                clearOnBlur={false}
                freeSolo
                noOptionsText="No product found"
                renderOption={(props, p) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={p.id} {...rest} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.barcode}{packSize(p) ? ` · ctn ${packSize(p)} for ${naira(p.bulk_price)}` : ""}</Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography variant="body2" fontWeight={800} color="primary">{naira(p.price)}</Typography>
                        <Typography variant="caption" color={p.stock <= 0 ? "error.main" : "text.secondary"}>{p.stock <= 0 ? "Out" : `${p.stock} left`}</Typography>
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} inputRef={searchRef} autoFocus={isDesktop} placeholder="Scan barcode or type a product name"
                    onKeyDown={(e) => { if (e.key === "Enter" && findByBarcode(searchText)) { e.preventDefault(); e.stopPropagation(); onSearchEnter(); } }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          {searchText && <IconButton size="small" onClick={() => setSearchText("")}><CloseIcon fontSize="small" /></IconButton>}
                          <Tooltip title="Scan with camera">
                            <IconButton color="primary" onClick={() => { setCameraMessage(""); setCameraOpen(true); }}><CameraIcon /></IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }} />
                )}
              />

              <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", py: 1.5, "&::-webkit-scrollbar": { display: "none" } }}>
                <Chip icon={<StarIcon />} label="Top sellers" onClick={() => setBrowse("top")} color={browse === "top" ? "primary" : "default"}
                  variant={browse === "top" ? "filled" : "outlined"} sx={{ fontWeight: 700, flexShrink: 0 }} />
                {categories.map(([id, name]) => (
                  <Chip key={id} label={name} onClick={() => setBrowse(String(id))} color={browse === String(id) ? "primary" : "default"}
                    variant={browse === String(id) ? "filled" : "outlined"} sx={{ fontWeight: 600, flexShrink: 0 }} />
                ))}
              </Box>

              {products.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={28} /></Box>
              ) : (
                <Grid container spacing={1} sx={{ maxHeight: { md: "calc(100vh - 330px)" }, overflowY: { md: "auto" } }}>
                  {tiles.map(tile)}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cart + payment on laptops */}
        {isDesktop && (
          <Grid size={{ md: 5, lg: 4 }}>
            <Card sx={{ position: "sticky", top: 16 }}>
              <CardContent sx={{ p: 2 }}>
                {cartHeader}
                <Box sx={{ maxHeight: "38vh", overflowY: "auto", mx: -0.5, px: 0.5 }}>{cartLines}</Box>
                {totalBlock}
                <Divider sx={{ mb: 1.5 }} />
                {paymentPanel}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Phones: sticky pay bar */}
      {!isDesktop && cart.length > 0 && (
        <Paper elevation={8} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: theme.zIndex.appBar, p: 1.25, pb: "calc(10px + env(safe-area-inset-bottom))", borderRadius: "16px 16px 0 0" }}>
          <Button fullWidth size="large" variant="contained" onClick={() => setCheckoutOpen(true)}
            sx={{ py: 1.25, background: BRAND_GRADIENT, justifyContent: "space-between", fontWeight: 800, fontSize: 16 }}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <Badge badgeContent={itemCount} color="error" max={999}><CartIcon /></Badge>
              <span style={{ marginLeft: 8 }}>{naira(totalAmount)}</span>
            </Box>
            <span>Pay →</span>
          </Button>
        </Paper>
      )}

      <Dialog open={!isDesktop && checkoutOpen} onClose={() => !saving && setCheckoutOpen(false)} fullScreen>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, background: BRAND_GRADIENT, color: "#fff" }}>
          <IconButton color="inherit" onClick={() => setCheckoutOpen(false)} disabled={saving}><CloseIcon /></IconButton>
          <Typography fontWeight={800} sx={{ flex: 1 }}>Checkout</Typography>
          <Typography fontWeight={800}>{naira(totalAmount)}</Typography>
        </Box>
        <Box sx={{ p: 1.5, overflowY: "auto", flex: 1 }}>
          {cartHeader}
          {cartLines}
          {totalBlock}
          <Divider sx={{ mb: 1.5 }} />
          {paymentPanel}
          <Button fullWidth sx={{ mt: 1 }} onClick={() => setCheckoutOpen(false)} startIcon={<AddIcon />}>Add more products</Button>
        </Box>
      </Dialog>

      {/* Tools menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setMenuAnchor(null); loadProducts(); }}><ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>Refresh products</MenuItem>
        {pendingSales.length > 0 && (
          <MenuItem onClick={() => { setMenuAnchor(null); manualSync(); }} disabled={!isOnline}>
            <ListItemIcon><SyncIcon fontSize="small" /></ListItemIcon>Sync {pendingSales.length} offline sale(s)
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenuAnchor(null); clearCart(); }} disabled={!cart.length}><ListItemIcon><ClearCartIcon fontSize="small" /></ListItemIcon>Clear cart</MenuItem>
        {isDesktop && <MenuItem onClick={() => { setMenuAnchor(null); setShortcutsOpen(true); }}><ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>Keyboard shortcuts</MenuItem>}
        <Divider />
        <MenuItem onClick={() => {
          setMenuAnchor(null);
          if (!isOnline) { notify("Saved products are needed while offline", "warning"); return; }
          if (window.confirm("Reload all products from the server? Use this only if prices or stock look wrong.")) {
            clearCachedProducts();
            loadProducts();
          }
        }}><ListItemIcon><ClearCacheIcon fontSize="small" /></ListItemIcon>Reload saved products</MenuItem>
      </Menu>

      {/* Quantity */}
      <Dialog open={Boolean(quantityEdit)} onClose={() => setQuantityEdit(null)} maxWidth="xs" fullWidth>
        {quantityEdit && (
          <>
            <DialogTitle>{quantityEdit.product.name}</DialogTitle>
            <DialogContent>
              <Box component="form" onSubmit={(e) => { e.preventDefault(); saveQuantityEdit(); }} sx={{ display: "flex", gap: 2, pt: 1 }}>
                {packSize(quantityEdit.product) && (
                  <TextField label="Cartons" type="number" autoFocus fullWidth value={quantityEdit.packs}
                    onChange={(e) => setQuantityEdit((prev) => ({ ...prev, packs: e.target.value }))}
                    helperText={`${quantityEdit.product.bulk_quantity} ${unitWord(quantityEdit.product)} each`}
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }} />
                )}
                <TextField label={packSize(quantityEdit.product) ? "Extra single items" : "Quantity"} type="number"
                  autoFocus={!packSize(quantityEdit.product)} fullWidth value={quantityEdit.singles}
                  onChange={(e) => setQuantityEdit((prev) => ({ ...prev, singles: e.target.value }))}
                  slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }} />
                <button type="submit" hidden />
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Total: <b>{quantityFromEdit(quantityEdit)}</b> {unitWord(quantityEdit.product)} · {formatCurrency(calculateItemPrice(quantityEdit.product, quantityFromEdit(quantityEdit)))}
              </Typography>
              <Typography variant="caption" color="text.secondary">{quantityEdit.product.stock} in stock</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setQuantityEdit(null)}>Cancel</Button>
              <Button variant="contained" onClick={saveQuantityEdit}>Set quantity</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Shortcuts */}
      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogContent>
          {[["F2 or Ctrl + K", "Go to the search / scan box"], ["Enter (after a scan)", "Add the scanned product"], ["Ctrl + Enter", "Complete the sale"], ["F1", "Show these shortcuts"]].map(([k, v]) => (
            <Box key={k} sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="body2" fontWeight={700}>{k}</Typography>
              <Typography variant="body2" color="text.secondary">{v}</Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            Clearing the cart always asks first, so no key can empty it by accident.
          </Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setShortcutsOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <BarcodeScannerDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onDetected={onCameraScan} lastResult={cameraMessage} />
      <CustomerLookupModal open={customerLookupOpen} onClose={() => setCustomerLookupOpen(false)}
        onSelectCustomer={(c) => { setSelectedCustomer(c); notify(`${c.name} added to the sale`, "success"); }}
        onAddNewCustomer={() => { setCustomerLookupOpen(false); setCustomerAddOpen(true); }} />
      <CustomerQuickAddModal open={customerAddOpen} onClose={() => setCustomerAddOpen(false)}
        onCustomerCreated={(c) => { setSelectedCustomer(c); setCustomerAddOpen(false); notify(`${c.name} created and added`, "success"); }} />

      <div style={{ display: "none" }}><Receipt ref={receiptRef} sale={lastSale} store={store} /></div>
      <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} sale={lastSale} store={store} />

      <Snackbar open={snackbar.open} autoHideDuration={2500} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: isDesktop ? "bottom" : "top", horizontal: "center" }}>
        <Alert variant="filled" severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SalesPage;
