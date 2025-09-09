import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Email as EmailIcon,
  Shield as ShieldIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';

const InviteUserDialog = ({ open, onClose, onInvite, billingStatus, tenantId }) => {
  const [formData, setFormData] = useState({
    email: '',
    role: 'user',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handlePurchaseLicense = async () => {
    setRedirectingToCheckout(true);
    try {
      const response = await axios.post(
        `/api/v1/billing/purchase-licenses`,
        { quantity: 1 }
      );
      
      if (response.data.success && response.data.data.url) {
        // Store the form data in sessionStorage to restore after redirect
        sessionStorage.setItem('pendingInvitation', JSON.stringify(formData));
        // Redirect to Stripe checkout
        window.location.href = response.data.data.url;
      }
    } catch (error) {
      console.error('Error purchasing license:', error);
      setError(error.response?.data?.message || 'Failed to create checkout session');
      setRedirectingToCheckout(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await onInvite(formData);
      handleClose();
    } catch (err) {
      // Check if error is due to no available licenses
      if (err.response?.data?.message?.includes('No available licenses')) {
        setError('');
        setLoading(false);
        // Don't close the dialog, show the purchase option
        return;
      }
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: '',
      role: 'user',
      message: '',
    });
    setError('');
    onClose();
  };

  const hasAvailableLicenses = billingStatus?.availableLicenses > 0;
  const requiresLicensePurchase = billingStatus?.plan === 'pro' && !hasAvailableLicenses;
  const showLicensePurchaseAlert = requiresLicensePurchase && !redirectingToCheckout && error?.includes('No available licenses');

  // Check if we're returning from Stripe and have pending invitation
  React.useEffect(() => {
    const pendingInvitation = sessionStorage.getItem('pendingInvitation');
    if (pendingInvitation && open) {
      const data = JSON.parse(pendingInvitation);
      setFormData(data);
      sessionStorage.removeItem('pendingInvitation');
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite Team Member</DialogTitle>
      <DialogContent>
        {/* Show license status for Pro accounts */}
        {billingStatus?.plan === 'pro' && (
          <Alert 
            severity={hasAvailableLicenses ? "success" : "warning"} 
            sx={{ mb: 3 }}
            icon={!hasAvailableLicenses && <WarningIcon />}
          >
            {hasAvailableLicenses 
              ? `You have ${billingStatus.availableLicenses} available license${billingStatus.availableLicenses !== 1 ? 's' : ''}`
              : "No licenses available. You need to purchase a license to invite team members."
            }
          </Alert>
        )}

        {/* Show license purchase option when no licenses available */}
        {showLicensePurchaseAlert && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={handlePurchaseLicense}
                disabled={redirectingToCheckout}
              >
                Purchase License
              </Button>
            }
          >
            No licenses available. Purchase a license to invite this team member.
          </Alert>
        )}

        {error && !error.includes('No available licenses') && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            fullWidth
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
            InputProps={{
              startAdornment: <EmailIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
            helperText="They'll receive an invitation to join your team"
          />

          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange}
              label="Role"
              disabled={loading}
            >
              <MenuItem value="admin">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldIcon sx={{ fontSize: 20, color: 'info.main' }} />
                  <Box>
                    <Typography variant="body1">Admin</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Can invite users, manage team, and access all content
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
              <MenuItem value="user">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body1">User</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Can manage their own content only
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Personal Message (Optional)"
            name="message"
            multiline
            rows={3}
            value={formData.message}
            onChange={handleChange}
            disabled={loading}
            helperText="Add a personal note to the invitation email"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || redirectingToCheckout}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || redirectingToCheckout}
          startIcon={(loading || redirectingToCheckout) && <CircularProgress size={20} />}
        >
          {redirectingToCheckout ? 'Redirecting to checkout...' : loading ? 'Sending...' : 'Send Invitation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteUserDialog;