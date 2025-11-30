import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Divider, Button, LinearProgress, List, ListItem,
  ListItemText, ListItemIcon
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Loyalty as LoyaltyIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const CustomerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCustomerData();
    }
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      const [customerResponse, transactionsResponse] = await Promise.all([
        axiosInstance.get(`/customers/${id}/`),
        axiosInstance.get(`/customer-transactions/?customer_id=${id}`)
      ]);
      
      setCustomer(customerResponse.data);
      setTransactions(transactionsResponse.data);
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLoyaltyTier = (points) => {
    if (points >= 1000) return { label: 'Gold', color: 'warning', progress: 100 };
    if (points >= 500) return { label: 'Silver', color: 'default', progress: 50 };
    return { label: 'Bronze', color: 'secondary', progress: 25 };
  };

  const calculateNextTier = (points) => {
    if (points < 500) return { tier: 'Silver', needed: 500 - points };
    if (points < 1000) return { tier: 'Gold', needed: 1000 - points };
    return { tier: 'Max', needed: 0 };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading customer profile...</Typography>
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">Customer not found</Typography>
        <Button onClick={() => navigate('/customers')} startIcon={<ArrowBackIcon />}>
          Back to Customers
        </Button>
      </Box>
    );
  }

  const tier = getLoyaltyTier(customer.loyalty_points);
  const nextTier = calculateNextTier(customer.loyalty_points);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          Customer Profile
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Customer Info Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.main',
                  fontSize: '2rem',
                  mx: 'auto',
                  mb: 2
                }}
              >
                {customer.name.charAt(0).toUpperCase()}
              </Avatar>
              
              <Typography variant="h5" gutterBottom>
                {customer.name}
              </Typography>
              
              <Chip 
                label={tier.label} 
                color={tier.color}
                size="small"
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ textAlign: 'left', mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Phone:</strong> {customer.phone}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Email:</strong> {customer.email || 'Not provided'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Member Since:</strong> {new Date(customer.created_at).toLocaleDateString()}
                </Typography>
                {customer.notes && (
                  <Typography variant="body2">
                    <strong>Notes:</strong> {customer.notes}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Loyalty Progress */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LoyaltyIcon color="primary" />
                Loyalty Progress
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Current Points</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {customer.loyalty_points}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={tier.progress} 
                  color={tier.color}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {nextTier.needed > 0 && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    <strong>{nextTier.needed} points</strong> needed for {nextTier.tier} tier
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Statistics and Transactions */}
        <Grid item xs={12} md={8}>
          {/* Statistics Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <MoneyIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">
                    ₦{parseFloat(customer.total_spent).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">Total Spent</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CartIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">{customer.total_visits}</Typography>
                  <Typography variant="body2">Total Visits</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <LoyaltyIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">{customer.loyalty_points}</Typography>
                  <Typography variant="body2">Loyalty Points</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recent Transactions */}
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon color="primary" />
                  Purchase History
                </Typography>
              </Box>

              {transactions.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No purchase history found for this customer.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Sale ID</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Points Earned</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CalendarIcon color="action" fontSize="small" />
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              #{transaction.sale}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body1" fontWeight="bold">
                              ₦{parseFloat(transaction.sale_details?.total_amount || 0).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`+${transaction.points_earned}`} 
                              size="small" 
                              color="success"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Insights
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <MoneyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Average Spend per Visit"
                    secondary={`₦${(parseFloat(customer.total_spent) / customer.total_visits || 0).toFixed(2)}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <LoyaltyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Points per Naira"
                    secondary={`${(customer.loyalty_points / parseFloat(customer.total_spent) * 100 || 0).toFixed(2)} points per ₦100`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerProfile;