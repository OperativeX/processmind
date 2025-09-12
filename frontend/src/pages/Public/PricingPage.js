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
      name: 'Kostenlos',
      price: '0',
      description: 'Perfekt zum Ausprobieren von ProcessLink',
      features: [
        '5 Video-Uploads pro Monat',
        '10 Minuten maximale Videolänge',
        'Basis-Transkription',
        'Standard-Verarbeitungsgeschwindigkeit',
        'Export im Textformat',
        'Community-Support',
      ],
      buttonText: 'Kostenlos starten',
      buttonVariant: 'outlined',
      popular: false,
    },
    {
      name: 'Pro',
      price: '29',
      description: 'Für Profis und kleine Teams',
      features: [
        '100 Video-Uploads pro Monat',
        '60 Minuten maximale Videolänge',
        'Erweiterte KI-Analyse',
        'Priorisierte Verarbeitungsgeschwindigkeit',
        'Alle Exportformate',
        'Tag-basierte Organisation',
        'Wissensgraph-Visualisierung',
        'E-Mail-Support',
        'API-Zugang',
      ],
      buttonText: 'Pro-Version testen',
      buttonVariant: 'contained',
      popular: true,
    },
    {
      name: 'Business',
      price: '99',
      description: 'Für wachsende Teams und Organisationen',
      features: [
        'Unbegrenzte Video-Uploads',
        'Unbegrenzte Videolänge',
        'Benutzerdefinierte KI-Modelle',
        'Schnellste Verarbeitungsgeschwindigkeit',
        'Erweiterte Integrationen',
        'Team-Zusammenarbeit',
        'Admin-Dashboard',
        'Prioritäts-Support',
        'Benutzerdefinierte API-Limits',
        'SSO-Authentifizierung',
        'Erweiterte Analysen',
      ],
      buttonText: 'Vertrieb kontaktieren',
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
            Einfache, transparente Preisgestaltung
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '600px', mx: 'auto' }}
          >
            Wählen Sie den perfekten Plan für Ihre Bedürfnisse. Immer flexibel skalierbar.
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
                    overflow: 'visible',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  {plan.popular && (
                    <Chip
                      label="Beliebteste Wahl"
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
                        /Monat
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
            Häufig gestellte Fragen
          </Typography>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Kann ich jederzeit den Plan wechseln?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Ja! Sie können Ihren Plan jederzeit upgraden oder downgraden. Änderungen treten sofort in Kraft 
              und wir berechnen die Gebühren anteilig.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Welche Zahlungsmethoden akzeptieren Sie?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express) und 
              verarbeiten Zahlungen sicher über Stripe. Business-Pläne können auch per Rechnung bezahlen.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Gibt es eine kostenlose Testversion für bezahlte Pläne?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Ja! Alle bezahlten Pläne bieten eine 14-tägige kostenlose Testversion. Keine Kreditkarte zum Start erforderlich.
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Noch Fragen?
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
              Support kontaktieren
            </Button>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default PricingPage;