import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, TextField, Button, Typography,
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
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative circles */}
      <Box sx={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)" }} />
      <Box sx={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.08)" }} />
      <Box sx={{ position: "absolute", top: "40%", left: "15%", width: 120, height: 120, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)" }} />

      {/* Main card — always side by side */}
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          width: "100%",
          maxWidth: 1050,
          minHeight: 560,
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Left panel: branding ── */}
        <Box
          sx={{
            flex: "0 0 42%",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            color: "white",
            p: 5,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
          }}
        >
          {/* Logo + name */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <StoreIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" lineHeight={1.1}>
                {store.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.3 }}>
                {store.tagline}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body1" sx={{ opacity: 0.9, lineHeight: 1.7 }}>
            Streamline your store operations with a powerful and intuitive point of sale solution.
          </Typography>

          {/* Feature list */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {FEATURES.map(f => (
              <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <CheckIcon sx={{ fontSize: 18, opacity: 0.9, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>{f}</Typography>
              </Box>
            ))}
          </Box>

          {/* Footer */}
          <Typography variant="caption" sx={{ opacity: 0.6, mt: "auto" }}>
            © {new Date().getFullYear()} Holosoft Digital Solutions. All rights reserved.
          </Typography>
        </Box>

        {/* ── Right panel: form ── */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            p: { xs: 4, sm: 6 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Form header */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
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

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                mt: 1,
                py: 1.5,
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: "bold",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                '&:hover': {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                  transform: "translateY(-1px)",
                  boxShadow: 4,
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </Box>

          <Typography variant="caption" color="text.disabled" textAlign="center" mt={4} display="block">
            Secure POS System • Staff accounts are managed by your administrator
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Login;
