import { useState, useEffect, useContext } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, Tooltip, Snackbar,
  InputAdornment, Switch, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ManageAccounts as ManageAccountsIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import axiosInstance from '../utils/axiosInstance';

function getRoleInfo(member) {
  if (member.is_admin)   return { label: 'Admin',   color: 'error' };
  if (member.is_manager) return { label: 'Manager', color: 'warning' };
  if (member.is_cashier) return { label: 'Cashier', color: 'primary' };
  return { label: 'Staff', color: 'default' };
}

function roleToFlags(role) {
  return { is_cashier: role === 'cashier', is_manager: role === 'manager' };
}

function flagsToRole(member) {
  if (member.is_manager) return 'manager';
  if (member.is_cashier) return 'cashier';
  return 'staff';
}

const EMPTY_ADD = { username: '', password: '', confirm_password: '', role: 'cashier' };
const EMPTY_PW  = { new_password: '', confirm_password: '' };

export default function StaffPage() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [staff,   setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  // Add dialog
  const [addOpen,  setAddOpen]  = useState(false);
  const [addForm,  setAddForm]  = useState(EMPTY_ADD);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit dialog
  const [editOpen,   setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editRole,   setEditRole]   = useState('cashier');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState('');

  // Reset password dialog
  const [pwOpen,   setPwOpen]   = useState(false);
  const [pwTarget, setPwTarget] = useState(null);
  const [pwForm,   setPwForm]   = useState(EMPTY_PW);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');

  // Delete dialog
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/staff/');
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSnack({ open: true, message: 'Failed to load staff', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const filtered = staff.filter(s =>
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  const showSnack = (message, severity = 'success') =>
    setSnack({ open: true, message, severity });

  const canEdit = (member) =>
    !member.is_admin && member.id !== user?.user_id;

  // ── Add Staff ──
  const handleAdd = async () => {
    setAddSaving(true);
    setAddError('');
    try {
      await axiosInstance.post('/register-staff/', {
        username: addForm.username,
        password: addForm.password,
        confirm_password: addForm.confirm_password,
        ...roleToFlags(addForm.role),
      });
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
      showSnack(`${addForm.username} added successfully`);
      fetchStaff();
    } catch (err) {
      const d = err.response?.data;
      setAddError(d ? Object.values(d).flat().join(' ') : 'Failed to add staff');
    } finally {
      setAddSaving(false);
    }
  };

  const addValid =
    addForm.username.length >= 3 &&
    addForm.password.length >= 6 &&
    addForm.password === addForm.confirm_password;

  // ── Edit Role / Status ──
  const openEdit = (member) => {
    setEditTarget(member);
    setEditRole(flagsToRole(member));
    setEditActive(member.is_active);
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const res = await axiosInstance.patch(`/staff/${editTarget.id}/update/`, {
        ...roleToFlags(editRole),
        is_active: editActive,
      });
      setEditOpen(false);
      setStaff(prev => prev.map(s => s.id === editTarget.id ? res.data : s));
      showSnack(`${editTarget.username} updated`);
    } catch (err) {
      const d = err.response?.data;
      setEditError(d?.error || Object.values(d || {}).flat().join(' ') || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Reset Password ──
  const openPw = (member) => {
    setPwTarget(member);
    setPwForm(EMPTY_PW);
    setPwError('');
    setPwOpen(true);
  };

  const handlePw = async () => {
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("Passwords don't match");
      return;
    }
    setPwSaving(true);
    setPwError('');
    try {
      await axiosInstance.post(`/staff/${pwTarget.id}/reset-password/`, {
        new_password: pwForm.new_password,
      });
      setPwOpen(false);
      showSnack(`Password reset for ${pwTarget.username}`);
    } catch (err) {
      const d = err.response?.data;
      setPwError(d?.error || 'Failed to reset password');
    } finally {
      setPwSaving(false);
    }
  };

  const pwValid =
    pwForm.new_password.length >= 6 &&
    pwForm.new_password === pwForm.confirm_password;

  // ── Delete Staff ──
  const openDelete = (member) => {
    setDeleteTarget(member);
    setDeleteError('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    setDeleteSaving(true);
    setDeleteError('');
    try {
      await axiosInstance.delete(`/staff/${deleteTarget.id}/delete/`);
      setDeleteOpen(false);
      setStaff(prev => prev.filter(s => s.id !== deleteTarget.id));
      showSnack(`${deleteTarget.username} deleted`);
    } catch (err) {
      const d = err.response?.data;
      setDeleteError(d?.error || 'Failed to delete staff account');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ManageAccountsIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">Staff Management</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setAddForm(EMPTY_ADD); setAddError(''); setAddOpen(true); }}
        >
          Add Staff
        </Button>
      </Box>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          placeholder="Search by username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon /></InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold', bgcolor: 'action.hover' } }}>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Status</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {search ? 'No staff match your search' : 'No staff accounts yet'}
                </TableCell>
              </TableRow>
            ) : filtered.map(member => {
              const role = getRoleInfo(member);
              const editable = canEdit(member);
              const isMe = member.id === user?.user_id;
              return (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Typography fontWeight={isMe ? 'bold' : 'normal'}>
                      {member.username}
                      {isMe && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          (you)
                        </Typography>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={role.label} color={role.color} size="small" />
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Chip
                      label={member.is_active ? 'Active' : 'Inactive'}
                      color={member.is_active ? 'success' : 'default'}
                      size="small"
                      variant={member.is_active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {member.date_joined
                      ? new Date(member.date_joined).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {editable ? (
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit role / status">
                          <IconButton size="small" color="primary" onClick={() => openEdit(member)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset password">
                          <IconButton size="small" color="warning" onClick={() => openPw(member)}>
                            <LockIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete account">
                          <IconButton size="small" color="error" onClick={() => openDelete(member)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Add Staff Dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon color="primary" />
            <span>Add Staff Account</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {addError && <Alert severity="error">{addError}</Alert>}
          <TextField
            label="Username"
            value={addForm.username}
            onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))}
            fullWidth
            required
            helperText="Min 3 chars — letters, numbers, underscores"
            autoFocus
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={addForm.role}
              label="Role"
              onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
            >
              <MenuItem value="cashier">Cashier</MenuItem>
              {isAdmin && <MenuItem value="manager">Manager</MenuItem>}
            </Select>
          </FormControl>
          <TextField
            label="Password"
            type="password"
            value={addForm.password}
            onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
            fullWidth
            required
            helperText="Min 6 characters"
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={addForm.confirm_password}
            onChange={e => setAddForm(p => ({ ...p, confirm_password: e.target.value }))}
            fullWidth
            required
            error={addForm.confirm_password !== '' && addForm.password !== addForm.confirm_password}
            helperText={
              addForm.confirm_password !== '' && addForm.password !== addForm.confirm_password
                ? "Passwords don't match"
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={addSaving || !addValid}
            startIcon={addSaving ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
          >
            {addSaving ? 'Adding...' : 'Add Staff'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Role / Status Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit — {editTarget?.username}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {editError && <Alert severity="error">{editError}</Alert>}
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={editRole} label="Role" onChange={e => setEditRole(e.target.value)}>
              <MenuItem value="cashier">Cashier</MenuItem>
              {isAdmin && <MenuItem value="manager">Manager</MenuItem>}
              <MenuItem value="staff">Staff (no specific role)</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={editActive}
                onChange={e => setEditActive(e.target.checked)}
                color="success"
              />
            }
            label={editActive ? 'Account Active' : 'Account Inactive (cannot login)'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEdit}
            disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password — {pwTarget?.username}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pwError && <Alert severity="error">{pwError}</Alert>}
          <TextField
            label="New Password"
            type="password"
            value={pwForm.new_password}
            onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
            fullWidth
            required
            helperText="Min 6 characters"
            autoFocus
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={pwForm.confirm_password}
            onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
            fullWidth
            required
            error={pwForm.confirm_password !== '' && pwForm.new_password !== pwForm.confirm_password}
            helperText={
              pwForm.confirm_password !== '' && pwForm.new_password !== pwForm.confirm_password
                ? "Passwords don't match"
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handlePw}
            disabled={pwSaving || !pwValid}
            startIcon={pwSaving ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
          >
            {pwSaving ? 'Resetting...' : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete — {deleteTarget?.username}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {deleteError && <Alert severity="error">{deleteError}</Alert>}
          <Alert severity="warning">
            This will permanently remove <strong>{deleteTarget?.username}</strong>'s account.
            This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteSaving}
            startIcon={deleteSaving ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deleteSaving ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
