import { Box, Typography, Button, Chip, Paper } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { TIER_LABELS } from '../context/StoreContext';

const WHATSAPP_NUMBER = '2348177007875';

const FEATURE_NAMES = {
  customer_loyalty:       'Customer Loyalty',
  audit_log:              'Audit Log',
  bulk_upload:            'Bulk Excel Upload',
  bulk_discounts:         'Bulk Discounts',
  whatsapp_notifications: 'WhatsApp Notifications',
  full_reports:           'Advanced Analytics',
  margin_analytics:       'Margin Analytics',
};

export default function UpgradePrompt({ feature, currentTier }) {
  const featureLabel  = FEATURE_NAMES[feature] || feature;
  const requiredTier  = feature === 'margin_analytics' ? 'BUSINESS' : 'GROWTH';
  const currentLabel  = TIER_LABELS[currentTier] || currentTier;
  const requiredLabel = TIER_LABELS[requiredTier] || requiredTier;

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi, I'd like to upgrade my HOLO POS plan from ${currentLabel} to ${requiredLabel} to access ${featureLabel}.`
  )}`;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 420,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          border: '2px dashed',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: 'warning.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <LockIcon sx={{ fontSize: 40, color: 'warning.dark' }} />
        </Box>

        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {featureLabel} is locked
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This feature is available on the{' '}
          <strong>{requiredLabel}</strong> plan and above.
          Your current plan is{' '}
          <strong>{currentLabel}</strong>.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 4, flexWrap: 'wrap' }}>
          <Chip label={`Current: ${currentLabel}`} color="default" variant="outlined" />
          <Chip label={`Required: ${requiredLabel}`} color="primary" variant="filled" icon={<UpgradeIcon />} />
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<WhatsAppIcon />}
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            bgcolor: '#25D366',
            '&:hover': { bgcolor: '#1ebe5b' },
            borderRadius: 2,
            fontWeight: 'bold',
            px: 4,
          }}
        >
          Upgrade via WhatsApp
        </Button>

        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 2 }}>
          +234 817 700 7875 · Mon–Sat 8am–6pm
        </Typography>
      </Paper>
    </Box>
  );
}
