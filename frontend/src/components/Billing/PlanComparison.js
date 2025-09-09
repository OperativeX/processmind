import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Star as StarIcon,
  TrendingUp as ValueIcon,
  CloudUpload as UploadIcon,
  Storage as StorageIcon,
  People as TeamIcon,
  Speed as SpeedIcon,
  Analytics as AnalyticsIcon,
  Support as SupportIcon
} from '@mui/icons-material';
import { billingAPI } from '../../services/api';

const PlanComparison = ({ currentPlan, onUpgrade, tenantId }) => {
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPricingConfig();
  }, []);

  const loadPricingConfig = async () => {
    try {
      const response = await billingAPI.getPricingConfig(tenantId);
      setPricingConfig(response.data.data);
    } catch (error) {
      console.error('Error loading pricing config:', error);
      setError('Failed to load pricing information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  const { pricePerLicense, yearlyPrice, features } = pricingConfig || {};
  
  // Calculate value proposition
  const monthlyUploads = 10;
  const averageVideosPerPro = 50; // Average uploads for pro users
  const savingsPerMonth = Math.max(0, (averageVideosPerPro - monthlyUploads) * 2); // €2 value per video

  const comparisonData = [
    {
      feature: 'Team Members',
      icon: <TeamIcon />,
      free: '1 (yourself)',
      pro: 'Unlimited',
      highlight: true
    },
    {
      feature: 'Monthly Uploads',
      icon: <UploadIcon />,
      free: '10 videos',
      pro: 'Unlimited',
      highlight: true
    },
    {
      feature: 'Storage Space',
      icon: <StorageIcon />,
      free: '20GB',
      pro: 'Unlimited',
      highlight: true
    },
    {
      feature: 'Processing Speed',
      icon: <SpeedIcon />,
      free: 'Standard',
      pro: 'Priority (2x faster)'
    },
    {
      feature: 'Analytics',
      icon: <AnalyticsIcon />,
      free: 'Basic',
      pro: 'Advanced insights'
    },
    {
      feature: 'Support',
      icon: <SupportIcon />,
      free: 'Community',
      pro: 'Priority support'
    }
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Value Proposition Alert */}
      <Alert 
        severity="info" 
        icon={<ValueIcon />}
        sx={{ mb: 3 }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          Save up to €{savingsPerMonth}/month with Pro
        </Typography>
        <Typography variant="body2">
          Based on {averageVideosPerPro} average monthly uploads. 
          Pro users save €{yearlyPrice ? Math.round(savingsPerMonth * 12 - yearlyPrice) : 0}+ per year!
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Free Plan */}
        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              height: '100%',
              border: currentPlan === 'free' ? '2px solid' : '1px solid',
              borderColor: currentPlan === 'free' ? 'primary.main' : 'divider'
            }}
          >
            <CardContent>
              {currentPlan === 'free' && (
                <Chip
                  label="Current Plan"
                  size="small"
                  color="primary"
                  sx={{ mb: 2 }}
                />
              )}
              
              <Typography variant="h5" gutterBottom>
                Free Plan
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="span">
                  €0
                </Typography>
                <Typography variant="body1" component="span" color="text.secondary">
                  /month
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Perfect for getting started
              </Typography>

              <List dense>
                {comparisonData.map((item, index) => (
                  <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {item.free.includes('Unlimited') || item.free.includes('Priority') ? (
                        <CloseIcon sx={{ color: 'text.disabled' }} />
                      ) : (
                        <CheckIcon sx={{ color: 'success.main' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.free}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: item.highlight ? 'text.primary' : 'text.secondary'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Pro Plan */}
        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              height: '100%',
              border: '2px solid',
              borderColor: 'success.main',
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.05) 0%, rgba(46, 125, 50, 0.02) 100%)'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -12,
                right: 20,
                backgroundColor: 'success.main',
                color: 'white',
                px: 2,
                py: 0.5,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <StarIcon fontSize="small" />
              <Typography variant="body2" fontWeight="bold">
                RECOMMENDED
              </Typography>
            </Box>

            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>
                Pro Plan
              </Typography>
              
              <Box sx={{ mb: 1 }}>
                <Typography variant="h3" component="span">
                  €{pricePerLicense || 10}
                </Typography>
                <Typography variant="body1" component="span" color="text.secondary">
                  /user/month
                </Typography>
              </Box>
              
              <Typography variant="body2" color="success.main" fontWeight="bold" sx={{ mb: 2 }}>
                €{yearlyPrice || 120} per year
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                For teams and power users
              </Typography>

              <List dense>
                {comparisonData.map((item, index) => (
                  <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckIcon sx={{ color: 'success.main' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.pro}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: item.highlight ? 'medium' : 'normal',
                        color: 'text.primary'
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 3 }} />

              <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                onClick={onUpgrade}
                startIcon={<StarIcon />}
                sx={{ 
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600
                }}
              >
                Upgrade to Pro - €{pricePerLicense}/month
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Additional Benefits */}
      <Box sx={{ mt: 4, p: 3, backgroundColor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Why Teams Choose Pro
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              🚀 No Upload Limits
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Process as many videos as you need without monthly restrictions
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              👥 Team Collaboration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invite your entire team and work together seamlessly
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              💾 Unlimited Storage
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Store all your processes without worrying about space
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              ⚡ Priority Processing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Get your results 2x faster with priority queue access
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default PlanComparison;