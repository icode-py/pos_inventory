import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress,
} from "@mui/material";
import {
  Visibility, VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  Store as StoreIcon,
  PointOfSale as PosIcon,
  CheckCircleOutline as CheckIcon,
} from "@mui/icons-material";

const API_URL = import.meta.env.VITE_API_URL || '/api';

const FEATURES = [
  "Fast and reliable sales processing",
  "Real-time inventory management",
  "Comprehensive sales analytics",
  "Customer loyalty programs",
];

function Login() {
  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [store, setStore] = useState({ name: 'HOLO POS', tagline: 'Modern Point of Sale' });

  useEffect(() => {
    axios.get(`${API_URL}/store-settings/`)
      .then(res => setStore(res.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const success = await loginUser(username, password);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Invalid username or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        backgroundImage: `
          linear-gradient(135deg, rgba(102,126,234,0.93) 0%, rgba(118,75,162,0.93) 100%),
          url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80')
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "center",
        p: { xs: 0, md: 3 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle decorative blobs — desktop only */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)" }} />
      <Box sx={{ display: { xs: 'none', md: 'block' }, position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)" }} />

      {/* Main card */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "stretch",
          width: "100%",
          maxWidth: { xs: "100%", md: 1060 },
          minHeight: { xs: "100vh", md: 580 },
          borderRadius: { xs: 0, md: 4 },
          overflow: "hidden",
          boxShadow: { xs: "none", md: "0 30px 70px rgba(0,0,0,0.4)" },
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Left panel: branding (hidden on mobile) ── */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flex: "0 0 42%",
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(16px)",
            borderRight: "1px solid rgba(255,255,255,0.15)",
            color: "white",
            p: 5,
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
          }}
        >
          {/* Logo + store name */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <StoreIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="800" lineHeight={1.1} letterSpacing={-0.5}>
                {store.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.4 }}>
                {store.tagline}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body1" sx={{ opacity: 0.88, lineHeight: 1.8 }}>
            Streamline your store operations with a powerful and intuitive point of sale solution.
          </Typography>

          {/* Feature list */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.6 }}>
            {FEATURES.map(f => (
              <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <CheckIcon sx={{ fontSize: 18, opacity: 0.85, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ opacity: 0.88 }}>{f}</Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" sx={{ opacity: 0.55, mt: "auto" }}>
            © {new Date().getFullYear()} Holosoft Digital Solutions. All rights reserved.
          </Typography>
        </Box>

        {/* ── Right panel: form ── */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "white",
            p: { xs: 4, sm: 5, md: 6 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: { xs: "100vh", md: "auto" },
          }}
        >
          {/* Mobile: small brand header */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1.5,
              mb: 4,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StoreIcon sx={{ fontSize: 22, color: "white" }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.1}>
                {store.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {store.tagline}
              </Typography>
            </Box>
          </Box>

          {/* Form header */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
                boxShadow: "0 8px 24px rgba(102,126,234,0.4)",
              }}
            >
              <PosIcon sx={{ color: "white", fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight="bold">
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5} textAlign="center">
              Sign in to access your dashboard
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              required
              fullWidth
              value={username}
              onChange={e => setUsername(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <TextField
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              fullWidth
              value={password}
              onChange={e => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(p => !p)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 0.5,
                py: 1.6,
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: "bold",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: "0 6px 20px rgba(102,126,234,0.45)",
                '&:hover': {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 10px 28px rgba(102,126,234,0.5)",
                },
                transition: "all 0.2s ease",
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </Box>

          <Typography variant="caption" color="text.disabled" textAlign="center" mt={4} display="block">
            Secure POS System • Staff accounts are managed by your administrator
          </Typography>

          {/* Mobile copyright */}
          <Typography
            variant="caption"
            color="text.disabled"
            textAlign="center"
            mt={1}
            display={{ xs: "block", md: "none" }}
          >
            © {new Date().getFullYear()} Holosoft Digital Solutions
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Login;
