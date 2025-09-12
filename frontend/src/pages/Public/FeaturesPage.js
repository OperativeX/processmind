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
  Tab,
  Tabs,
  useTheme,
  alpha,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';
import TranscriptIcon from '@mui/icons-material/Subtitles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import HubIcon from '@mui/icons-material/Hub';
import ShareIcon from '@mui/icons-material/Share';
import SpeedIcon from '@mui/icons-material/Speed';
import LockIcon from '@mui/icons-material/Lock';

const FeaturesPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeTab, setActiveTab] = React.useState(0);

  const featureCategories = [
    {
      title: 'Transkription',
      icon: <TranscriptIcon />,
      features: [
        {
          title: 'OpenAI Whisper Integration',
          description: 'Modernste Spracherkennung für präzise Transkriptionen in mehreren Sprachen.',
        },
        {
          title: 'Zeitgestempelte Segmente',
          description: 'Navigieren Sie einfach durch Ihre Inhalte mit präzisen Zeitstempeln für jedes gesprochene Segment.',
        },
        {
          title: 'Sprecheridentifikation',
          description: 'Identifizieren und kennzeichnen Sie automatisch verschiedene Sprecher in Ihren Videos.',
        },
        {
          title: 'Benutzerdefiniertes Vokabular',
          description: 'Fügen Sie branchenspezifische Begriffe und Namen für verbesserte Genauigkeit hinzu.',
        },
      ],
    },
    {
      title: 'KI-Analyse',
      icon: <SmartToyIcon />,
      features: [
        {
          title: 'Automatisches Tagging',
          description: 'KI extrahiert relevante Tags und Themen aus Ihren Inhalten zur einfachen Kategorisierung.',
        },
        {
          title: 'Todo-Extraktion',
          description: 'Identifizieren Sie automatisch Aktionspunkte und Aufgaben, die in Ihren Videos erwähnt werden.',
        },
        {
          title: 'Intelligente Zusammenfassungen',
          description: 'Erhalten Sie prägnante, KI-generierte Zusammenfassungen Ihrer Videoinhalte.',
        },
        {
          title: 'Stimmungsanalyse',
          description: 'Verstehen Sie Ton und Emotionen in Ihren Videoinhalten.',
        },
      ],
    },
    {
      title: 'Organisation',
      icon: <HubIcon />,
      features: [
        {
          title: 'Wissensgraph',
          description: 'Visualisieren Sie Verbindungen zwischen Ihren Videos durch interaktive Graph-Ansichten.',
        },
        {
          title: 'Intelligente Sammlungen',
          description: 'Organisieren Sie Videos in Sammlungen basierend auf Tags, Themen oder benutzerdefinierten Kriterien.',
        },
        {
          title: 'Erweiterte Suche',
          description: 'Finden Sie jeden Inhalt sofort mit Volltextsuche über alle Transkripte.',
        },
        {
          title: 'Benutzerdefinierte Metadaten',
          description: 'Fügen Sie benutzerdefinierte Felder und Eigenschaften hinzu, um Inhalte nach Ihren Wünschen zu organisieren.',
        },
      ],
    },
    {
      title: 'Zusammenarbeit',
      icon: <ShareIcon />,
      features: [
        {
          title: 'Team-Arbeitsbereiche',
          description: 'Erstellen Sie gemeinsame Arbeitsbereiche für Teams zur Zusammenarbeit an Videoinhalten.',
        },
        {
          title: 'Sicheres Teilen',
          description: 'Teilen Sie Videos und Erkenntnisse mit kontrolliertem Zugriff und Berechtigungen.',
        },
        {
          title: 'Kommentare & Anmerkungen',
          description: 'Fügen Sie Kommentare und Anmerkungen zu bestimmten Momenten in Videos hinzu.',
        },
        {
          title: 'Versionskontrolle',
          description: 'Verfolgen Sie Änderungen und pflegen Sie die Versionshistorie für kollaboratives Bearbeiten.',
        },
      ],
    },
  ];

  const integrations = [
    { name: 'Obsidian', logo: 'O' },
    { name: 'Notion', logo: 'N' },
    { name: 'Slack', logo: 'S' },
    { name: 'Google Drive', logo: 'G' },
    { name: 'Zapier', logo: 'Z' },
    { name: 'API', logo: 'A' },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
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
            Leistungsstarke Funktionen für Video-Intelligenz
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '800px', mx: 'auto' }}
          >
            Alles, was Sie benötigen, um rohe Videoinhalte in strukturiertes, verwertbares Wissen zu verwandeln.
          </Typography>
        </Container>
      </Box>

      {/* Feature Categories */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mb: 6,
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: 3,
              },
            }}
          >
            {featureCategories.map((category, index) => (
              <Tab
                key={index}
                label={category.title}
                icon={category.icon}
                iconPosition="start"
                sx={{
                  minHeight: 64,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: activeTab === index ? 600 : 400,
                }}
              />
            ))}
          </Tabs>

          <Grid container spacing={4}>
            {featureCategories[activeTab].features.map((feature, index) => (
              <Grid item xs={12} md={6} key={index}>
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
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
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

      {/* Key Benefits Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ mb: 8, fontWeight: 600 }}>
            Warum ProcessLink wählen?
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    background: `linear-gradient(135deg, 
                      ${alpha(theme.palette.primary.main, 0.1)} 0%, 
                      ${alpha(theme.palette.primary.main, 0.2)} 100%)`,
                  }}
                >
                  <SpeedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Blitzschnell
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Verarbeiten Sie stundenlange Videoinhalte in Minuten mit unserer optimierten Pipeline und priorisierter Verarbeitung.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    background: `linear-gradient(135deg, 
                      ${alpha(theme.palette.success.main, 0.1)} 0%, 
                      ${alpha(theme.palette.success.main, 0.2)} 100%)`,
                  }}
                >
                  <SmartToyIcon sx={{ fontSize: 40, color: 'success.main' }} />
                </Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  KI-gestützt
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nutzen Sie modernste KI-Modelle für Transkription, Analyse und intelligente Organisation.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    background: `linear-gradient(135deg, 
                      ${alpha(theme.palette.info.main, 0.1)} 0%, 
                      ${alpha(theme.palette.info.main, 0.2)} 100%)`,
                  }}
                >
                  <LockIcon sx={{ fontSize: 40, color: 'info.main' }} />
                </Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Sicher & Privat
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sicherheit auf Unternehmensniveau mit Ende-zu-Ende-Verschlüsselung. Ihre Daten bleiben immer Ihre.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Integrations Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }} id="integrations">
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ mb: 3, fontWeight: 600 }}>
            Nahtlose Integrationen
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: '600px', mx: 'auto' }}
          >
            Verbinden Sie ProcessLink mit Ihren bevorzugten Tools und Workflows. Exportieren Sie Ihre Erkenntnisse, wo immer Sie sie benötigen.
          </Typography>
          <Grid container spacing={3} justifyContent="center">
            {integrations.map((integration, index) => (
              <Grid item xs={6} sm={4} md={2} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    textAlign: 'center',
                    p: 3,
                    backgroundColor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <Typography variant="h2" sx={{ mb: 1 }}>
                    {integration.logo}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {integration.name}
                  </Typography>
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
              Bereit, Ihre Video-Intelligenz freizuschalten?
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400 }}
            >
              Schließen Sie sich Tausenden von Profis an, die ihre Videoinhalte in verwertbares Wissen verwandeln.
            </Typography>
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
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default FeaturesPage;