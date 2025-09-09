import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Share as ShareIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { favoriteListAPI, userAPI } from '../../services/api';

const ShareListDialogNew = ({ open, onClose, favoriteList }) => {
  const { user, tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [emailValid, setEmailValid] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailChange = async (value) => {
    setEmail(value);
    setEmailValid(null);
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return;
    }
    
    // Check if email exists in tenant
    setChecking(true);
    try {
      const response = await userAPI.checkEmailExists(tenant.id, value);
      setEmailValid(response.data.data.exists);
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailValid(false);
    } finally {
      setChecking(false);
    }
  };

  const handleShare = async () => {
    if (!emailValid || !email) return;
    
    setSubmitting(true);
    try {
      await favoriteListAPI.shareList(tenant.id, favoriteList.id, {
        email,
        message
      });
      
      showNotification('Einladung erfolgreich gesendet', 'success');
      onClose();
      setEmail('');
      setMessage('');
      setEmailValid(null);
    } catch (error) {
      showNotification(
        error.response?.data?.message || 'Fehler beim Senden der Einladung',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getEmailIcon = () => {
    if (checking) {
      return <CircularProgress size={20} />;
    }
    if (emailValid === true) {
      return <CheckCircleIcon color="success" />;
    }
    if (emailValid === false && email) {
      return <CancelIcon color="error" />;
    }
    return null;
  };

  const getHelperText = () => {
    if (!email) return 'Geben Sie die E-Mail-Adresse des Empfängers ein';
    if (checking) return 'Überprüfe E-Mail...';
    if (emailValid === true) return 'Benutzer gefunden - Sie können die Liste teilen';
    if (emailValid === false) return 'Kein Benutzer mit dieser E-Mail in Ihrer Organisation gefunden';
    return '';
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: '#161b22', border: '1px solid #30363d' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <ShareIcon />
          Liste "{favoriteList?.name}" teilen
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Der Empfänger erhält eine Benachrichtigung und kann die Liste als Kopie in seinen Favoriten speichern.
        </Alert>
        
        <TextField
          fullWidth
          label="E-Mail-Adresse"
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          helperText={getHelperText()}
          sx={{ mb: 3 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {getEmailIcon()}
              </InputAdornment>
            )
          }}
          error={emailValid === false && email !== ''}
        />
        
        <TextField
          fullWidth
          label="Nachricht (optional)"
          multiline
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Fügen Sie eine persönliche Nachricht hinzu..."
          helperText={`${message.length}/500 Zeichen`}
          inputProps={{ maxLength: 500 }}
        />
        
        <Box mt={3} p={2} sx={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Was passiert beim Teilen:</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>Der Empfänger erhält eine Kopie Ihrer Liste</li>
            <li>Die Kopie ist unabhängig - Änderungen betreffen nur die jeweilige Kopie</li>
            <li>Der Empfänger kann seine Kopie frei bearbeiten</li>
            <li>Ihre Original-Liste bleibt unverändert</li>
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Abbrechen
        </Button>
        <Button 
          onClick={handleShare}
          variant="contained"
          disabled={!emailValid || submitting || !email}
          startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
          sx={{ 
            backgroundColor: '#7c3aed',
            '&:hover': { backgroundColor: '#6d28d9' }
          }}
        >
          {submitting ? 'Sende...' : 'Einladung senden'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareListDialogNew;