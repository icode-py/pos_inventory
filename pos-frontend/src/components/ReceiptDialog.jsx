import React, { useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShareIcon from '@mui/icons-material/Share';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PrintIcon from '@mui/icons-material/Print';
import { useReactToPrint } from 'react-to-print';
import Receipt from './Receipt';
import { buildReceiptText, toWhatsAppNumber } from '../utils/receiptText';

/**
 * Shown after a sale on touch devices. Phones block automatic printing, so the cashier
 * chooses: share the receipt, send it to the customer on WhatsApp, or print / save as PDF.
 */
const ReceiptDialog = ({ open, onClose, sale, store }) => {
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: '@page { size: 80mm auto; margin: 0; } @media print { body { margin: 0 !important; } }',
  });

  if (!sale) return null;

  const text = buildReceiptText(sale, store);
  const customerNumber = toWhatsAppNumber(sale.customer?.phone);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleShare = async () => {
    try {
      await navigator.share({ title: store?.name || 'Receipt', text });
    } catch (err) {
      // AbortError = the cashier closed the share sheet; nothing to do
      if (err?.name !== 'AbortError') console.warn('Share failed:', err);
    }
  };

  const openWhatsApp = (number) => {
    const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="success" />
        Sale complete
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', bgcolor: '#fff', boxShadow: 1 }}>
            <Receipt ref={printRef} sale={sale} store={store} />
          </Box>
        </Box>
        {sale.change_given > 0 && (
          <Typography align="center" variant="h6" sx={{ mt: 2 }}>
            Change: ₦{Number(sale.change_given).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Stack spacing={1} sx={{ width: '100%' }}>
          {customerNumber && (
            <Button variant="contained" color="success" startIcon={<WhatsAppIcon />} onClick={() => openWhatsApp(customerNumber)}>
              Send to {sale.customer?.name?.split(' ')[0] || 'customer'} on WhatsApp
            </Button>
          )}
          {canShare ? (
            <Button variant="outlined" startIcon={<ShareIcon />} onClick={handleShare}>
              Share receipt
            </Button>
          ) : (
            <Button variant="outlined" startIcon={<WhatsAppIcon />} onClick={() => openWhatsApp('')}>
              Share on WhatsApp
            </Button>
          )}
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print / Save as PDF
          </Button>
          <Button variant="contained" onClick={onClose}>New sale</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default ReceiptDialog;
