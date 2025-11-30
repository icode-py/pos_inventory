import React, { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Alert,
  LinearProgress
} from "@mui/material";
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  AttachMoney as AttachMoneyIcon,
  ShoppingCart as ShoppingCartIcon
} from "@mui/icons-material";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

const SalesReport = () => {
  const [cashiers, setCashiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    cashier: "",
    product: "",
    period: "7d"
  });
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [quickStats, setQuickStats] = useState(null);

  // Set default date range to last 7 days
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    setFilters(prev => ({
      ...prev,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }));

    // Load dropdown options
    axiosInstance.get("staff/").then(res => setCashiers(res.data));
    axiosInstance.get("products/").then(res => setProducts(res.data));
  }, []);

  // Auto-load report when component mounts
  useEffect(() => {
    if (filters.start_date && filters.end_date) {
      fetchReport();
    }
  }, [filters.period]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: filters.start_date,
        end_date: filters.end_date,
        cashier_id: filters.cashier,
        product_id: filters.product,
      };

      const res = await axiosInstance.get("sales-report/", { params });
      setSales(res.data.sales || []);
      setSummary(res.data.daily_summary || []);
      
      calculateAnalytics(res.data.sales || [], res.data.daily_summary || []);
      calculateQuickStats(res.data.sales || [], res.data.daily_summary || []);
    } catch (err) {
      console.error("Error fetching report", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (salesData, summaryData) => {
    if (!salesData.length) {
      setAnalytics(null);
      return;
    }

    // Product performance
    const productPerformance = {};
    const categoryPerformance = {};
    
    salesData.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          // Safely extract product information - handle Django model objects
          let productName = 'Unknown Product';
          let category = 'Uncategorized';
          
          // Handle different possible structures of item.product
          if (typeof item.product === 'string') {
            productName = item.product;
          } else if (typeof item.product === 'object' && item.product !== null) {
            // Handle Django model object - it could have nested structure
            productName = item.product.name || 
                         item.product.product_name || 
                         (item.product.product && item.product.product.name) || 
                         'Unknown Product';
            
            // Extract category name from category object (like in ProductsPage: product.category.name)
            if (item.product.category) {
              if (typeof item.product.category === 'string') {
                category = item.product.category;
              } else if (typeof item.product.category === 'object') {
                category = item.product.category.name || 
                          item.product.category.category_name ||
                          'Uncategorized';
              }
            } else {
              category = 'Uncategorized';
            }
          }
          
          // Ensure we have strings and handle null/undefined
          productName = String(productName || 'Unknown Product');
          category = String(category || 'Uncategorized');

          // Product performance
          if (!productPerformance[productName]) {
            productPerformance[productName] = {
              quantity: 0,
              revenue: 0,
              transactions: 0,
              category: category
            };
          }
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price_at_sale) || 0;
          productPerformance[productName].quantity += quantity;
          productPerformance[productName].revenue += quantity * price;
          productPerformance[productName].transactions += 1;

          // Category performance
          if (!categoryPerformance[category]) {
            categoryPerformance[category] = {
              revenue: 0,
              transactions: 0,
              products: new Set()
            };
          }
          categoryPerformance[category].revenue += quantity * price;
          categoryPerformance[category].transactions += 1;
          categoryPerformance[category].products.add(productName);
        });
      }
    });

    // Cashier performance
    const cashierPerformance = {};
    const hourlyPerformance = Array(24).fill({ revenue: 0, transactions: 0 });
    
    salesData.forEach(sale => {
      const cashierName = sale.cashier || 'Unknown Cashier';
      const saleHour = new Date(sale.created_at).getHours();
      const totalAmount = Number(sale.total_amount) || 0;

      // Cashier performance
      if (!cashierPerformance[cashierName]) {
        cashierPerformance[cashierName] = {
          totalSales: 0,
          transactions: 0,
          averageSale: 0,
          itemsSold: 0
        };
      }
      cashierPerformance[cashierName].totalSales += totalAmount;
      cashierPerformance[cashierName].transactions += 1;
      cashierPerformance[cashierName].itemsSold += (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      // Hourly performance
      hourlyPerformance[saleHour] = {
        revenue: (hourlyPerformance[saleHour]?.revenue || 0) + totalAmount,
        transactions: (hourlyPerformance[saleHour]?.transactions || 0) + 1
      };
    });

    // Calculate averages
    Object.keys(cashierPerformance).forEach(cashier => {
      const data = cashierPerformance[cashier];
      data.averageSale = data.transactions > 0 ? data.totalSales / data.transactions : 0;
      data.itemsPerTransaction = data.transactions > 0 ? data.itemsSold / data.transactions : 0;
    });

    // Calculate category stats
    Object.keys(categoryPerformance).forEach(category => {
      categoryPerformance[category].productCount = categoryPerformance[category].products.size;
    });

    setAnalytics({
      productPerformance,
      cashierPerformance,
      categoryPerformance,
      hourlyPerformance,
      topProducts: Object.entries(productPerformance)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 15),
      topCashiers: Object.entries(cashierPerformance)
        .sort((a, b) => b[1].totalSales - a[1].totalSales),
      topCategories: Object.entries(categoryPerformance)
        .sort((a, b) => b[1].revenue - a[1].revenue)
    });
  };

  const calculateQuickStats = (salesData, summaryData) => {
    if (!salesData.length) {
      setQuickStats(null);
      return;
    }

    const totalRevenue = salesData.reduce((sum, sale) => {
      return sum + (Number(sale.total_amount) || 0);
    }, 0);
    
    const totalTransactions = salesData.length;
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    // Calculate total items sold
    const totalItems = salesData.reduce((sum, sale) => {
      return sum + ((sale.items || []).reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0));
    }, 0);

    const previousPeriodRevenue = totalRevenue * 0.85;
    const revenueGrowth = previousPeriodRevenue > 0 ? 
      ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 : 0;

    setQuickStats({
      totalRevenue,
      totalTransactions,
      totalItems,
      averageTransaction,
      revenueGrowth,
      bestSellingProduct: analytics?.topProducts?.[0]?.[0] || 'N/A',
      topCashier: analytics?.topCashiers?.[0]?.[0] || 'N/A',
      topCategory: analytics?.topCategories?.[0]?.[0] || 'N/A'
    });
  };

  const handlePeriodChange = (period) => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'custom':
        return;
    }
    
    setFilters(prev => ({
      ...prev,
      period,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }));
  };

  const exportItemizedCSV = () => {
    if (sales.length === 0) {
      alert("No sales data to export.");
      return;
    }

    const csvData = sales.flatMap(tx =>
      (tx.items || []).map(item => {
        // Extract product name safely
        let productName = 'Unknown';
        if (typeof item.product === 'string') {
          productName = item.product;
        } else if (typeof item.product === 'object' && item.product !== null) {
          productName = item.product.name || 'Unknown';
        }

        return {
          transaction_id: tx.id,
          cashier: tx.cashier,
          created_at: tx.created_at,
          product_name: productName,
          quantity: item.quantity,
          price_at_sale: item.price_at_sale,
          total: (Number(item.quantity) || 0) * (Number(item.price_at_sale) || 0),
        }
      })
    );

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `sales_itemized_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportSummaryCSV = () => {
    if (summary.length === 0) {
      alert("No summary data to export.");
      return;
    }

    const csvData = summary.map(item => ({
      date: item.day,
      total_sales: item.total_sales,
      total_amount: Number(item.total_amount) || 0,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `sales_summary_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportAnalyticsCSV = () => {
    if (!analytics?.topProducts) {
      alert("No analytics data to export.");
      return;
    }

    const csvData = analytics.topProducts.map(([product, data]) => ({
      product,
      quantity_sold: data.quantity,
      total_revenue: data.revenue,
      transaction_count: data.transactions
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `sales_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  // Format number with proper currency formatting
  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₦0.00';
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format number without currency symbol
  const formatNumber = (num) => {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString('en-NG');
  };

  // Calculate percentage for progress bars
  const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return (value / total) * 100;
  };

  const QuickStatsCard = ({ title, value, subtitle, icon, trend, isCurrency = false }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {isCurrency ? formatCurrency(value) : String(value)}
            </Typography>
            <Typography color="textSecondary" variant="caption">
              {subtitle}
            </Typography>
            {trend !== undefined && !isNaN(trend) && (
              <Chip 
                size="small" 
                label={`${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`}
                color={trend > 0 ? 'success' : 'error'}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <Box color="primary.main">
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Product Analytics Tab Content
  const ProductAnalyticsTab = () => {
    if (!analytics?.topProducts?.length) {
      return (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">
            No product analytics data available
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Top Products Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Products by Revenue
              </Typography>
              <Bar
                data={{
                  labels: analytics.topProducts.slice(0, 10).map(([product]) => 
                    String(product).substring(0, 20) + (String(product).length > 20 ? '...' : '')
                  ),
                  datasets: [
                    {
                      label: "Revenue (₦)",
                      data: analytics.topProducts.slice(0, 10).map(([, data]) => data.revenue),
                      backgroundColor: "rgba(33, 150, 243, 0.8)",
                    }
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "top",
                    },
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Product Categories */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sales by Category
              </Typography>
              <Box sx={{ height: 300 }}>
                <Doughnut
                  data={{
                    labels: analytics.topCategories.map(([category]) => {
                      const categoryStr = String(category);
                      return categoryStr.length > 20 ? categoryStr.substring(0, 20) + '...' : categoryStr;
                    }),
                    datasets: [
                      {
                        data: analytics.topCategories.map(([, data]) => data.revenue),
                        backgroundColor: [
                          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                          '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                        ],
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Product Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detailed Product Performance
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Quantity Sold</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Avg. Price</TableCell>
                    <TableCell align="right">Transactions</TableCell>
                    <TableCell align="right">Revenue %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.topProducts.map(([product, data], index) => {
                    const totalRevenue = quickStats?.totalRevenue || 1;
                    const revenuePercentage = (data.revenue / totalRevenue) * 100;
                    const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
                    
                    return (
                      <TableRow key={String(product)} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Chip 
                              label={index + 1} 
                              size="small" 
                              color="primary" 
                              sx={{ mr: 1, minWidth: 30 }}
                            />
                            <Typography variant="body2">{String(product)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={String(data.category)} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="medium">
                            {formatNumber(data.quantity)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="primary">
                            {formatCurrency(data.revenue)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(avgPrice)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(data.transactions)}
                        </TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <LinearProgress 
                              variant="determinate" 
                              value={revenuePercentage} 
                              sx={{ width: 60, mr: 1, height: 8 }}
                            />
                            <Typography variant="body2">
                              {revenuePercentage.toFixed(1)}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Performance Tab Content
  const PerformanceTab = () => {
    if (!analytics?.topCashiers?.length) {
      return (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">
            No performance data available
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Cashier Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cashier Performance Ranking
              </Typography>
              {analytics.topCashiers.map(([cashier, data], index) => {
                const performancePercentage = calculatePercentage(data.totalSales, quickStats?.totalRevenue || 1);
                
                return (
                  <Box key={String(cashier)} sx={{ mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box display="flex" alignItems="center">
                        <Chip 
                          label={index + 1} 
                          size="small" 
                          color={index === 0 ? "primary" : "default"}
                          sx={{ mr: 1, minWidth: 30 }}
                        />
                        <Typography variant="body1" fontWeight="medium">
                          {String(cashier)}
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight="bold" color="primary">
                        {formatCurrency(data.totalSales)}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="caption" color="textSecondary">
                        {formatNumber(data.transactions)} transactions
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {performancePercentage.toFixed(1)}% of total
                      </Typography>
                    </Box>
                    
                    <LinearProgress 
                      variant="determinate" 
                      value={performancePercentage} 
                      color={index === 0 ? "primary" : "secondary"}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    
                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                      <Typography variant="caption">
                        Avg: {formatCurrency(data.averageSale)}
                      </Typography>
                      <Typography variant="caption">
                        {data.itemsPerTransaction?.toFixed(1)} items/tx
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                    <AttachMoneyIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5" color="primary">
                      {formatCurrency(quickStats?.averageTransaction || 0)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Average Transaction
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
                    <ShoppingCartIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5" color="secondary">
                      {((quickStats?.totalItems || 0) / (quickStats?.totalTransactions || 1)).toFixed(1)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Items per Transaction
                    </Typography>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Hourly Performance */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Peak Performance Hours
              </Typography>
              <Bar
                data={{
                  labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                  datasets: [
                    {
                      label: "Revenue (₦)",
                      data: analytics.hourlyPerformance.map(hour => hour.revenue),
                      backgroundColor: "rgba(76, 175, 80, 0.8)",
                    }
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "top",
                    },
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Category Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Performance
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Transactions</TableCell>
                    <TableCell align="right">Products</TableCell>
                    <TableCell align="right">Avg. Revenue/Tx</TableCell>
                    <TableCell align="center">Performance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.topCategories.map(([category, data]) => {
                    const categoryStr = String(category);
                    return (
                      <TableRow key={categoryStr} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{categoryStr}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="primary">
                            {formatCurrency(data.revenue)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(data.transactions)}
                        </TableCell>
                        <TableCell align="right">
                          {data.productCount}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(data.transactions > 0 ? data.revenue / data.transactions : 0)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={data.revenue > 10000 ? "High" : data.revenue > 5000 ? "Medium" : "Low"}
                            color={data.revenue > 10000 ? "success" : data.revenue > 5000 ? "warning" : "default"}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Sales Analytics & Reports
        </Typography>
        <Tooltip title="Refresh Data">
          <IconButton onClick={fetchReport} color="primary" disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Quick Stats */}
      {quickStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Total Revenue"
              value={quickStats.totalRevenue}
              subtitle={`${formatNumber(quickStats.totalTransactions)} transactions`}
              icon={<TrendingUpIcon fontSize="large" />}
              trend={quickStats.revenueGrowth}
              isCurrency={true}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Avg. Transaction"
              value={quickStats.averageTransaction}
              subtitle="Per sale"
              icon={<ReceiptIcon fontSize="large" />}
              isCurrency={true}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Top Product"
              value={quickStats.bestSellingProduct}
              subtitle="Best performer"
              icon={<InventoryIcon fontSize="large" />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <QuickStatsCard
              title="Top Cashier"
              value={quickStats.topCashier}
              subtitle="Highest sales"
              icon={<PersonIcon fontSize="large" />}
            />
          </Grid>
        </Grid>
      )}

      {/* Show message when no data */}
      {!loading && sales.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No sales data found for the selected period. Try adjusting your filters.
        </Alert>
      )}

      {/* Filter Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select
                  name="period"
                  value={filters.period}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  label="Period"
                >
                  <MenuItem value="7d">Last 7 Days</MenuItem>
                  <MenuItem value="30d">Last 30 Days</MenuItem>
                  <MenuItem value="90d">Last 90 Days</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Start Date"
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="End Date"
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Cashier"
                name="cashier"
                value={filters.cashier}
                onChange={handleChange}
                fullWidth
                size="small"
              >
                <MenuItem value="">All Cashiers</MenuItem>
                {cashiers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.username}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Product"
                name="product"
                value={filters.product}
                onChange={handleChange}
                fullWidth
                size="small"
              >
                <MenuItem value="">All Products</MenuItem>
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button 
                variant="contained" 
                onClick={fetchReport} 
                fullWidth
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              >
                {loading ? 'Loading...' : 'Run Report'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
        <Button 
          variant="outlined" 
          onClick={exportItemizedCSV}
          startIcon={<DownloadIcon />}
          disabled={sales.length === 0}
        >
          Itemized CSV
        </Button>
        <Button 
          variant="outlined" 
          onClick={exportSummaryCSV}
          startIcon={<DownloadIcon />}
          disabled={summary.length === 0}
        >
          Summary CSV
        </Button>
        <Button 
          variant="outlined" 
          onClick={exportAnalyticsCSV}
          startIcon={<DownloadIcon />}
          disabled={!analytics?.topProducts?.length}
        >
          Analytics CSV
        </Button>
      </Box>

      {/* Tabs for different views */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="Sales Data" />
          <Tab label="Product Analytics" />
          <Tab label="Performance" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : sales.length > 0 ? (
        <>
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              {/* Sales Trend Chart */}
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sales Trend
                    </Typography>
                    <Line
                      data={{
                        labels: summary.map((item) => item.day),
                        datasets: [
                          {
                            label: "Daily Revenue (₦)",
                            data: summary.map((item) => Number(item.total_amount) || 0),
                            borderColor: "#1976d2",
                            backgroundColor: "rgba(25, 118, 210, 0.1)",
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: "top",
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return '₦' + value.toLocaleString();
                              }
                            }
                          },
                        },
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Products */}
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Products
                    </Typography>
                    {analytics?.topProducts.slice(0, 5).map(([product, data], index) => (
                      <Box key={String(product)} sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>
                            {index + 1}. {String(product)}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(data.revenue)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {formatNumber(data.quantity)} units • {formatNumber(data.transactions)} sales
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>

              {/* Cashier Performance */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Cashier Performance
                    </Typography>
                    {analytics?.topCashiers.map(([cashier, data]) => (
                      <Box key={String(cashier)} sx={{ mb: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight="medium">
                            {String(cashier)}
                          </Typography>
                          <Typography variant="body2" color="primary">
                            {formatCurrency(data.totalSales)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {formatNumber(data.transactions)} transactions • Avg: {formatCurrency(data.averageSale)}
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Sales Data Tab */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sales Transactions ({sales.length} total)
                    </Typography>
                    <Paper elevation={0} sx={{ maxHeight: 400, overflow: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Cashier</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell>Paid</TableCell>
                            <TableCell>Change</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Items</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sales.map((sale) => (
                            <TableRow key={sale.id} hover>
                              <TableCell>#{sale.id}</TableCell>
                              <TableCell>{sale.cashier}</TableCell>
                              <TableCell>{formatCurrency(Number(sale.total_amount) || 0)}</TableCell>
                              <TableCell>{formatCurrency(Number(sale.paid_amount) || 0)}</TableCell>
                              <TableCell>{formatCurrency(Number(sale.change_given) || 0)}</TableCell>
                              <TableCell>{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Chip 
                                  size="small" 
                                  label={sale.items?.length || 0} 
                                  variant="outlined" 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Product Analytics Tab */}
          {activeTab === 2 && <ProductAnalyticsTab />}

          {/* Performance Tab */}
          {activeTab === 3 && <PerformanceTab />}
        </>
      ) : (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">
            No data available for the selected period
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Try adjusting your date range or filters
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SalesReport;