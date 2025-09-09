import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Alert,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  IconButton,
} from '@mui/material';
import {
  People as PeopleIcon,
  CheckCircle as CheckIcon,
  Euro as EuroIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Badge as LicenseIcon,
} from '@mui/icons-material';
import CheckoutButton from '../Billing/CheckoutButton';
import CustomerPortalButton from '../Billing/CustomerPortalButton';
import axios from 'axios';

const BillingStatus = ({ billingStatus, limits, tenantId }) => {
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [licenseQuantity, setLicenseQuantity] = useState(1);
  const [newLicenseCount, setNewLicenseCount] = useState(1);
  const [loading, setLoading] = useState(false);
  if (!billingStatus) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>Loading billing information...</Typography>
      </Paper>
    );
  }

  const {
    currentUsers,
    purchasedLicenses,
    availableLicenses,
    freeUsers,
    billableUsers,
    pricePerUser,
    currentMonthlyPrice,
    nextUserPrice,
    canAddMoreUsers,
    hasCustomPricing,
    customPricingNotes,
  } = billingStatus;

  const usagePercentage = limits?.maxUsers > 0 
    ? (currentUsers / limits.maxUsers) * 100 
    : 0;

  const handlePurchaseLicenses = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `/api/v1/billing/purchase-licenses`,
        { quantity: licenseQuantity }
      );
      
      if (response.data.success && response.data.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.data.url;
      }
    } catch (error) {
      console.error('Error purchasing licenses:', error);
      alert(error.response?.data?.message || 'Failed to create checkout session');
    } finally {
      setLoading(false);
    }
  };

  const handleReduceLicenses = async () => {
    setLoading(true);
    try {
      await axios.put(
        `/api/v1/billing/update-licenses`,
        { newLicenseCount }
      );
      
      setReduceDialogOpen(false);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error reducing licenses:', error);
      alert(error.response?.data?.message || 'Failed to update licenses');
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/v1/billing/downgrade-to-free`);
      
      // Refresh to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error downgrading to free:', error);
      alert(error.response?.data?.message || 'Failed to downgrade to free plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* License Overview Card - Only for Pro accounts */}
        {billingStatus.plan === 'pro' && purchasedLicenses && (
          <Grid item xs={12}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
              border: '1px solid #30363d' 
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LicenseIcon /> License Overview
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setPurchaseDialogOpen(true)}
                      color="primary"
                    >
                      Purchase Licenses
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RemoveIcon />}
                      onClick={() => {
                        setNewLicenseCount(purchasedLicenses);
                        setReduceDialogOpen(true);
                      }}
                      color="warning"
                      disabled={availableLicenses === 0}
                    >
                      Reduce Licenses
                    </Button>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ bgcolor: '#0d1117', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h3" color="primary">
                          {purchasedLicenses}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Purchased Licenses
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ bgcolor: '#0d1117', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h3" color="success.main">
                          {availableLicenses}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Available Licenses
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ bgcolor: '#0d1117', textAlign: 'center' }}>
                      <CardContent>
                        <Typography variant="h3" color="info.main">
                          {currentUsers}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Users
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {availableLicenses === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    No licenses available. Purchase additional licenses before inviting new team members.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Current Plan Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Usage
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Team Members
                  </Typography>
                  <Typography variant="body2">
                    {currentUsers} {limits?.maxUsers === -1 ? 'users' : `/ ${limits?.maxUsers}`}
                  </Typography>
                </Box>
                {limits?.maxUsers > 0 && (
                  <LinearProgress 
                    variant="determinate" 
                    value={usagePercentage}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                )}
              </Box>

              <List dense>
                {freeUsers > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${freeUsers} free user${freeUsers !== 1 ? 's' : ''}`}
                      secondary="Included in your plan"
                    />
                  </ListItem>
                )}
                
                {billableUsers > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <PeopleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${billableUsers} paid user${billableUsers !== 1 ? 's' : ''}`}
                      secondary={`€${pricePerUser} per user/month`}
                    />
                  </ListItem>
                )}
                
                {freeUsers === 0 && currentUsers > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <EuroIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="All users are billable"
                      secondary={`Each user costs €${pricePerUser}/month`}
                    />
                  </ListItem>
                )}
                
                {currentUsers === 0 && (
                  <ListItem>
                    <ListItemText 
                      primary="No team members yet"
                      secondary="Invite your first team member"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Billing Summary Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Cost
              </Typography>
              
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h2" color="primary">
                  €{currentMonthlyPrice}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  per month
                </Typography>
                {freeUsers > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    (First {freeUsers} user{freeUsers > 1 ? 's' : ''} included free)
                  </Typography>
                )}
                {freeUsers === 0 && billableUsers > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    (All users are billable)
                  </Typography>
                )}
              </Box>

              {nextUserPrice > 0 && (
                <Alert severity="info" icon={<EuroIcon />} sx={{ mt: 2 }}>
                  Next user will cost €{nextUserPrice}/month
                </Alert>
              )}

              {hasCustomPricing && (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label="Custom Pricing" 
                    color="secondary" 
                    size="small"
                    icon={<InfoIcon />}
                  />
                  {customPricingNotes && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      {customPricingNotes}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pricing Details */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Pricing Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="text.secondary">
                    {freeUsers}
                  </Typography>
                  <Typography variant="body2">
                    Free Users
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary">
                    €{pricePerUser}
                  </Typography>
                  <Typography variant="body2">
                    Per Additional User
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color={canAddMoreUsers ? 'success.main' : 'error.main'}>
                    {canAddMoreUsers ? 'Active' : 'Limit Reached'}
                  </Typography>
                  <Typography variant="body2">
                    Status
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>How billing works:</strong>
              </Typography>
              <List dense sx={{ mt: 1 }}>
                {freeUsers > 0 && (
                  <ListItem>
                    <ListItemText 
                      primary={`First ${freeUsers} user${freeUsers !== 1 ? 's are' : ' is'} free`}
                    />
                  </ListItem>
                )}
                {freeUsers === 0 ? (
                  <ListItem>
                    <ListItemText 
                      primary={`All users cost €${pricePerUser}/month`}
                    />
                  </ListItem>
                ) : (
                  <ListItem>
                    <ListItemText 
                      primary={`Each additional user costs €${pricePerUser}/month`}
                    />
                  </ListItem>
                )}
                <ListItem>
                  <ListItemText 
                    primary="Billing updates automatically when users are added or removed"
                  />
                </ListItem>
                {hasCustomPricing && (
                  <ListItem>
                    <ListItemText 
                      primary="Your organization has custom pricing"
                      secondary={customPricingNotes}
                    />
                  </ListItem>
                )}
              </List>
            </Box>

            {/* Billing Actions */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              {!billingStatus.hasActiveSubscription ? (
                <CheckoutButton
                  tenantId={tenantId}
                  priceId={process.env.REACT_APP_STRIPE_PRO_PRICE_ID}
                  variant="contained"
                  color="primary"
                  size="large"
                >
                  Start Subscription
                </CheckoutButton>
              ) : (
                <>
                  <CustomerPortalButton
                    tenantId={tenantId}
                    variant="outlined"
                    color="primary"
                    size="large"
                  >
                    Manage Billing
                  </CustomerPortalButton>
                  {billingStatus.plan === 'pro' && currentUsers === 1 && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="large"
                      onClick={() => setDowngradeDialogOpen(true)}
                    >
                      Downgrade to Free
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Purchase Licenses Dialog */}
      <Dialog open={purchaseDialogOpen} onClose={() => setPurchaseDialogOpen(false)}>
        <DialogTitle>Purchase Additional Licenses</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Each license costs €{pricePerUser} per month and allows you to add one team member.
          </DialogContentText>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
            <IconButton 
              onClick={() => setLicenseQuantity(Math.max(1, licenseQuantity - 1))}
              disabled={licenseQuantity <= 1}
            >
              <RemoveIcon />
            </IconButton>
            <TextField
              type="number"
              value={licenseQuantity}
              onChange={(e) => setLicenseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ width: 100, textAlign: 'center' }}
              inputProps={{ min: 1, style: { textAlign: 'center' } }}
            />
            <IconButton onClick={() => setLicenseQuantity(licenseQuantity + 1)}>
              <AddIcon />
            </IconButton>
          </Box>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2">
              Total: {licenseQuantity} license{licenseQuantity !== 1 ? 's' : ''} × €{pricePerUser}/month = 
              <Typography component="span" variant="h6" color="primary" sx={{ ml: 1 }}>
                €{licenseQuantity * pricePerUser}/month
              </Typography>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handlePurchaseLicenses} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Proceed to Checkout'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reduce Licenses Dialog */}
      <Dialog open={reduceDialogOpen} onClose={() => setReduceDialogOpen(false)}>
        <DialogTitle>Reduce License Count</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You currently have {purchasedLicenses} licenses with {currentUsers} active users.
            {availableLicenses > 0 && ` You have ${availableLicenses} unused license${availableLicenses !== 1 ? 's' : ''}.`}
          </DialogContentText>
          {currentUsers >= newLicenseCount && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You cannot reduce licenses below your current user count. Please remove team members first.
            </Alert>
          )}
          <TextField
            fullWidth
            type="number"
            label="New License Count"
            value={newLicenseCount}
            onChange={(e) => setNewLicenseCount(Math.max(currentUsers, parseInt(e.target.value) || 1))}
            inputProps={{ min: currentUsers }}
            helperText={`Minimum: ${currentUsers} (current users)`}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2">
              New monthly cost: {newLicenseCount} license{newLicenseCount !== 1 ? 's' : ''} × €{pricePerUser}/month = 
              <Typography component="span" variant="h6" color="primary" sx={{ ml: 1 }}>
                €{newLicenseCount * pricePerUser}/month
              </Typography>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReduceDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleReduceLicenses} 
            variant="contained" 
            color="warning"
            disabled={loading || currentUsers > newLicenseCount}
          >
            {loading ? 'Processing...' : 'Reduce Licenses'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Downgrade Dialog */}
      <Dialog open={downgradeDialogOpen} onClose={() => setDowngradeDialogOpen(false)}>
        <DialogTitle>Downgrade to Free Plan</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Warning:</strong> Downgrading will result in the following limitations:
          </Alert>
          <List>
            <ListItem>
              <ListItemIcon>
                <RemoveIcon color="error" />
              </ListItemIcon>
              <ListItemText 
                primary="No team features"
                secondary="You won't be able to invite team members"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <RemoveIcon color="error" />
              </ListItemIcon>
              <ListItemText 
                primary="Limited uploads"
                secondary="Only 10 uploads per month"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <RemoveIcon color="error" />
              </ListItemIcon>
              <ListItemText 
                primary="Storage limit"
                secondary="20GB storage limit"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText 
                primary="Keep your processes"
                secondary="All existing processes will remain accessible"
              />
            </ListItem>
          </List>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            You can upgrade back to Pro at any time to regain access to all features.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDowngradeDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDowngrade} 
            variant="contained" 
            color="error"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm Downgrade'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingStatus;