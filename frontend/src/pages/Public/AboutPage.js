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
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import GroupsIcon from '@mui/icons-material/Groups';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SecurityIcon from '@mui/icons-material/Security';

const AboutPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const values = [
    {
      icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
      title: 'Innovation im Vordergrund',
      description: 'Wir nutzen modernste KI-Technologie, um die Art und Weise zu transformieren, wie Menschen mit Videoinhalten interagieren.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 32 }} />,
      title: 'Datenschutz von Anfang an',
      description: 'Ihre Daten gehören Ihnen. Wir bauen mit Datenschutz und Sicherheit im Kern all unserer Entwicklungen.',
    },
    {
      icon: <GroupsIcon sx={{ fontSize: 32 }} />,
      title: 'Nutzerzentriert',
      description: 'Jede Funktion wird mit unseren Nutzern im Blick entwickelt, mit Fokus auf echte Workflows und Bedürfnisse.',
    },
    {
      icon: <RocketLaunchIcon sx={{ fontSize: 32 }} />,
      title: 'Ständiges Wachstum',
      description: 'Wir entwickeln uns ständig weiter und verbessern uns, angetrieben durch Nutzerfeedback und technologische Fortschritte.',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Verarbeitete Videos' },
    { value: '10K+', label: 'Aktive Nutzer' },
    { value: '99.9%', label: 'Verfügbarkeit' },
    { value: '4.9/5', label: 'Nutzerbewertung' },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <Box
        sx={{
          py: 12,
          backgroundColor: 'background.default',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '600px',
            height: '600px',
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
            Die Zukunft des Video-Wissens gestalten
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '800px', mx: 'auto' }}
          >
            ProcessLink entstand aus einer einfachen Idee: Was wäre, wenn jedes Video zu einem durchsuchbaren, 
            organisierten Wissensgut werden könnte? Wir machen diese Vision zur Realität.
          </Typography>
        </Container>
      </Box>

      {/* Mission Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 600,
                  mb: 3,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                Unsere Mission
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, lineHeight: 1.8 }}
              >
                In einer Welt voller Videoinhalte gehen wertvolle Erkenntnisse in stundenlangem Filmmaterial verloren. 
                ProcessLink existiert, um dieses verborgene Wissen freizusetzen und es zugänglich, durchsuchbar und nutzbar zu machen.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, lineHeight: 1.8 }}
              >
                Wir glauben, dass KI die menschliche Intelligenz ergänzen und nicht ersetzen sollte. Unsere Tools helfen Profis, 
                maximalen Wert aus ihren Videoinhalten zu ziehen, seien es Meetings, Vorlesungen, Tutorials oder Forschung.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.8 }}
              >
                Durch die Kombination von modernster KI mit durchdachtem Design bauen wir ein zweites Gehirn für Videoinhalte - 
                eines, das alles speichert, Ideen verbindet und Ihnen hilft, intelligenter zu arbeiten.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  height: '400px',
                  borderRadius: 2,
                  background: `linear-gradient(135deg, 
                    ${alpha(theme.palette.primary.main, 0.1)} 0%, 
                    ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h1" sx={{ fontSize: '120px', opacity: 0.1, fontWeight: 100 }}>
                  AI
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Values Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            align="center"
            sx={{ mb: 8, fontWeight: 600 }}
          >
            Unsere Werte
          </Typography>
          <Grid container spacing={4}>
            {values.map((value, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      color: 'primary.main',
                    }}
                  >
                    {value.icon}
                  </Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {value.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {value.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box
        sx={{
          py: 8,
          background: `linear-gradient(135deg, 
            ${alpha(theme.palette.primary.main, 0.05)} 0%, 
            ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            align="center"
            sx={{ mb: 8, fontWeight: 600 }}
          >
            ProcessLink in Zahlen
          </Typography>
          <Grid container spacing={4}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 700,
                      mb: 1,
                      background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
              }}
            >
              Begleiten Sie uns auf dieser Reise
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400 }}
            >
              Seien Sie Teil der Revolution im Video-Wissensmanagement. 
              Beginnen Sie noch heute, Ihre Inhalte zu transformieren.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  px: 5,
                  py: 2,
                  fontSize: '1.1rem',
                  background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #6b21a8 30%, #9333ea 90%)',
                  },
                }}
              >
                Kostenlos starten
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/contact')}
                sx={{
                  px: 5,
                  py: 2,
                  fontSize: '1.1rem',
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                Kontakt aufnehmen
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default AboutPage;