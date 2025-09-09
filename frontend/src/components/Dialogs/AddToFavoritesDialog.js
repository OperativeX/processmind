import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  CircularProgress,
  Alert
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { favoriteListAPI } from '../../services/api';
import { extractResponseData, ensureArray, extractErrorMessage } from '../../utils/apiHelpers';

const AddToFavoritesDialog = ({ 
  open, 
  onClose, 
  processId, 
  processTitle,
  onSuccess 
}) => {
  const { tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedFavoriteLists, setSelectedFavoriteLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load favorite lists when dialog opens
  useEffect(() => {
    if (open && tenant?.id) {
      loadFavoriteLists();
    }
  }, [open, tenant?.id]);

  // Clear selections when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedFavoriteLists([]);
      setFavoriteLists([]);
    }
  }, [open]);

  const loadFavoriteLists = async () => {
    setLoading(true);
    const controller = new AbortController();
    
    try {
      const response = await favoriteListAPI.getFavoriteLists(
        tenant.id,
        { signal: controller.signal }
      );
      
      const data = extractResponseData(response, 'data.data');
      const lists = ensureArray(data);
      
      // Filter lists where user has edit permissions
      const editableLists = lists.filter(list => 
        list.isOwner || list.permission === 'owner' || list.permission === 'edit'
      );
      
      setFavoriteLists(editableLists);
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      console.error('Error loading favorite lists:', error);
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
    
    return () => controller.abort();
  };

  const handleListSelect = (listId) => {
    setSelectedFavoriteLists(prev =>
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  const handleAddToLists = async () => {
    if (selectedFavoriteLists.length === 0 || !processId) return;

    setSubmitting(true);
    
    try {
      const promises = selectedFavoriteLists.map(listId =>
        favoriteListAPI.addProcessToList(tenant.id, listId, processId)
      );
      
      const results = await Promise.all(promises);
      
      const allSuccessful = results.every(response => 
        response.data && response.data.success !== false
      );
      
      if (allSuccessful) {
        showNotification(
          `Prozess zu ${selectedFavoriteLists.length} Liste(n) hinzugefügt`,
          'success'
        );
        
        if (onSuccess) {
          onSuccess(selectedFavoriteLists);
        }
        
        onClose();
      } else {
        showNotification(
          'Einige Listen konnten nicht aktualisiert werden',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getProcessCount = (list) => {
    // Fallback chain for process count
    return list.processCount || 
           list.metadata?.processCount || 
           list.processes?.length || 
           0;
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
        Zu Favoriten-Listen hinzufügen
      </DialogTitle>
      
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {processTitle 
            ? `Wählen Sie die Listen aus, zu denen "${processTitle}" hinzugefügt werden soll:`
            : 'Wählen Sie die Listen aus, zu denen dieser Prozess hinzugefügt werden soll:'
          }
        </DialogContentText>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : favoriteLists.length === 0 ? (
          <Alert severity="info">
            Sie haben noch keine Favoriten-Listen erstellt oder keine Berechtigungen zum Bearbeiten.
          </Alert>
        ) : (
          <List>
            {favoriteLists.map((list) => (
              <ListItem 
                key={list.id || list._id}
                button
                onClick={() => handleListSelect(list.id || list._id)}
                sx={{
                  border: '1px solid #30363d',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    checked={selectedFavoriteLists.includes(list.id || list._id)}
                    color="primary"
                  />
                </ListItemIcon>
                <ListItemText 
                  primary={list.name}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip 
                        label={`${getProcessCount(list)} Prozesse`} 
                        size="small" 
                        variant="outlined"
                      />
                      {(list.isOwner || list.permission === 'owner') && (
                        <Chip 
                          label="Eigentümer" 
                          size="small" 
                          color="primary"
                        />
                      )}
                    </Box>
                  }
                />
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: list.color || '#7c3aed',
                    ml: 2
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose}
          disabled={submitting}
        >
          Abbrechen
        </Button>
        <Button 
          onClick={handleAddToLists}
          variant="contained"
          disabled={selectedFavoriteLists.length === 0 || submitting}
          sx={{ 
            backgroundColor: '#7c3aed',
            '&:hover': { backgroundColor: '#6d28d9' }
          }}
        >
          {submitting ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : null}
          Zu {selectedFavoriteLists.length} Liste(n) hinzufügen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToFavoritesDialog;