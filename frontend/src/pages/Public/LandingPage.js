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
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SecurityIcon from '@mui/icons-material/Security';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import GroupIcon from '@mui/icons-material/Group';

const LandingPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const features = [
    {
      icon: <AutoAwesomeIcon sx={{ fontSize: 40 }} />,
      title: 'KI-gestützte Transkription',
      description: 'Wandeln Sie Videos mit OpenAI Whisper-Technologie in präzise, zeitgestempelte Transkripte um.',
    },
    {
      icon: <AccountTreeIcon sx={{ fontSize: 40 }} />,
      title: 'Intelligente Organisation',
      description: 'Automatisch generierte Tags, Todo-Listen und Zusammenfassungen helfen Ihnen, Ihr Wissen zu strukturieren.',
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40 }} />,
      title: 'Visueller Wissensgraph',
      description: 'Erkennen Sie Verbindungen zwischen Ihren Inhalten mit interaktiver Graph-Visualisierung.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40 }} />,
      title: 'Datenschutz im Fokus',
      description: 'Ihre Daten bleiben Ihre Daten. Sicherheit auf Unternehmensniveau mit voller Kontrolle über Ihre Inhalte.',
    },
    {
      icon: <IntegrationInstructionsIcon sx={{ fontSize: 40 }} />,
      title: 'Nahtlose Integration',
      description: 'Exportieren Sie nach Obsidian, Notion oder nutzen Sie unsere API zur Integration in Ihren Workflow.',
    },
    {
      icon: <GroupIcon sx={{ fontSize: 40 }} />,
      title: 'Team-Zusammenarbeit',
      description: 'Teilen Sie Erkenntnisse, arbeiten Sie gemeinsam an Projekten und bauen Sie Wissen zusammen auf.',
    },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          minHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          background: `linear-gradient(180deg, 
            ${alpha(theme.palette.primary.main, 0.05)} 0%, 
            transparent 100%)`,
          overflow: 'hidden',
        }}
      >
        {/* Background Gradient Orbs */}
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: `radial-gradient(circle, 
              ${alpha(theme.palette.primary.main, 0.15)} 0%, 
              transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-30%',
            left: '-15%',
            width: '800px',
            height: '800px',
            borderRadius: '50%',
            background: `radial-gradient(circle, 
              ${alpha(theme.palette.secondary.main, 0.1)} 0%, 
              transparent 70%)`,
            filter: 'blur(80px)',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4rem' },
                  lineHeight: 1.2,
                  mb: 3,
                  background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Verwandeln Sie Videos in strukturiertes Wissen
              </Typography>
              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ mb: 4, fontWeight: 400, lineHeight: 1.6 }}
              >
                ProcessLink nutzt KI, um Ihre Videoinhalte zu transkribieren, analysieren und in verwertbare Erkenntnisse zu organisieren. 
                Bauen Sie Ihr zweites Gehirn mit automatischem Tagging, Todo-Extraktion und Wissensgraphen auf.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #6b21a8 30%, #9333ea 90%)',
                    },
                  }}
                >
                  Kostenlos testen
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<PlayCircleOutlineIcon />}
                  onClick={() => navigate('/demo')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  Demo ansehen
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              {/* Placeholder for demo video or screenshot */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '400px',
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <IconButton
                  sx={{
                    width: 80,
                    height: 80,
                    backgroundColor: 'background.paper',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'background.paper',
                      transform: 'scale(1.1)',
                    },
                  }}
                >
                  <PlayCircleOutlineIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 12, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            align="center"
            sx={{
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Alles was Sie für die Verwaltung von Videowissen benötigen
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400 }}
          >
            Leistungsstarke Funktionen, die Ihnen helfen, maximalen Wert aus Ihren Videoinhalten zu ziehen
          </Typography>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    backgroundColor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-4px)',
                      boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        background: `linear-gradient(135deg, 
                          ${alpha(theme.palette.primary.main, 0.1)} 0%, 
                          ${alpha(theme.palette.primary.main, 0.2)} 100%)`,
                        color: 'primary.main',
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: 12,
          background: `linear-gradient(135deg, 
            ${alpha(theme.palette.primary.main, 0.05)} 0%, 
            ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        }}
      >
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
              Bereit, Ihren Video-Workflow zu transformieren?
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400 }}
            >
              Schließen Sie sich Tausenden von Profis an, die ProcessLink nutzen, um Erkenntnisse aus ihren Videoinhalten zu gewinnen.
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
                Kostenlos testen
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/pricing')}
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
                Preise anzeigen
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default LandingPage;