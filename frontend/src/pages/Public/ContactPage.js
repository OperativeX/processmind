import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  MenuItem,
  Alert,
  Snackbar,
  useTheme,
  alpha,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';
import EmailIcon from '@mui/icons-material/Email';
import ChatIcon from '@mui/icons-material/Chat';
import HelpIcon from '@mui/icons-material/Help';
import BusinessIcon from '@mui/icons-material/Business';

const ContactPage = () => {
  const theme = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = [
    { value: 'general', label: 'Allgemeine Anfrage' },
    { value: 'support', label: 'Technischer Support' },
    { value: 'sales', label: 'Vertrieb & Preise' },
    { value: 'enterprise', label: 'Enterprise Lösungen' },
    { value: 'feature', label: 'Feature-Anfrage' },
    { value: 'bug', label: 'Fehlermeldung' },
  ];

  const contactOptions = [
    {
      icon: <EmailIcon sx={{ fontSize: 32 }} />,
      title: 'E-Mail',
      description: 'Kontaktieren Sie uns für allgemeine Anfragen',
      contact: 'hallo@processlink.de',
    },
    {
      icon: <ChatIcon sx={{ fontSize: 32 }} />,
      title: 'Live-Chat',
      description: 'Chatten Sie mit unserem Support-Team',
      contact: 'Verfügbar Mo-Fr, 9-18 Uhr MEZ',
    },
    {
      icon: <HelpIcon sx={{ fontSize: 32 }} />,
      title: 'Hilfecenter',
      description: 'Durchsuchen Sie unsere Dokumentation',
      contact: 'docs.processlink.de',
    },
    {
      icon: <BusinessIcon sx={{ fontSize: 32 }} />,
      title: 'Enterprise',
      description: 'Maßgeschneiderte Lösungen für große Teams',
      contact: 'enterprise@processlink.de',
    },
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSuccess(true);
      setFormData({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <Box
        sx={{
          py: 8,
          backgroundColor: 'background.default',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: '-30%',
            left: '-10%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: `radial-gradient(circle, 
              ${alpha(theme.palette.primary.main, 0.1)} 0%, 
              transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
        
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
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
            Kontakt aufnehmen
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '600px', mx: 'auto' }}
          >
            Haben Sie eine Frage oder benötigen Sie Hilfe? Wir sind hier, um Sie auf Ihrem Weg zu unterstützen.
          </Typography>
        </Container>
      </Box>

      {/* Contact Options */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {contactOptions.map((option, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    backgroundColor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                      }}
                    >
                      {option.icon}
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                      {option.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {option.description}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'primary.main',
                        fontWeight: 500,
                      }}
                    >
                      {option.contact}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Contact Form */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="md">
          <Typography
            variant="h3"
            align="center"
            sx={{ mb: 6, fontWeight: 600 }}
          >
            Senden Sie uns eine Nachricht
          </Typography>
          
          <Card
            elevation={0}
            sx={{
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              p: 4,
            }}
          >
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    label="Ihr Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    type="email"
                    label="E-Mail-Adresse"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Unternehmen (Optional)"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="Betreff"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    variant="outlined"
                  >
                    {subjects.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={6}
                    label="Nachricht"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder="Bitte beschreiben Sie, wie wir Ihnen helfen können..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={isSubmitting}
                      sx={{
                        px: 6,
                        py: 1.5,
                        background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #6b21a8 30%, #9333ea 90%)',
                        },
                      }}
                    >
                      {isSubmitting ? 'Wird gesendet...' : 'Nachricht senden'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </Card>

          {/* FAQ Link */}
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Suchen Sie schnelle Antworten?
            </Typography>
            <Button
              variant="outlined"
              size="large"
              href="/features#faq"
              sx={{
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              FAQ durchsuchen
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Vielen Dank für Ihre Nachricht! Wir melden uns innerhalb von 24 Stunden bei Ihnen.
        </Alert>
      </Snackbar>

      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setShowError(false)}>
          Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder senden Sie uns direkt eine E-Mail.
        </Alert>
      </Snackbar>
    </PublicLayout>
  );
};

export default ContactPage;