import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
  People as TeamIcon,
  ShoppingCart as PurchaseIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { billingAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

const LicenseManager = ({ billingStatus, tenantId, onUpdate }) => {
  const { showNotification } = useNotification();
  const [addLicenseDialog, setAddLicenseDialog] = useState(false);
  const [reduceLicenseDialog, setReduceLicenseDialog] = useState(false);
  const [licenseQuantity, setLicenseQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const {
    purchasedLicenses = 1,
    activeTeamMembers = 1,
    availableLicenses = 0,
    pricePerLicense = 10,
    monthlyLicenseCost = 10
  } = billingStatus || {};

  const handleAddLicenses = async () => {
    if (licenseQuantity < 1) return;

    setLoading(true);
    try {
      const response = await billingAPI.purchaseLicenses(tenantId, licenseQuantity);
      
      if (response.data.data?.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.data.url;
      }
    } catch (error) {
      console.error('Error purchasing licenses:', error);
      showNotification(
        error.response?.data?.message || 'Failed to start license purchase',
        'error'
      );
      setLoading(false);
    }
  };

  const handleReduceLicenses = async () => {
    const newTotal = purchasedLicenses - licenseQuantity;
    if (newTotal < 1 || newTotal < activeTeamMembers) return;

    setLoading(true);
    try {
      await billingAPI.updateLicenses(tenantId, newTotal);
      
      showNotification(
        `Successfully reduced licenses to ${newTotal}`,
        'success'
      );
      
      setReduceLicenseDialog(false);
      setLicenseQuantity(1);
      
      // Refresh billing status
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error reducing licenses:', error);
      showNotification(
        error.response?.data?.message || 'Failed to reduce licenses',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const maxReducibleLicenses = Math.max(0, purchasedLicenses - activeTeamMembers);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            License Management
          </Typography>
          <Tooltip title="Each license allows one team member to access your Pro account">
            <IconButton size="small">
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Current License Status */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: 'action.hover', 
          borderRadius: 1,
          mb: 3 
        }}>
          <List dense disablePadding>
            <ListItem sx={{ px: 0 }}>
              <ListItemText 
                primary="Total Licenses"
                secondary={`€${pricePerLicense} per license per month`}
              />
              <Typography variant="h6">
                {purchasedLicenses}
              </Typography>
            </ListItem>
            
            <Divider sx={{ my: 1 }} />
            
            <ListItem sx={{ px: 0 }}>
              <ListItemText primary="Active Team Members" />
              <Chip 
                label={activeTeamMembers}
                icon={<TeamIcon />}
                color="primary"
                size="small"
              />
            </ListItem>
            
            <ListItem sx={{ px: 0 }}>
              <ListItemText primary="Available Licenses" />
              <Chip 
                label={availableLicenses}
                color={availableLicenses > 0 ? 'success' : 'default'}
                size="small"
              />
            </ListItem>
            
            <Divider sx={{ my: 1 }} />
            
            <ListItem sx={{ px: 0 }}>
              <ListItemText 
                primary="Monthly License Cost"
                secondary={`${purchasedLicenses} licenses × €${pricePerLicense}`}
              />
              <Typography variant="h6" color="primary">
                €{monthlyLicenseCost}
              </Typography>
            </ListItem>
          </List>
        </Box>

        {/* License Actions */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddLicenseDialog(true)}
            fullWidth
          >
            Add Licenses
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RemoveIcon />}
            onClick={() => setReduceLicenseDialog(true)}
            disabled={maxReducibleLicenses === 0}
            fullWidth
          >
            Reduce Licenses
          </Button>
        </Box>

        {maxReducibleLicenses === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            All licenses are currently in use by team members. Remove team members before reducing licenses.
          </Alert>
        )}
      </CardContent>

      {/* Add License Dialog */}
      <Dialog open={addLicenseDialog} onClose={() => setAddLicenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PurchaseIcon />
            Purchase Additional Licenses
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Add more licenses to invite additional team members. Each license costs €{pricePerLicense} per month.
          </DialogContentText>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <TextField
              type="number"
              label="Number of Licenses"
              value={licenseQuantity}
              onChange={(e) => setLicenseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: 100 }}
              fullWidth
            />
            <Box sx={{ minWidth: 120, textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Additional Cost
              </Typography>
              <Typography variant="h6">
                €{licenseQuantity * pricePerLicense}/mo
              </Typography>
            </Box>
          </Box>

          <Alert severity="info">
            Your new monthly total will be €{monthlyLicenseCost + (licenseQuantity * pricePerLicense)}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddLicenseDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddLicenses} 
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <PurchaseIcon />}
            disabled={loading}
          >
            Purchase {licenseQuantity} License{licenseQuantity > 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reduce License Dialog */}
      <Dialog open={reduceLicenseDialog} onClose={() => setReduceLicenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
            <WarningIcon />
            Reduce Licenses
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Reducing licenses will take effect immediately. Make sure you have removed team members first.
          </Alert>
          
          <DialogContentText sx={{ mb: 3 }}>
            You currently have {purchasedLicenses} licenses with {activeTeamMembers} active team members.
            You can reduce up to {maxReducibleLicenses} license{maxReducibleLicenses !== 1 ? 's' : ''}.
          </DialogContentText>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <TextField
              type="number"
              label="Licenses to Remove"
              value={licenseQuantity}
              onChange={(e) => setLicenseQuantity(Math.max(1, Math.min(maxReducibleLicenses, parseInt(e.target.value) || 1)))}
              inputProps={{ min: 1, max: maxReducibleLicenses }}
              fullWidth
            />
            <Box sx={{ minWidth: 120, textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Monthly Savings
              </Typography>
              <Typography variant="h6" color="success.main">
                €{licenseQuantity * pricePerLicense}/mo
              </Typography>
            </Box>
          </Box>

          <Alert severity="info">
            Your new monthly total will be €{monthlyLicenseCost - (licenseQuantity * pricePerLicense)}
            ({purchasedLicenses - licenseQuantity} license{(purchasedLicenses - licenseQuantity) !== 1 ? 's' : ''})
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReduceLicenseDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleReduceLicenses} 
            variant="contained"
            color="warning"
            startIcon={loading ? <CircularProgress size={20} /> : <RemoveIcon />}
            disabled={loading || (purchasedLicenses - licenseQuantity) < activeTeamMembers}
          >
            Remove {licenseQuantity} License{licenseQuantity > 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default LicenseManager;