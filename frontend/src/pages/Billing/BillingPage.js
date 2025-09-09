import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Check as CheckIcon,
  Star as ProIcon,
  CloudUpload as UploadIcon,
  Storage as StorageIcon,
  People as TeamIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import api, { billingAPI, teamAPI } from '../../services/api';
import BillingStatus from '../../components/Team/BillingStatus';
import PlanOverviewCard from '../../components/Billing/PlanOverviewCard';
import PlanComparison from '../../components/Billing/PlanComparison';
import LicenseManager from '../../components/Billing/LicenseManager';
import InvoiceHistory from '../../components/Billing/InvoiceHistory';
import { useNavigate } from 'react-router-dom';

const BillingPage = () => {
  const { user, tenant } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [billingStatus, setBillingStatus] = useState(null);
  const [limits, setLimits] = useState(null);
  const [usageLimits, setUsageLimits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      loadBillingData();
      if (user?.accountType === 'free') {
        loadUsageLimits();
      }
    }
  }, [tenant?.id, user?.accountType]);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const response = await billingAPI.getSubscriptionStatus(tenant.id);
      setBillingStatus(response.data.data);
    } catch (error) {
      console.error('Error loading billing data:', error);
      showNotification('Failed to load billing information', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadUsageLimits = async () => {
    try {
      const response = await api.get('/limits/user-limits');
      setUsageLimits(response.data.data.limits);
    } catch (error) {
      console.error('Error loading usage limits:', error);
    }
  };

  const handleUpgradeClick = async () => {
    try {
      if (!tenant?.id) {
        showNotification('Tenant information not available. Please try refreshing the page.', 'error');
        return;
      }

      showNotification('Preparing checkout session...', 'info');
      
      const response = await billingAPI.createCheckoutSession(tenant.id);
      
      if (!response.data.success || !response.data.data?.url) {
        throw new Error('Invalid response from checkout session creation');
      }
      
      const { url } = response.data.data;
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to start checkout process. Please try again.';
      
      showNotification(errorMessage, 'error');
    }
  };

  const handleCancelPro = async () => {
    setCancelling(true);
    try {
      await billingAPI.cancelProMembership(tenant.id);
      
      showNotification('Pro membership cancelled successfully', 'success');
      setCancelDialogOpen(false);
      
      // Reload page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error cancelling pro membership:', error);
      showNotification(
        error.response?.data?.message || 'Failed to cancel Pro membership',
        'error'
      );
    } finally {
      setCancelling(false);
    }
  };

  const freeFeatures = [
    { text: '1 team member (yourself)', icon: <TeamIcon /> },
    { text: '10 uploads per month', icon: <UploadIcon /> },
    { text: '20GB storage limit', icon: <StorageIcon /> },
    { text: 'Standard processing speed', icon: <SpeedIcon /> },
  ];

  const proFeatures = [
    { text: 'Unlimited team members', icon: <TeamIcon /> },
    { text: 'Unlimited uploads', icon: <UploadIcon /> },
    { text: 'Unlimited storage', icon: <StorageIcon /> },
    { text: 'Priority processing', icon: <SpeedIcon /> },
    { text: 'Advanced analytics', icon: <CheckIcon /> },
    { text: 'Team collaboration features', icon: <CheckIcon /> },
    { text: 'Priority support', icon: <CheckIcon /> },
  ];

  const isFreePlan = user?.accountType === 'free';
  const isProPlan = user?.accountType === 'pro';

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Show Pro user billing page
  if (isProPlan && billingStatus) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* 1. Plan Overview Card (always at top) */}
        <PlanOverviewCard 
          user={user} 
          billingStatus={billingStatus} 
          usageLimits={usageLimits}
        />
        
        {/* 3. Billing Management (PRO plan only) */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Billing Management
          </Typography>
          <LicenseManager 
            billingStatus={billingStatus} 
            tenantId={tenant?.id}
            onUpdate={loadBillingData}
          />
        </Box>
        
        {/* 4. Team Management (PRO plan only) */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Team Management
          </Typography>
          <BillingStatus
            billingStatus={billingStatus}
            limits={limits}
            tenantId={tenant?.id}
          />
        </Box>
        
        {/* 5. Invoice History (PRO plan only) */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Invoice History
          </Typography>
          <InvoiceHistory tenantId={tenant?.id} />
        </Box>

        {/* 6. Danger Zone (PRO plan only) */}
        <Paper sx={{ p: 3, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
          <Typography variant="h6" gutterBottom color="error">
            Danger Zone
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cancelling your Pro membership will immediately disable team features and apply Free plan limits.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setCancelDialogOpen(true)}
            startIcon={<CloseIcon />}
          >
            Cancel Pro Membership
          </Button>
        </Paper>

        {/* Cancel Pro Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm">
          <DialogTitle sx={{ color: 'error.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon />
              Warning: Cancel Pro Membership
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              This action will have immediate effects on your entire organization!
            </Alert>
            
            <Typography variant="subtitle2" gutterBottom>
              This will:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CloseIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Disable ALL team members except the owner"
                  secondary="Team members will be locked out and cannot login"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CloseIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Remove team collaboration features"
                  secondary="No more team management or invitations"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CloseIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Apply Free plan limits"
                  secondary="20GB storage limit and 10 uploads per month"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="All existing processes remain accessible"
                  secondary="Your data is safe and will not be deleted"
                />
              </ListItem>
            </List>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              You can upgrade back to Pro at any time to restore team access.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>
              Keep Pro
            </Button>
            <Button 
              onClick={handleCancelPro} 
              color="error" 
              variant="contained"
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  }

  // Show Free user billing page
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 1. Plan Overview Card (always at top) */}
      <PlanOverviewCard 
        user={user} 
        billingStatus={billingStatus} 
        usageLimits={usageLimits}
      />
      
      {/* 2. Plan Comparison Section (FREE plan only) */}
      <PlanComparison 
        currentPlan="free" 
        onUpgrade={handleUpgradeClick}
        tenantId={tenant?.id}
      />
    </Container>
  );
};

export default BillingPage;