import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  CircularProgress,
  Alert
} from '@mui/material';
import { notificationAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

const RejectSharePage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Store the current URL to redirect after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      navigate('/login');
      return;
    }

    handleReject();
  }, [isAuthenticated, shareId]);

  const handleReject = async () => {
    try {
      setLoading(true);
      await notificationAPI.rejectShare(tenant.id, shareId);
      showNotification('Die Einladung wurde abgelehnt', 'info');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || 'Fehler beim Ablehnen der Einladung');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
            <CircularProgress />
            <Typography variant="h6">
              Einladung wird abgelehnt...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Alert severity="error">
            {error}
          </Alert>
        </Paper>
      </Container>
    );
  }

  return null;
};

export default RejectSharePage;