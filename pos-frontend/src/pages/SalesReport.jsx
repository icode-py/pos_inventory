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
} from "@mui/material";
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

const SalesReport = () => {
  const [cashiers, setCashiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    cashier: "",
    product: "",
  });
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState([]);
  ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

  useEffect(() => {
    // Load dropdown options
    axiosInstance.get("staff/").then(res => setCashiers(res.data));
    axiosInstance.get("products/").then(res => setProducts(res.data));
  }, []);

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
    setSales(res.data.sales);
    setSummary(res.data.daily_summary);  // note: it's `daily_summary` in your response
  } catch (err) {
    console.error("Error fetching report", err);
  } finally {
    setLoading(false);
  }
};

  const exportItemizedCSV = () => {
  if (sales.length === 0) {
    alert("No sales data to export.");
    return;
  }

  // Flatten nested items if needed or just export summary sales
  const csvData = sales.flatMap(tx =>
    tx.items.map(item => ({
      transaction_id: tx.id,
      cashier: tx.cashier,
      created_at: tx.created_at,
      product_name: item.product.name,
      quantity: item.quantity,
      price_at_sale: item.price_at_sale,
      total: item.quantity * item.price_at_sale,
    }))
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
    total_amount: item.total_amount,
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `sales_summary_${new Date().toISOString().slice(0, 10)}.csv`);
};

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Sales Report
      </Typography>

      {/* Filter Form */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        <TextField
          label="Start Date"
          type="date"
          name="start_date"
          value={filters.start_date}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End Date"
          type="date"
          name="end_date"
          value={filters.end_date}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          label="Cashier"
          name="cashier"
          value={filters.cashier}
          onChange={handleChange}
          style={{ minWidth: 200 }}
        >
          <MenuItem value="">All</MenuItem>
          {cashiers.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.username}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Product"
          name="product"
          value={filters.product}
          onChange={handleChange}
          style={{ minWidth: 200 }}
        >
          <MenuItem value="">All</MenuItem>
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={fetchReport}>
          Run Report
        </Button>
        <Button variant="contained" color="primary" onClick={exportItemizedCSV}>
        Export Itemized CSV
        </Button>

        <Button variant="outlined" onClick={exportSummaryCSV}>
        Export Summary CSV
        </Button>
      </Box>

      {/* Report Results */}
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            Sales
          </Typography>
          <Paper elevation={3} style={{ maxHeight: 300, overflow: "auto", marginBottom: 20 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Cashier</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.id}</TableCell>
                    <TableCell>{sale.cashier}</TableCell>
                    <TableCell>₦{sale.total_amount}</TableCell>
                    <TableCell>₦{sale.paid_amount}</TableCell>
                    <TableCell>₦{sale.change_given}</TableCell>
                    <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Typography variant="h6" gutterBottom>
            Daily Summary
          </Typography>
    <Box mt={4}>
      <Typography variant="h6" gutterBottom>
        Daily Sales Chart
      </Typography>
      <Bar
        data={{
          labels: summary.map((item) => item.day),
          datasets: [
            {
              label: "Total Sales (₦)",
              data: summary.map((item) => item.total_amount),
              backgroundColor: "#1976d2",
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: "top",
            },
            title: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        }}
      />
    </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Total Sales</TableCell>
                <TableCell>Transactions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
             {summary.map((item, index) => (
              <TableRow key={item.day || index}>
                <TableCell>{item.day}</TableCell>
                <TableCell>₦{item.total_amount}</TableCell>
                <TableCell>{item.total_sales}</TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
};

export default SalesReport;