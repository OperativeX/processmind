import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Typography
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingUp as UpgradeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const UsageAlert = ({ type, data, onClose }) => {
  const navigate = useNavigate();

  if (!data) return null;

  const {
    percentage = 0,
    uploadsUsed = 0,
    uploadLimit = 10,
    storageUsedGB = 0,
    storageLimit = 20
  } = data;

  // Don't show alert if below threshold
  if (percentage < 80) return null;

  const isUploadAlert = type === 'upload';
  const remaining = isUploadAlert 
    ? uploadLimit - uploadsUsed
    : Math.round((storageLimit - storageUsedGB) * 10) / 10;

  const handleUpgrade = () => {
    navigate('/settings/billing');
  };

  return (
    <Alert 
      severity="warning" 
      onClose={onClose}
      icon={<WarningIcon />}
      action={
        <Button 
          color="warning" 
          size="small"
          variant="outlined"
          startIcon={<UpgradeIcon />}
          onClick={handleUpgrade}
        >
          Upgrade to Pro
        </Button>
      }
      sx={{ mb: 2 }}
    >
      <AlertTitle>
        {isUploadAlert ? 'Upload Limit Approaching' : 'Storage Limit Approaching'}
      </AlertTitle>
      
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2">
          {isUploadAlert 
            ? `You've used ${uploadsUsed} of your ${uploadLimit} monthly uploads`
            : `You've used ${storageUsedGB}GB of your ${storageLimit}GB storage`
          }
          {' '}({percentage}%)
        </Typography>
        
        {percentage >= 90 && (
          <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
            Only {remaining} {isUploadAlert ? 'uploads' : 'GB'} remaining!
          </Typography>
        )}
      </Box>

      <LinearProgress 
        variant="determinate" 
        value={percentage} 
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            backgroundColor: percentage >= 90 ? 'error.main' : 'warning.main'
          }
        }}
      />

      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
        Upgrade to Pro for unlimited {isUploadAlert ? 'uploads' : 'storage'}
      </Typography>
    </Alert>
  );
};

export default UsageAlert;