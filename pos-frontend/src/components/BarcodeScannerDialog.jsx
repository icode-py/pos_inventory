import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Button, CircularProgress,
  useTheme, useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Ignore the same code for this long so one item held in front of the camera isn't added repeatedly.
const REPEAT_COOLDOWN_MS = 1500;

/**
 * Camera barcode scanner. Stays open and calls onDetected(code) for every new barcode,
 * so a cashier can scan several items in a row. The zxing library is loaded only when opened.
 * Camera access needs HTTPS (or localhost).
 */
const BarcodeScannerDialog = ({ open, onClose, onDetected, title = 'Scan barcode', lastResult }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    if (!open) return undefined;

    let controls = null;
    let cancelled = false;
    let lastCode = '';
    let lastTime = 0;

    setStatus('starting');
    setErrorMessage('');

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMessage('Camera is not available. Open the app over HTTPS in a browser that supports camera access.');
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelled) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };

        controls = await reader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result) return;
          const code = result.getText();
          const now = Date.now();
          if (code === lastCode && now - lastTime < REPEAT_COOLDOWN_MS) return;
          lastCode = code;
          lastTime = now;
          if (navigator.vibrate) navigator.vibrate(60);
          onDetectedRef.current?.(code);
        });

        if (cancelled) {
          controls.stop();
          return;
        }
        setStatus('scanning');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setErrorMessage('Camera permission was denied. Allow camera access for this site in your browser settings, then try again.');
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setErrorMessage('No camera was found on this device.');
        } else {
          setErrorMessage('Could not start the camera. Close other apps using it and try again.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (controls) controls.stop();
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {title}
        <IconButton onClick={onClose} aria-label="Close scanner"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <Box
          sx={{
            position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: '60vh',
            bgcolor: 'black', borderRadius: 2, overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {status === 'scanning' && (
            <Box
              sx={{
                position: 'absolute', top: '50%', left: '8%', right: '8%', height: 2,
                bgcolor: 'error.main', opacity: 0.8, boxShadow: '0 0 8px rgba(244,67,54,0.9)',
              }}
            />
          )}
          {status === 'starting' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: 'white' }} />
            </Box>
          )}
        </Box>

        {status === 'error' ? (
          <Typography color="error" align="center">{errorMessage}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center">
            Point the camera at a barcode. Keep scanning — items are added automatically.
          </Typography>
        )}

        {lastResult && (
          <Typography variant="subtitle2" align="center" aria-live="polite">{lastResult}</Typography>
        )}

        <Button variant="contained" onClick={onClose} fullWidth>Done</Button>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;
