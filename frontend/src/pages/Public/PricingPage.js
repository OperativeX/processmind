import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';

const PricingPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const plans = [
    {
      name: 'Free',
      price: '0',
      description: 'Perfect for trying out Process Mind',
      features: [
        '5 video uploads per month',
        '10-minute max video length',
        'Basic transcription',
        'Standard processing speed',
        'Export to text format',
        'Community support',
      ],
      buttonText: 'Start Free',
      buttonVariant: 'outlined',
      popular: false,
    },
    {
      name: 'Pro',
      price: '29',
      description: 'For professionals and small teams',
      features: [
        '100 video uploads per month',
        '60-minute max video length',
        'Advanced AI analysis',
        'Priority processing speed',
        'All export formats',
        'Tag-based organization',
        'Knowledge graph visualization',
        'Email support',
        'API access',
      ],
      buttonText: 'Start Pro Trial',
      buttonVariant: 'contained',
      popular: true,
    },
    {
      name: 'Business',
      price: '99',
      description: 'For growing teams and organizations',
      features: [
        'Unlimited video uploads',
        'Unlimited video length',
        'Custom AI models',
        'Fastest processing speed',
        'Advanced integrations',
        'Team collaboration',
        'Admin dashboard',
        'Priority support',
        'Custom API limits',
        'SSO authentication',
        'Advanced analytics',
      ],
      buttonText: 'Contact Sales',
      buttonVariant: 'outlined',
      popular: false,
    },
  ];

  return (
    <PublicLayout>
      {/* Header Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h1"
            align="center"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              mb: 3,
              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Simple, Transparent Pricing
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '600px', mx: 'auto' }}
          >
            Choose the perfect plan for your needs. Always flexible to scale up or down.
          </Typography>
        </Container>
      </Box>

      {/* Pricing Cards Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="center">
            {plans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.name}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    position: 'relative',
                    backgroundColor: 'background.default',
                    border: '2px solid',
                    borderColor: plan.popular ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  {plan.popular && (
                    <Chip
                      label="Most Popular"
                      icon={<StarIcon sx={{ fontSize: 16 }} />}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 4 }}>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      {plan.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
                      <Typography
                        variant="h2"
                        sx={{ fontWeight: 700 }}
                      >
                        ${plan.price}
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        /month
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 4 }}
                    >
                      {plan.description}
                    </Typography>

                    <List sx={{ mb: 4 }}>
                      {plan.features.map((feature, index) => (
                        <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon
                              sx={{
                                fontSize: 20,
                                color: 'primary.main',
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: 'text.secondary',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>

                    <Button
                      fullWidth
                      variant={plan.buttonVariant}
                      size="large"
                      onClick={() => {
                        if (plan.name === 'Business') {
                          navigate('/contact');
                        } else {
                          navigate('/register');
                        }
                      }}
                      sx={
                        plan.buttonVariant === 'contained'
                          ? {
                              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                              '&:hover': {
                                background: 'linear-gradient(45deg, #6b21a8 30%, #9333ea 90%)',
                              },
                            }
                          : {
                              borderColor: 'divider',
                              '&:hover': {
                                borderColor: 'primary.main',
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                              },
                            }
                      }
                    >
                      {plan.buttonText}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="md">
          <Typography
            variant="h3"
            align="center"
            sx={{ fontWeight: 600, mb: 6 }}
          >
            Frequently Asked Questions
          </Typography>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Can I change plans anytime?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
              and we'll prorate the billing accordingly.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              What payment methods do you accept?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              We accept all major credit cards (Visa, Mastercard, American Express) and process 
              payments securely through Stripe. Business plans can also pay by invoice.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Is there a free trial for paid plans?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Yes! All paid plans come with a 14-day free trial. No credit card required to start.
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Still have questions?
            </Typography>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/contact')}
              sx={{
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              Contact Support
            </Button>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default PricingPage;