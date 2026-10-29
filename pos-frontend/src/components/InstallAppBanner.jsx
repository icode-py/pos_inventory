import React, { useEffect, useState } from 'react';
import { Box, Button, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';

const DISMISS_KEY = 'install-banner-dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac

const isAndroid = () => /android/i.test(navigator.userAgent);

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

/**
 * Prompts people to install the app. Chrome/Edge expose a real install prompt; iPhone Safari never
 * does, so there we show Add-to-Home-Screen steps. Hidden once installed or dismissed.
 */
const InstallAppBanner = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [installed, setInstalled] = useState(isStandalone);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = isIos();
  const android = isAndroid();
  // Show where we can actually help: a real install prompt, or the phones that need manual steps.
  const canShow = installEvent || ios || android;
  if (installed || dismissed || !canShow) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
  };

  const handleInstall = async () => {
    if (installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      setInstallEvent(null);
      if (outcome === 'accepted') setInstalled(true);
    } else {
      setHelpOpen(true);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
          bgcolor: 'primary.main', color: 'primary.contrastText',
        }}
      >
        <GetAppIcon fontSize="small" />
        <Typography variant="body2" sx={{ flex: 1 }}>
          Install this app on your phone for faster checkout.
        </Typography>
        <Button size="small" variant="contained" color="inherit" onClick={handleInstall} sx={{ color: 'primary.main' }}>
          Install
        </Button>
        <IconButton size="small" onClick={dismiss} aria-label="Dismiss" sx={{ color: 'inherit' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Install on your {ios ? 'iPhone' : 'phone'}</DialogTitle>
        <DialogContent>
          {ios ? (
            <Typography component="ol" sx={{ pl: 2.5, m: 0 }}>
              <li>Open this site in <b>Safari</b> (not inside another app).</li>
              <li>Tap the <b>Share</b> button (square with an arrow) at the bottom of the screen.</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              <li>Open the app from your home screen.</li>
            </Typography>
          ) : (
            <Typography component="ol" sx={{ pl: 2.5, m: 0 }}>
              <li>Open this site in <b>Chrome</b>.</li>
              <li>Tap the <b>⋮</b> menu at the top right.</li>
              <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
              <li>Open the app from your home screen.</li>
            </Typography>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setHelpOpen(false)}>Got it</Button></DialogActions>
      </Dialog>
    </>
  );
};

export default InstallAppBanner;
