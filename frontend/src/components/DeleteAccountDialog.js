import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DeleteAccountDialog = ({ open, onClose }) => {
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuth();

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setUnderstood(false);
      setError('');
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!password || !understood) {
      setError('Please enter your password and confirm you understand');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.delete('/auth/account', {
        data: { password }
      });

      if (response.data.success) {
        // Logout and redirect to login page
        await logout();
        window.location.href = '/login';
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
          <WarningIcon sx={{ mr: 1 }} />
          Delete Account
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            This action cannot be undone!
          </Typography>
          <Typography variant="body2">
            Deleting your account will permanently remove:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            <li>All your processes and videos</li>
            <li>All transcripts and AI-generated content</li>
            <li>All team members and their data</li>
            <li>Your account and all settings</li>
          </Box>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          type="password"
          label="Confirm your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
          disabled={loading}
          autoComplete="current-password"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              disabled={loading}
              color="error"
            />
          }
          label="I understand that this action is permanent and cannot be undone"
          sx={{ mt: 2, '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          color="error"
          variant="contained"
          disabled={!password || !understood || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Deleting...' : 'Delete Account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteAccountDialog;