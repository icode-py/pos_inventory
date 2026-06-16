import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Chip, TextField, MenuItem,
  FormControl, InputLabel, Select, Grid, CircularProgress, Alert,
  Tooltip, IconButton, Collapse
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  History as AuditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

const ACTION_COLORS = { CREATE: 'success', UPDATE: 'info', DELETE: 'error' };
const ACTION_ICONS = { CREATE: <AddIcon fontSize="small" />, UPDATE: <EditIcon fontSize="small" />, DELETE: <DeleteIcon fontSize="small" /> };

const MODEL_OPTIONS = ['Product', 'Category', 'Customer'];

function ChangeDetails({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return null;
  if (changes.source === 'bulk_upload') return <Chip label="Bulk Upload" size="small" variant="outlined" />;
  return (
    <Box sx={{ mt: 0.5 }}>
      {Object.entries(changes).map(([field, val]) => (
        <Box key={field} sx={{ display: 'flex', gap: 1, fontSize: '0.75rem', mb: 0.5 }}>
          <Typography variant="caption" fontWeight="bold">{field}:</Typography>
          <Typography variant="caption" color="error.main" sx={{ textDecoration: 'line-through' }}>{val.from}</Typography>
          <Typography variant="caption">→</Typography>
          <Typography variant="caption" color="success.main">{val.to}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function AuditRow({ log }) {
  const [open, setOpen] = useState(false);
  const hasChanges = log.changes && Object.keys(log.changes).length > 0;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {new Date(log.timestamp).toLocaleString('en-NG')}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            icon={ACTION_ICONS[log.action]}
            label={log.action}
            color={ACTION_COLORS[log.action]}
            size="small"
          />
        </TableCell>
        <TableCell>
          <Chip label={log.model_name} size="small" variant="outlined" />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{log.object_repr}</Typography>
          <Typography variant="caption" color="text.secondary">ID: {log.object_id}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{log.changed_by_username || '—'}</Typography>
        </TableCell>
        <TableCell align="center">
          {hasChanges ? (
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          ) : (
            <Typography variant="caption" color="text.disabled">—</Typography>
          )}
        </TableCell>
      </TableRow>
      {hasChanges && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, bgcolor: 'action.hover' }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ px: 3, py: 1.5 }}>
                <ChangeDetails changes={log.changes} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ action: '', model: '', user_id: '' });
  const [staff, setStaff] = useState([]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.model) params.model = filters.model;
      if (filters.user_id) params.user_id = filters.user_id;
      const res = await axiosInstance.get('audit-log/', { params });
      setLogs(res.data.results || res.data);
    } catch {
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axiosInstance.get('staff/').then(r => setStaff(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(); }, [filters]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AuditIcon /> Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track all create, update and delete actions across your inventory
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchLogs}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} label="Action">
                  <MenuItem value="">All Actions</MenuItem>
                  <MenuItem value="CREATE">Create</MenuItem>
                  <MenuItem value="UPDATE">Update</MenuItem>
                  <MenuItem value="DELETE">Delete</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Model</InputLabel>
                <Select value={filters.model} onChange={e => setFilters(f => ({ ...f, model: e.target.value }))} label="Model">
                  <MenuItem value="">All Models</MenuItem>
                  {MODEL_OPTIONS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>User</InputLabel>
                <Select value={filters.user_id} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))} label="User">
                  <MenuItem value="">All Users</MenuItem>
                  {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.username}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Timestamp</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Action</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Model</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Object</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Changed By</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No audit records found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => <AuditRow key={log.id} log={log} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
