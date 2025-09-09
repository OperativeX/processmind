import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Grid,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Storage as StorageIcon,
  People as TeamIcon,
  CalendarMonth as CalendarIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const PlanOverviewCard = ({ user, billingStatus, usageLimits }) => {
  const isFreePlan = user?.accountType === 'free';
  const isProPlan = user?.accountType === 'pro';
  
  // Calculate usage percentages
  const uploadPercentage = isFreePlan && usageLimits 
    ? Math.round((usageLimits.processes.current / usageLimits.processes.max) * 100)
    : 0;
    
  const storagePercentage = isFreePlan && usageLimits
    ? usageLimits.storage.usagePercentage || 0
    : 0;

  // Format dates
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Get next billing date
  const nextBillingDate = billingStatus?.nextBillingDate || billingStatus?.currentPeriodEnd;

  return (
    <Card sx={{ mb: 3, position: 'relative', overflow: 'visible' }}>
      {/* Plan Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: -12,
          right: 20,
          backgroundColor: isProPlan ? 'success.main' : 'primary.main',
          color: 'white',
          px: 3,
          py: 1,
          borderRadius: 2,
          boxShadow: 2,
          fontWeight: 'bold',
          fontSize: '0.9rem'
        }}
      >
        {isProPlan ? 'PRO PLAN' : 'FREE PLAN'}
      </Box>

      <CardContent sx={{ pt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Plan Overview
        </Typography>

        {/* Usage Progress Bars - Only for Free Plan */}
        {isFreePlan && usageLimits && (
          <Box sx={{ mb: 3 }}>
            {/* Upload Usage */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <UploadIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Monthly Uploads
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {usageLimits.processes.current} / {usageLimits.processes.max}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={uploadPercentage} 
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: uploadPercentage >= 80 ? 'warning.main' : 'primary.main'
                  }
                }}
              />
              {uploadPercentage >= 80 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                  {uploadPercentage}% used - Upgrade to Pro for unlimited uploads
                </Typography>
              )}
            </Box>

            {/* Storage Usage */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StorageIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Storage Used
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {usageLimits.storage.currentGB}GB / {usageLimits.storage.maxGB}GB
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={storagePercentage} 
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: storagePercentage >= 80 ? 'warning.main' : 'primary.main'
                  }
                }}
              />
              {storagePercentage >= 80 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                  {storagePercentage}% used - Upgrade to Pro for unlimited storage
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Quick Stats */}
        <Grid container spacing={2}>
          {/* Team Size - Pro Plan Only */}
          {isProPlan && billingStatus && (
            <Grid item xs={12} sm={4}>
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'action.hover', 
                borderRadius: 1,
                textAlign: 'center'
              }}>
                <TeamIcon sx={{ mb: 1, color: 'text.secondary' }} />
                <Typography variant="h6" fontWeight="bold">
                  {billingStatus.activeTeamMembers || 1}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Team Members
                </Typography>
                {billingStatus.availableLicenses > 0 && (
                  <Chip 
                    label={`${billingStatus.availableLicenses} licenses available`}
                    size="small"
                    color="success"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            </Grid>
          )}

          {/* Monthly Cost - Pro Plan Only */}
          {isProPlan && billingStatus && (
            <Grid item xs={12} sm={4}>
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'action.hover', 
                borderRadius: 1,
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary">
                  Monthly Cost
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  €{billingStatus.currentMonthlyPrice || 0}
                  <Tooltip title={`€${billingStatus.pricePerLicense} per license × ${billingStatus.purchasedLicenses} licenses`}>
                    <IconButton size="small" sx={{ ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  €{billingStatus.yearlyPrice || 0} per year
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Next Billing Date */}
          <Grid item xs={12} sm={isProPlan ? 4 : 12}>
            <Box sx={{ 
              p: 2, 
              backgroundColor: 'action.hover', 
              borderRadius: 1,
              textAlign: 'center'
            }}>
              <CalendarIcon sx={{ mb: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {isProPlan ? 'Next Billing' : 'Usage Resets'}
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {isFreePlan && usageLimits
                  ? formatDate(usageLimits.processes.resetDate)
                  : formatDate(nextBillingDate)
                }
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Pending Invitations Warning - Pro Plan Only */}
        {isProPlan && billingStatus?.pendingInvitations > 0 && (
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            backgroundColor: 'warning.light', 
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <InfoIcon sx={{ mr: 1, color: 'warning.dark' }} />
            <Typography variant="body2">
              You have {billingStatus.pendingInvitations} pending invitation{billingStatus.pendingInvitations > 1 ? 's' : ''}.
              {billingStatus.availableLicenses === 0 && ' Purchase more licenses to add team members.'}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanOverviewCard;