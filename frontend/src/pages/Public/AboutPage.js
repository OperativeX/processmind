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
      title: 'Innovation First',
      description: 'We leverage cutting-edge AI technology to transform how people interact with video content.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 32 }} />,
      title: 'Privacy by Design',
      description: 'Your data belongs to you. We build with privacy and security at the core of everything.',
    },
    {
      icon: <GroupsIcon sx={{ fontSize: 32 }} />,
      title: 'User-Centric',
      description: 'Every feature is designed with our users in mind, focusing on real workflows and needs.',
    },
    {
      icon: <RocketLaunchIcon sx={{ fontSize: 32 }} />,
      title: 'Continuous Growth',
      description: 'We constantly evolve and improve, driven by user feedback and technological advances.',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Videos Processed' },
    { value: '10K+', label: 'Active Users' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9/5', label: 'User Rating' },
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
            Building the Future of Video Knowledge
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            sx={{ mb: 8, fontWeight: 400, maxWidth: '800px', mx: 'auto' }}
          >
            ProcessLink was born from a simple idea: what if every video could become a searchable, 
            organized knowledge asset? We're making that vision a reality.
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
                Our Mission
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, lineHeight: 1.8 }}
              >
                In a world overflowing with video content, valuable insights get lost in hours of footage. 
                ProcessLink exists to unlock this hidden knowledge, making it accessible, searchable, and actionable.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, lineHeight: 1.8 }}
              >
                We believe that AI should augment human intelligence, not replace it. Our tools help professionals 
                extract maximum value from their video content, whether it's meetings, lectures, tutorials, or research.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.8 }}
              >
                By combining state-of-the-art AI with thoughtful design, we're building a second brain for video content - 
                one that remembers everything, connects ideas, and helps you work smarter.
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
                <Typography variant="h1" sx={{ fontSize: '120px', opacity: 0.1 }}>
                  🧠
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
            Our Values
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
            ProcessLink in Numbers
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
              Join Us on This Journey
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, fontWeight: 400 }}
            >
              Be part of the revolution in video knowledge management. 
              Start transforming your content today.
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
                Get Started Free
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
                Contact Us
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default AboutPage;