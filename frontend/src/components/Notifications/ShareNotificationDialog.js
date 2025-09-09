import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider
} from '@mui/material';
import {
  Person as PersonIcon,
  Folder as FolderIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  NotificationsActive as NotificationIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { notificationAPI } from '../../services/api';

const ShareNotificationDialog = ({ open, onClose }) => {
  const { user, tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [pendingShares, setPendingShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingShare, setProcessingShare] = useState(null);

  useEffect(() => {
    if (open) {
      fetchPendingShares();
    }
  }, [open]);

  const fetchPendingShares = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getPendingShares(tenant.id);
      setPendingShares(response.data.data);
    } catch (error) {
      showNotification('Fehler beim Laden der geteilten Listen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (shareId) => {
    setProcessingShare(shareId);
    try {
      const response = await notificationAPI.acceptShare(tenant.id, shareId);
      showNotification(
        `Liste "${response.data.data.listName}" wurde zu Ihren Favoriten hinzugefügt`,
        'success'
      );
      // Remove accepted share from list
      setPendingShares(prev => prev.filter(share => share.id !== shareId));
      
      // Close dialog if no more shares
      if (pendingShares.length <= 1) {
        setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      showNotification(
        error.response?.data?.message || 'Fehler beim Akzeptieren der Liste',
        'error'
      );
    } finally {
      setProcessingShare(null);
    }
  };

  const handleReject = async (shareId) => {
    setProcessingShare(shareId);
    try {
      await notificationAPI.rejectShare(tenant.id, shareId);
      showNotification('Einladung abgelehnt', 'info');
      // Remove rejected share from list
      setPendingShares(prev => prev.filter(share => share.id !== shareId));
      
      // Close dialog if no more shares
      if (pendingShares.length <= 1) {
        setTimeout(() => onClose(), 1000);
      }
    } catch (error) {
      showNotification('Fehler beim Ablehnen der Einladung', 'error');
    } finally {
      setProcessingShare(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: '#161b22', border: '1px solid #30363d' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationIcon color="primary" />
          <Typography variant="h6">
            Geteilte Listen
          </Typography>
          {pendingShares.length > 0 && (
            <Chip
              label={pendingShares.length}
              color="primary"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : pendingShares.length === 0 ? (
          <Alert severity="info">
            Keine ausstehenden Listen-Einladungen vorhanden.
          </Alert>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              Diese Listen wurden mit Ihnen geteilt. Wenn Sie akzeptieren, wird eine Kopie in Ihren Favoriten erstellt.
            </Alert>
            
            <List>
              {pendingShares.map((share, index) => (
                <React.Fragment key={share.id}>
                  {index > 0 && <Divider />}
                  <ListItem 
                    alignItems="flex-start"
                    sx={{ 
                      py: 2,
                      opacity: processingShare === share.id ? 0.5 : 1,
                      pointerEvents: processingShare ? 'none' : 'auto'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ backgroundColor: share.favoriteListId?.color || '#7c3aed' }}>
                        <FolderIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography variant="h6">
                            {share.favoriteListId?.name || share.listSnapshot?.name}
                          </Typography>
                          <Chip
                            label={`${share.listSnapshot?.processCount || 0} Prozesse`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {share.favoriteListId?.description && (
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              {share.favoriteListId.description}
                            </Typography>
                          )}
                          
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <PersonIcon fontSize="small" />
                            <Typography variant="body2">
                              Geteilt von: <strong>{share.fromUserId?.fullName || share.fromUserId?.email}</strong>
                            </Typography>
                          </Box>
                          
                          <Typography variant="caption" color="text.secondary">
                            Gesendet am: {formatDate(share.createdAt)}
                          </Typography>
                          
                          {share.message && (
                            <Box mt={1} p={1} sx={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                              <Typography variant="body2" fontStyle="italic">
                                "{share.message}"
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <Box display="flex" gap={1} alignItems="center" ml={2}>
                      <IconButton
                        color="success"
                        onClick={() => handleAccept(share.id)}
                        disabled={processingShare === share.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'success.main',
                          '&:hover': {
                            backgroundColor: 'success.main',
                            color: 'white'
                          }
                        }}
                      >
                        {processingShare === share.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <AcceptIcon />
                        )}
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleReject(share.id)}
                        disabled={processingShare === share.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'error.main',
                          '&:hover': {
                            backgroundColor: 'error.main',
                            color: 'white'
                          }
                        }}
                      >
                        <RejectIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          {pendingShares.length > 0 ? 'Später entscheiden' : 'Schließen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareNotificationDialog;