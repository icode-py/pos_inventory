import React from 'react';
import { Button, Snackbar, Alert, Box, Typography } from '@mui/material';
import { CloudUpload, CloudDone, CloudOff } from '@mui/icons-material';
import { useOffline } from '../context/OfflineManager';

const SyncManager = () => {
  const { isOnline, pendingSales, syncPendingSales } = useOffline();
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'info' });

  const handleSync = async () => {
    if (!isOnline) {
      setSnackbar({ open: true, message: 'No internet connection', severity: 'warning' });
      return;
    }

    try {
      const syncedCount = await syncPendingSales();
      if (syncedCount > 0) {
        setSnackbar({ open: true, message: `✅ Synced ${syncedCount} sales`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'No pending sales to sync', severity: 'info' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: '❌ Sync failed', severity: 'error' });
    }
  };

  if (pendingSales.length === 0) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <Button
        variant="contained"
        color="warning"
        startIcon={isOnline ? <CloudUpload /> : <CloudOff />}
        onClick={handleSync}
        disabled={!isOnline}
        sx={{
          boxShadow: 3,
          borderRadius: 2,
          px: 2,
          py: 1
        }}
      >
        Sync {pendingSales.length} Offline {pendingSales.length === 1 ? 'Sale' : 'Sales'}
      </Button>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SyncManager;