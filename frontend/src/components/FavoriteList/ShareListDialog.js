import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';
import {
  Person as PersonIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Public as PublicIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../services/api';

const ShareListDialog = ({ open, onClose, favoriteList, onUpdate }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [tenantUsers, setTenantUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('view');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && favoriteList) {
      setIsPublic(favoriteList.isPublic);
      fetchTenantUsers();
    }
  }, [open, favoriteList]);

  const fetchTenantUsers = async () => {
    try {
      const response = await api.get(`/tenants/${user.tenantId}/users`);
      // Filter out current user and users already shared with
      const availableUsers = response.data.data.filter(u => 
        u.id !== user.userId && 
        !favoriteList.sharedWith?.some(share => share.userId.id === u.id)
      );
      setTenantUsers(availableUsers);
    } catch (error) {
      showNotification('Fehler beim Laden der Benutzer', 'error');
    }
  };

  const handleShareWithUser = async () => {
    if (!selectedUserId) return;

    try {
      setLoading(true);
      await api.post(`/tenants/${user.tenantId}/favorite-lists/${favoriteList.id}/share`, {
        shareWithUserId: selectedUserId,
        permission: selectedPermission
      });
      
      showNotification('Liste erfolgreich geteilt', 'success');
      setSelectedUserId('');
      setSelectedPermission('view');
      
      if (onUpdate) {
        onUpdate();
      }
      
      // Refresh user list
      fetchTenantUsers();
    } catch (error) {
      showNotification(
        error.response?.data?.message || 'Fehler beim Teilen der Liste',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await api.delete(`/tenants/${user.tenantId}/favorite-lists/${favoriteList.id}/share/${userId}`);
      showNotification('Freigabe erfolgreich entfernt', 'success');
      
      if (onUpdate) {
        onUpdate();
      }
      
      // Refresh user list
      fetchTenantUsers();
    } catch (error) {
      showNotification('Fehler beim Entfernen der Freigabe', 'error');
    }
  };

  const handlePublicToggle = async (checked) => {
    try {
      await api.put(`/tenants/${user.tenantId}/favorite-lists/${favoriteList.id}`, {
        ...favoriteList,
        isPublic: checked
      });
      
      setIsPublic(checked);
      showNotification(
        checked ? 'Liste ist nun öffentlich' : 'Liste ist nun privat',
        'success'
      );
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      showNotification('Fehler beim Ändern der Sichtbarkeit', 'error');
    }
  };

  const getPermissionText = (permission) => {
    switch (permission) {
      case 'view': return 'Anzeigen';
      case 'edit': return 'Bearbeiten';
      default: return permission;
    }
  };

  const getPermissionColor = (permission) => {
    switch (permission) {
      case 'edit': return 'primary';
      case 'view': return 'default';
      default: return 'default';
    }
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
          <ShareIcon />
          Liste "{favoriteList?.name}" teilen
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Public Toggle */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isPublic}
                onChange={(e) => handlePublicToggle(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <PublicIcon fontSize="small" />
                <Typography>Öffentlich für alle Tenant-Benutzer</Typography>
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
            Wenn aktiviert, können alle Benutzer Ihrer Organisation diese Liste einsehen.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Share with Specific Users */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon />
            Spezifische Benutzer
          </Typography>
          
          <Box display="flex" gap={2} sx={{ mb: 2 }}>
            <FormControl sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel>Benutzer auswählen</InputLabel>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                label="Benutzer auswählen"
              >
                {tenantUsers.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Berechtigung</InputLabel>
              <Select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value)}
                label="Berechtigung"
              >
                <MenuItem value="view">Anzeigen</MenuItem>
                <MenuItem value="edit">Bearbeiten</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={handleShareWithUser}
              disabled={!selectedUserId || loading}
              sx={{ 
                backgroundColor: '#7c3aed',
                '&:hover': { backgroundColor: '#6d28d9' }
              }}
            >
              Teilen
            </Button>
          </Box>

          {tenantUsers.length === 0 && (
            <Alert severity="info">
              Alle verfügbaren Benutzer haben bereits Zugriff auf diese Liste.
            </Alert>
          )}
        </Box>

        {/* Current Shares */}
        {favoriteList?.sharedWith && favoriteList.sharedWith.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Aktuelle Freigaben
            </Typography>
            
            <List>
              {favoriteList.sharedWith.map((share) => (
                <ListItem key={share.userId.id}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <PersonIcon fontSize="small" />
                        <Typography>{share.userId.fullName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          ({share.userId.email})
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box mt={1}>
                        <Chip
                          label={getPermissionText(share.permission)}
                          color={getPermissionColor(share.permission)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Geteilt am {new Date(share.sharedAt).toLocaleDateString('de-DE')}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      onClick={() => handleRemoveUser(share.userId.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareListDialog;