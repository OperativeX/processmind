import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Button, 
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import {
  CheckCircleOutline as AcceptIcon,
  CancelOutlined as RejectIcon,
  FolderSpecial as FolderIcon
} from '@mui/icons-material';
import { notificationAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

const AcceptSharePage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Store the current URL to redirect after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      navigate('/login');
      return;
    }

    fetchShareData();
  }, [isAuthenticated, shareId]);

  const fetchShareData = async () => {
    try {
      setLoading(true);
      // Get share details
      const response = await notificationAPI.getShareDetails(tenant.id, shareId);
      setShareData(response.data.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Fehler beim Laden der geteilten Liste');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      const response = await notificationAPI.acceptShare(tenant.id, shareId);
      showNotification(
        `Liste "${response.data.data.listName}" wurde zu Ihren Favoriten hinzugefügt`,
        'success'
      );
      setTimeout(() => {
        navigate('/favorites');
      }, 2000);
    } catch (error) {
      showNotification(
        error.response?.data?.message || 'Fehler beim Akzeptieren der Liste',
        'error'
      );
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await notificationAPI.rejectShare(tenant.id, shareId);
      showNotification('Einladung abgelehnt', 'info');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      showNotification('Fehler beim Ablehnen der Einladung', 'error');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/dashboard')}
          fullWidth
        >
          Zum Dashboard
        </Button>
      </Container>
    );
  }

  if (!shareData) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="warning">
          Diese Einladung ist nicht mehr gültig oder wurde bereits bearbeitet.
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/dashboard')}
          fullWidth
          sx={{ mt: 2 }}
        >
          Zum Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
          <FolderIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1">
            Geteilte Liste
          </Typography>
        </Box>

        <Card sx={{ mb: 3, backgroundColor: 'action.hover' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom color="primary">
              {shareData.listSnapshot?.name || shareData.favoriteListId?.name}
            </Typography>
            
            {(shareData.listSnapshot?.description || shareData.favoriteListId?.description) && (
              <Typography variant="body1" paragraph>
                {shareData.listSnapshot?.description || shareData.favoriteListId?.description}
              </Typography>
            )}

            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Chip 
                label={`${shareData.listSnapshot?.processCount || 0} Prozesse`}
                color="primary"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                Geteilt von: <strong>{shareData.fromUserId?.fullName || shareData.fromUserId?.email}</strong>
              </Typography>
            </Box>

            {shareData.message && (
              <Box mt={2} p={2} sx={{ backgroundColor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Persönliche Nachricht:
                </Typography>
                <Typography variant="body1" fontStyle="italic">
                  "{shareData.message}"
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Alert severity="info" sx={{ mb: 3 }}>
          Wenn Sie diese Liste annehmen, wird eine Kopie in Ihren Favoriten erstellt. 
          Sie können die Liste dann bearbeiten, ohne die Original-Liste zu beeinflussen.
        </Alert>

        <Box display="flex" gap={2} justifyContent="center">
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<AcceptIcon />}
            onClick={handleAccept}
            disabled={processing}
            sx={{ minWidth: 150 }}
          >
            {processing ? <CircularProgress size={24} /> : 'Annehmen'}
          </Button>
          
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<RejectIcon />}
            onClick={handleReject}
            disabled={processing}
            sx={{ minWidth: 150 }}
          >
            {processing ? <CircularProgress size={24} /> : 'Ablehnen'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AcceptSharePage;