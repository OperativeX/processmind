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
      title: 'Transcription',
      icon: <TranscriptIcon />,
      features: [
        {
          title: 'OpenAI Whisper Integration',
          description: 'State-of-the-art speech recognition for accurate transcriptions in multiple languages.',
        },
        {
          title: 'Timestamped Segments',
          description: 'Navigate your content easily with precise timestamps for every spoken segment.',
        },
        {
          title: 'Speaker Diarization',
          description: 'Automatically identify and label different speakers in your videos.',
        },
        {
          title: 'Custom Vocabulary',
          description: 'Add industry-specific terms and names for improved accuracy.',
        },
      ],
    },
    {
      title: 'AI Analysis',
      icon: <SmartToyIcon />,
      features: [
        {
          title: 'Automatic Tagging',
          description: 'AI extracts relevant tags and topics from your content for easy categorization.',
        },
        {
          title: 'Todo Extraction',
          description: 'Automatically identify action items and tasks mentioned in your videos.',
        },
        {
          title: 'Smart Summaries',
          description: 'Get concise, AI-generated summaries of your video content.',
        },
        {
          title: 'Sentiment Analysis',
          description: 'Understand the tone and emotion in your video content.',
        },
      ],
    },
    {
      title: 'Organization',
      icon: <HubIcon />,
      features: [
        {
          title: 'Knowledge Graph',
          description: 'Visualize connections between your videos through interactive graph views.',
        },
        {
          title: 'Smart Collections',
          description: 'Organize videos into collections based on tags, topics, or custom criteria.',
        },
        {
          title: 'Advanced Search',
          description: 'Find any content instantly with full-text search across all transcripts.',
        },
        {
          title: 'Custom Metadata',
          description: 'Add custom fields and properties to organize content your way.',
        },
      ],
    },
    {
      title: 'Collaboration',
      icon: <ShareIcon />,
      features: [
        {
          title: 'Team Workspaces',
          description: 'Create shared workspaces for teams to collaborate on video content.',
        },
        {
          title: 'Secure Sharing',
          description: 'Share videos and insights with controlled access and permissions.',
        },
        {
          title: 'Comments & Annotations',
          description: 'Add comments and annotations to specific moments in videos.',
        },
        {
          title: 'Version Control',
          description: 'Track changes and maintain version history for collaborative editing.',
        },
      ],
    },
  ];

  const integrations = [
    { name: 'Obsidian', logo: '🔮' },
    { name: 'Notion', logo: '📝' },
    { name: 'Slack', logo: '💬' },
    { name: 'Google Drive', logo: '☁️' },
    { name: 'Zapier', logo: '⚡' },
    { name: 'API', logo: '🔧' },
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
            Powerful Features for Video Intelligence
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '800px', mx: 'auto' }}
          >
            Everything you need to transform raw video content into structured, actionable knowledge.
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
            Why Choose ProcessLink?
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
                  Lightning Fast
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Process hours of video content in minutes with our optimized pipeline and priority processing.
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
                  AI-Powered
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Leverage cutting-edge AI models for transcription, analysis, and intelligent organization.
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
                  Secure & Private
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enterprise-grade security with end-to-end encryption. Your data stays yours, always.
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
            Seamless Integrations
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: '600px', mx: 'auto' }}
          >
            Connect ProcessLink with your favorite tools and workflows. Export your insights wherever you need them.
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
              Ready to unlock your video intelligence?
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400 }}
            >
              Join thousands of professionals transforming their video content into actionable knowledge.
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
              Start Your Free Trial
            </Button>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default FeaturesPage;