import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Card,
  CardContent
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  Store as StoreIcon,
  PointOfSale as PosIcon,
  AdminPanelSettings as AdminIcon,
  ManageAccounts as ManagerIcon,
  PointOfSale as CashierIcon
} from "@mui/icons-material";

function Login() {
  const { loginUser } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleDemoLogin = (role) => {
    const demoCredentials = {
      cashier: { username: "cashier", password: "cashier123" },
      manager: { username: "manager", password: "manager123" },
      admin: { username: "admin", password: "admin123" }
    };
    
    setUsername(demoCredentials[role].username);
    setPassword(demoCredentials[role].password);
  };

  const DemoLoginCard = ({ role, icon, title, description }) => (
    <Card 
      sx={{ 
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
          borderColor: 'primary.main'
        }
      }}
      variant="outlined"
      onClick={() => handleDemoLogin(role)}
    >
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Box sx={{ color: 'primary.main', mb: 2 }}>
          {icon}
        </Box>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          sx={{ mt: 2 }}
          fullWidth
        >
          Use {title} Demo
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background decorative elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -50,
          left: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
        }}
      />

      <Container 
        component="main" 
        maxWidth="lg"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Grid container spacing={4} alignItems="center" justifyContent="center">
          {/* Left Side - Branding */}
          <Grid item xs={12} md={5}>
            <Box
              sx={{
                color: "white",
                textAlign: { xs: 'center', md: 'left' },
                mb: { xs: 4, md: 0 }
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 4,
                  justifyContent: { xs: 'center', md: 'flex-start' }
                }}
              >
                <StoreIcon sx={{ fontSize: 64 }} />
                <Box>
                  <Typography variant="h2" component="h1" fontWeight="bold" gutterBottom>
                    HOLOSOFT
                  </Typography>
                  <Typography variant="h5" sx={{ opacity: 0.9 }}>
                    Modern POS System
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9, maxWidth: 400 }}>
                Streamline your supermarket operations with our powerful and intuitive point of sale solution.
              </Typography>

              {/* Features List */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                  <Typography>Fast and reliable sales processing</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                  <Typography>Real-time inventory management</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                  <Typography>Comprehensive sales analytics</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                  <Typography>Customer loyalty programs</Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Right Side - Login Form */}
          <Grid item xs={12} md={7}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper
                elevation={8}
                sx={{
                  padding: 4,
                  width: "100%",
                  maxWidth: 500,
                  borderRadius: 3,
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.2)"
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    mb: 3
                  }}
                >
                  <PosIcon 
                    sx={{ 
                      fontSize: 48, 
                      color: "primary.main",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: "50%",
                      p: 1
                    }} 
                  />
                  <Typography variant="h4" component="h2" fontWeight="bold" textAlign="center">
                    Welcome Back
                  </Typography>
                  <Typography variant="body1" color="text.secondary" textAlign="center">
                    Sign in to access your dashboard and manage your store
                  </Typography>
                </Box>

                {/* Error Alert */}
                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      }
                    }}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon color="primary" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleClickShowPassword}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    sx={{
                      mt: 1,
                      mb: 3,
                      py: 1.5,
                      borderRadius: 2,
                      fontSize: "1.1rem",
                      fontWeight: "bold",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      '&:hover': {
                        background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                        transform: "translateY(-2px)",
                        boxShadow: 4
                      },
                      '&:disabled': {
                        background: "grey.300"
                      }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </Box>

                {/* Demo Login Section */}
                {/* <Box sx={{ mb: 3 }}>
                  <Divider sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Quick Demo Access
                    </Typography>
                  </Divider>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <DemoLoginCard
                        role="admin"
                        icon={<AdminIcon fontSize="large" />}
                        title="Admin"
                        description="Full system access and management"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <DemoLoginCard
                        role="manager"
                        icon={<ManagerIcon fontSize="large" />}
                        title="Manager"
                        description="Staff and inventory management"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <DemoLoginCard
                        role="cashier"
                        icon={<CashierIcon fontSize="large" />}
                        title="Cashier"
                        description="Point of sale operations"
                      />
                    </Grid>
                  </Grid>
                </Box> */}

                {/* Footer */}
                <Box sx={{ mt: 4, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Secure POS System • v1.0.0
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    © 2025 HOLOSOFT DIGITAL SOLUTIONS. All rights reserved.
                  </Typography>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Login;