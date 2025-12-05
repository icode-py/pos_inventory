import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Alert,
  Box,
  Typography,
  Card,
  CardContent
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  HowToReg as RegisterIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const StaffRegistrationModal = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axiosInstance.post('/register-staff/', formData);
      setSuccess('Account created successfully! You can now login.');
      
      // Reset form
      setFormData({
        username: '',
        password: '',
        confirm_password: ''
      });
      
      // Call success callback
      onSuccess?.();
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Registration failed:', err);
      if (err.response?.data) {
        const errors = err.response.data;
        if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).flat().join(', ');
          setError(errorMessages);
        } else {
          setError(err.response.data.error || 'Registration failed');
        }
      } else {
        setError('Registration failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return formData.username && 
           formData.password && 
           formData.confirm_password && 
           formData.password === formData.confirm_password &&
           formData.password.length >= 6 &&
           formData.username.length >= 3;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PersonAddIcon color="primary" />
          <Typography variant="h6">Create New Account</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Registration Info Card */}
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'info.light' }}>
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <SecurityIcon color="info" />
              <Typography variant="subtitle2" fontWeight="bold">
                Default Role: Staff
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              After registration, an admin will assign your specific role (Cashier, Manager, or Admin)
            </Typography>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              fullWidth
              required
              disabled={loading}
              helperText="Minimum 3 characters (letters, numbers, underscores only)"
              error={formData.username && formData.username.length < 3}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              fullWidth
              required
              disabled={loading}
              helperText="Minimum 6 characters"
              error={formData.password && formData.password.length < 6}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Confirm Password"
              name="confirm_password"
              type="password"
              value={formData.confirm_password}
              onChange={handleChange}
              fullWidth
              required
              disabled={loading}
              error={formData.confirm_password && formData.password !== formData.confirm_password}
              helperText={formData.confirm_password && formData.password !== formData.confirm_password ? "Passwords don't match" : ""}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !isFormValid()}
          startIcon={loading ? null : <RegisterIcon />}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StaffRegistrationModal;