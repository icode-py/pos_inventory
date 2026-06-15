import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress, Chip,
} from "@mui/material";
import {
  Visibility, VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  Store as StoreIcon,
  PointOfSale as PosIcon,
  CheckCircleOutline as CheckIcon,
  ShoppingCart as CartIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingIcon,
  Loyalty as LoyaltyIcon,
} from "@mui/icons-material";

const API_URL = import.meta.env.VITE_API_URL || '/api';

const FEATURES = [
  { icon: <CartIcon sx={{ fontSize: 16 }} />, label: "Fast sales processing" },
  { icon: <InventoryIcon sx={{ fontSize: 16 }} />, label: "Inventory management" },
  { icon: <TrendingIcon sx={{ fontSize: 16 }} />, label: "Sales analytics" },
  { icon: <LoyaltyIcon sx={{ fontSize: 16 }} />, label: "Customer loyalty" },
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
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 0, sm: 3 },
        // Background image with gradient overlay
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          backgroundImage: `url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1920&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(30,20,60,0.78) 0%, rgba(102,126,234,0.72) 50%, rgba(118,75,162,0.80) 100%)',
          zIndex: 1,
        },
      }}
    >
      {/* Floating particles for depth */}
      <Box sx={{ position: 'fixed', top: '10%', left: '8%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', zIndex: 2 }} />
      <Box sx={{ position: 'fixed', bottom: '12%', right: '6%', width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', zIndex: 2 }} />
      <Box sx={{ position: 'fixed', top: '50%', right: '20%', width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', zIndex: 2 }} />

      {/* Main card */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 3,
          width: '100%',
          maxWidth: { xs: '100%', sm: 480 },
          minHeight: { xs: '100vh', sm: 'auto' },
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: { xs: 'none', sm: '1px solid rgba(255,255,255,0.22)' },
          borderRadius: { xs: 0, sm: 4 },
          boxShadow: { xs: 'none', sm: '0 32px 80px rgba(0,0,0,0.45)' },
          overflow: 'hidden',
        }}
      >
        {/* Top branding strip */}
        <Box
          sx={{
            px: { xs: 4, sm: 5 },
            pt: { xs: 6, sm: 5 },
            pb: 3,
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: '0 12px 32px rgba(102,126,234,0.5)',
            }}
          >
            <StoreIcon sx={{ fontSize: 36, color: 'white' }} />
          </Box>

          <Typography
            variant="h4"
            fontWeight="800"
            sx={{
              color: 'white',
              letterSpacing: '-0.5px',
              textShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {store.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', mt: 0.5 }}>
            {store.tagline}
          </Typography>

          {/* Feature chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 2.5 }}>
            {FEATURES.map(f => (
              <Chip
                key={f.label}
                icon={f.icon}
                label={f.label}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.88)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  '& .MuiChip-icon': { color: 'rgba(255,255,255,0.7)' },
                  fontSize: '0.72rem',
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Form section */}
        <Box
          sx={{
            px: { xs: 4, sm: 5 },
            py: 4,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              <PosIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight="bold" sx={{ color: 'white' }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.3 }}>
              Sign in to access your dashboard
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: 2,
                bgcolor: 'rgba(211,47,47,0.15)',
                color: 'white',
                border: '1px solid rgba(211,47,47,0.4)',
                '& .MuiAlert-icon': { color: '#ff6b6b' },
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    <PersonIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.10)',
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.65)' },
                '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              }}
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
                    <LockIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(p => !p)} edge="end" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.10)',
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.65)' },
                '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
              }}
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
                fontSize: '1rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 8px 24px rgba(102,126,234,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7b8ff5 0%, #8a5db8 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 32px rgba(102,126,234,0.6)',
                },
                '&:active': { transform: 'translateY(0px)' },
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 4,
            py: 2.5,
            borderTop: '1px solid rgba(255,255,255,0.10)',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block' }}>
            Secure POS System • Staff accounts managed by administrator
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block', mt: 0.3 }}>
            © {new Date().getFullYear()} Holosoft Digital Solutions
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Login;
