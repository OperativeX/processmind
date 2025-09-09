import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  Chip
} from '@mui/material';
import {
  AttachMoney,
  Save,
  People,
  Settings,
  Euro,
  CurrencyPound,
  MonetizationOn,
  Upload as UploadIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';
import { superAdminService } from '../../services/superAdminService';
import { formatCurrency } from '../../utils/formatters';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d'
}));

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  height: '100%'
}));

const SuperAdminPricing = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pricingSettings, setPricingSettings] = useState({
    proPricePerUser: 10.00,
    currency: 'EUR',
    freeUploadLimit: 10,
    freeStorageLimit: 20 // GB
  });
  const [tenantStats, setTenantStats] = useState({
    totalTenants: 0,
    freeTenants: 0,
    proTenants: 0,
    monthlyRevenue: 0
  });

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load global pricing settings
      const settingsRes = await superAdminService.getGlobalPricingSettings();
      setPricingSettings({
        proPricePerUser: settingsRes.pricing?.proPricePerUser || 10.00,
        currency: settingsRes.pricing?.currency || 'EUR',
        freeUploadLimit: settingsRes.pricing?.freeUploadLimit || 10,
        freeStorageLimit: settingsRes.pricing?.freeStorageLimit || 20
      });

      // Load tenant statistics
      const tenantsRes = await superAdminService.getTenants({ limit: 1000 });
      const tenants = tenantsRes.tenants;
      
      const freeTenants = tenants.filter(t => t.subscription?.plan === 'free').length;
      const proTenants = tenants.filter(t => t.subscription?.plan === 'pro').length;
      const monthlyRevenue = tenants.reduce((sum, t) => sum + (t.monthlyRevenue || 0), 0);
      
      setTenantStats({
        totalTenants: tenants.length,
        freeTenants,
        proTenants,
        monthlyRevenue
      });

    } catch (err) {
      console.error('Load pricing error:', err);
      setError('Failed to load pricing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await superAdminService.updateGlobalPricingSettings(pricingSettings);
      
      setSuccess('Pricing settings updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Save pricing error:', err);
      setError('Failed to save pricing settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setPricingSettings({
      ...pricingSettings,
      [field]: value
    });
  };

  const calculateMonthlyRevenue = () => {
    return tenantStats.monthlyRevenue;
  };

  const getCurrencyIcon = (currency) => {
    switch (currency) {
      case 'EUR':
        return <Euro />;
      case 'USD':
        return <AttachMoney />;
      case 'GBP':
        return <CurrencyPound />;
      default:
        return <MonetizationOn />;
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Pricing Configuration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure default pricing for all tenants. Individual tenants can have custom pricing overrides.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Global Pricing Settings */}
          <Grid item xs={12} md={6}>
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Settings sx={{ color: '#7c3aed' }} />
                <Typography variant="h6">
                  Global Pricing Settings
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={pricingSettings.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      label="Currency"
                    >
                      <MenuItem value="EUR">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Euro fontSize="small" />
                          EUR - Euro
                        </Box>
                      </MenuItem>
                      <MenuItem value="USD">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachMoney fontSize="small" />
                          USD - US Dollar
                        </Box>
                      </MenuItem>
                      <MenuItem value="GBP">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CurrencyPound fontSize="small" />
                          GBP - British Pound
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Pro Plan Price Per User"
                    type="number"
                    value={pricingSettings.proPricePerUser}
                    onChange={(e) => handleInputChange('proPricePerUser', parseFloat(e.target.value))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {getCurrencyIcon(pricingSettings.currency)}
                        </InputAdornment>
                      )
                    }}
                    helperText="Monthly price per user for Pro accounts"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Free Upload Limit"
                    type="number"
                    value={pricingSettings.freeUploadLimit}
                    onChange={(e) => handleInputChange('freeUploadLimit', parseInt(e.target.value))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <UploadIcon />
                        </InputAdornment>
                      )
                    }}
                    helperText="Uploads per month for Free accounts"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Free Storage Limit (GB)"
                    type="number"
                    value={pricingSettings.freeStorageLimit}
                    onChange={(e) => handleInputChange('freeStorageLimit', parseInt(e.target.value))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <StorageIcon />
                        </InputAdornment>
                      )
                    }}
                    helperText="Storage limit in GB for Free accounts"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                      backgroundColor: '#7c3aed',
                      '&:hover': {
                        backgroundColor: '#6d28d9'
                      }
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </Grid>
              </Grid>
            </StyledPaper>
          </Grid>

          {/* Pricing Preview */}
          <Grid item xs={12} md={6}>
            <StyledPaper>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Pricing Preview
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <StyledCard>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Tenants
                      </Typography>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {tenantStats.totalTenants}
                      </Typography>
                      <Typography variant="caption">
                        Organizations registered
                      </Typography>
                    </CardContent>
                  </StyledCard>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <StyledCard>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Free Accounts
                      </Typography>
                      <Typography variant="h4" sx={{ mb: 1, color: 'grey.500' }}>
                        {tenantStats.freeTenants}
                      </Typography>
                      <Typography variant="caption">
                        {pricingSettings.freeUploadLimit} uploads, {pricingSettings.freeStorageLimit}GB
                      </Typography>
                    </CardContent>
                  </StyledCard>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <StyledCard>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Pro Accounts
                      </Typography>
                      <Typography variant="h4" sx={{ mb: 1, color: 'success.main' }}>
                        {tenantStats.proTenants}
                      </Typography>
                      <Typography variant="caption">
                        {formatCurrency(pricingSettings.proPricePerUser, pricingSettings.currency)}/user/month
                      </Typography>
                    </CardContent>
                  </StyledCard>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Monthly Revenue
              </Typography>
              
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h3" sx={{ fontWeight: 600, color: 'success.main' }}>
                  {formatCurrency(tenantStats.monthlyRevenue, pricingSettings.currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total monthly recurring revenue
                </Typography>
              </Box>
            </StyledPaper>
          </Grid>

          {/* Plan Information */}
          <Grid item xs={12}>
            <StyledPaper>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Plan Information
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: '1px solid #30363d', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Free Plan
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="1 user (team owner only)" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary={`${pricingSettings.freeUploadLimit} uploads per month`} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary={`${pricingSettings.freeStorageLimit}GB storage limit`} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="No team features" />
                      </ListItem>
                    </List>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: '2px solid', borderColor: 'success.main', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                      Pro Plan
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Unlimited users" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Unlimited uploads" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Unlimited storage" />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText primary="Full team collaboration" />
                      </ListItem>
                    </List>
                    <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
                      {formatCurrency(pricingSettings.proPricePerUser, pricingSettings.currency)} per user per month
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </StyledPaper>
          </Grid>
        </Grid>
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminPricing;