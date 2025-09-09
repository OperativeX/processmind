import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
} from '@mui/material';
import { 
  Error as ErrorIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon 
} from '@mui/icons-material';

const NotFoundPage = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            textAlign: 'center',
            p: 6,
            borderRadius: 2,
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 120,
              color: 'error.main',
              mb: 2,
            }}
          />
          
          <Typography
            variant="h1"
            sx={{
              fontSize: '6rem',
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            404
          </Typography>
          
          <Typography variant="h4" gutterBottom>
            Page Not Found
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            The page you're looking for doesn't exist or has been moved.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              component={RouterLink}
              to="/dashboard"
              variant="contained"
              startIcon={<HomeIcon />}
              size="large"
            >
              Go to Dashboard
            </Button>
            
            <Button
              onClick={() => window.history.back()}
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              size="large"
            >
              Go Back
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default NotFoundPage;