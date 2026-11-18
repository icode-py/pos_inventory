// Shared building blocks for the admin pages, in the same style as Reports / Products
import { Box, Card, CardContent, IconButton, Paper, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Refresh as RefreshIcon } from "@mui/icons-material";

export const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export function IconBadge({ icon: Icon, color, size = 34 }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: size > 32 ? 2.5 : 2, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.14), color }}>
      <Icon sx={{ fontSize: Math.round(size * 0.55) }} />
    </Box>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, onRefresh, loading, actions }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 2, flexWrap: "wrap" }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: "grid", placeItems: "center", background: BRAND_GRADIENT, color: "#fff", flexShrink: 0 }}>
            <Icon fontSize="small" />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.3rem", md: "1.6rem" } }}>{title}</Typography>
        </Box>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {actions}
        {onRefresh && (
          <Tooltip title="Refresh"><span><IconButton color="primary" onClick={onRefresh} disabled={loading}><RefreshIcon /></IconButton></span></Tooltip>
        )}
      </Box>
    </Box>
  );
}

export function Section({ title, icon, color, action, children, sx }) {
  const theme = useTheme();
  return (
    <Card sx={{ height: "100%", ...sx }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        {(title || action) && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              {icon && <IconBadge icon={icon} color={color || theme.palette.primary.main} size={30} />}
              <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
            </Box>
            {action}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function StatTile({ label, value, note, icon, color, onClick, active }) {
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

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <Box sx={{ textAlign: "center", py: 5, px: 2, color: "text.secondary" }}>
      {Icon && <Icon sx={{ fontSize: 48, opacity: 0.4 }} />}
      {title && <Typography fontWeight={700} color="text.primary" sx={{ mt: 1 }}>{title}</Typography>}
      {children && <Typography variant="body2" sx={{ mt: 0.5 }}>{children}</Typography>}
    </Box>
  );
}

export const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const naira = (n, d = 0) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: d, maximumFractionDigits: 2 })}`;
export const count = (n) => Number(n || 0).toLocaleString("en-NG");
export const plural = (n, w) => `${count(n)} ${w}${Number(n) === 1 ? "" : "s"}`;
export const timeAgo = (iso) => {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};
