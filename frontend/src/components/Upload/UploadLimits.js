import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Storage as StorageIcon,
  Star as ProIcon,
} from '@mui/icons-material';

const UploadLimits = ({ limits, loading, accountType, onUpgradeClick }) => {
  // Handle loading state
  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Loading account limits...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Handle case where data hasn't loaded yet
  if (!limits) {
    return null;
  }

  // Pro accounts - show unlimited status
  // Prefer accountType prop over limits.accountType for reliability
  const isProAccount = accountType === 'pro' || (limits && limits.accountType === 'pro');
  
  if (isProAccount) {
    return (
      <Card sx={{ mb: 3, border: '2px solid', borderColor: 'success.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ProIcon sx={{ mr: 1, color: 'success.main' }} />
            <Typography variant="h6" color="success.main">
              Pro Account
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Unlimited uploads and storage
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Handle case where limits.limits is missing for free accounts
  if (!limits.limits) {
    return null; // Don't show anything if no data
  }

  const { processes, storage } = limits.limits;
  const isNearProcessLimit = processes?.remaining <= 2;
  const isNearStorageLimit = storage?.usagePercentage >= 80;
  const hasAnyLimits = isNearProcessLimit || isNearStorageLimit;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Free Account Limits
          </Typography>
          <Chip 
            label="Free" 
            size="small" 
            variant="outlined"
          />
        </Box>

        {hasAnyLimits && (
          <Alert 
            severity={isNearProcessLimit && processes.remaining === 0 ? "error" : "warning"} 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={onUpgradeClick}
                startIcon={<ProIcon />}
              >
                Upgrade to Pro
              </Button>
            }
          >
            {processes?.remaining === 0 
              ? "Upload limit reached! Upgrade to Pro for unlimited uploads."
              : storage?.usagePercentage >= 90
                ? "Storage nearly full! Upgrade to Pro for unlimited storage."
                : "Approaching account limits. Consider upgrading to Pro."
            }
          </Alert>
        )}

        {/* Process Limits */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <UploadIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                Monthly Uploads
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {processes?.current || 0} / {processes?.max || 10}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={((processes?.current || 0) / (processes?.max || 10)) * 100}
            sx={{ 
              height: 8, 
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                backgroundColor: (processes?.remaining || 0) <= 2 ? 'error.main' : 'primary.main'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {processes?.remaining || 0} uploads remaining this month
          </Typography>
        </Box>

        {/* Storage Limits */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <StorageIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                Storage Used
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {storage?.currentGB || 0}GB / {storage?.maxGB || 20}GB
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={storage?.usagePercentage || 0}
            sx={{ 
              height: 8, 
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                backgroundColor: (storage?.usagePercentage || 0) >= 80 ? 'warning.main' : 'primary.main'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {storage?.remainingGB || 20}GB remaining
          </Typography>
        </Box>

        {/* Upgrade Section */}
        <Box sx={{ 
          mt: 3, 
          pt: 3, 
          borderTop: '1px solid', 
          borderColor: 'divider',
          textAlign: 'center' 
        }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Need more space or uploads?
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={onUpgradeClick}
            startIcon={<ProIcon />}
            size="small"
          >
            Upgrade to Pro
          </Button>
          <Box component="span" display="block" sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Unlimited uploads & storage starting at €10/month
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UploadLimits;