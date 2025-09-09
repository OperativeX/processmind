import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { favoriteListAPI } from '../../services/api';
import ShareListDialogNew from './ShareListDialogNew';
import { 
  extractResponseData, 
  ensureArray, 
  extractErrorMessage 
} from '../../utils/apiHelpers';

const FavoriteListManager = () => {
  const { user, tenant } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#7c3aed'
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const loadLists = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await favoriteListAPI.getFavoriteLists(
          tenant.id, 
          { signal: controller.signal }
        );
        
        if (isMounted) {
          const data = extractResponseData(response, 'data.data');
          setFavoriteLists(ensureArray(data));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        
        if (isMounted) {
          const errorMessage = extractErrorMessage(error);
          console.error('Error fetching favorite lists:', error);
          setError(errorMessage);
          showNotification(errorMessage, 'error');
          setFavoriteLists([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadLists();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [tenant.id]);

  const fetchFavoriteLists = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await favoriteListAPI.getFavoriteLists(tenant.id);
      const data = extractResponseData(response, 'data.data');
      setFavoriteLists(ensureArray(data));
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      console.error('Error fetching favorite lists:', error);
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      setFavoriteLists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    try {
      const response = await favoriteListAPI.createFavoriteList(tenant.id, formData);
      
      if (response.data?.success) {
        showNotification('Favoriten-Liste erfolgreich erstellt', 'success');
        setCreateDialogOpen(false);
        resetForm();
        fetchFavoriteLists();
      } else {
        throw new Error('Erstellen fehlgeschlagen');
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
    }
  };

  const handleUpdateList = async () => {
    try {
      const response = await favoriteListAPI.updateFavoriteList(tenant.id, editingListId, formData);
      
      if (response.data?.success) {
        showNotification('Favoriten-Liste erfolgreich aktualisiert', 'success');
        setEditDialogOpen(false);
        resetForm();
        setSelectedList(null);
        setEditingListId(null);
        fetchFavoriteLists();
      } else {
        throw new Error('Aktualisierung fehlgeschlagen');
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
    }
  };

  const handleDeleteList = async (listId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Liste löschen möchten?')) {
      try {
        const response = await favoriteListAPI.deleteFavoriteList(tenant.id, listId);
        
        if (response.data?.success) {
          showNotification('Favoriten-Liste erfolgreich gelöscht', 'success');
          // Remove from state immediately for better UX
          setFavoriteLists(prev => prev.filter(list => list.id !== listId));
        } else {
          throw new Error('Löschen fehlgeschlagen');
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        showNotification(errorMessage, 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#7c3aed'
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (list) => {
    setFormData({
      name: list.name,
      description: list.description || '',
      color: list.color
    });
    setSelectedList(list);
    setEditingListId(list.id);
    setEditDialogOpen(true);
  };

  const handleMenuClick = (event, list) => {
    setMenuAnchor(event.currentTarget);
    setSelectedList(list);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedList(null);
  };

  const getListIcon = (list) => {
    if (list.isPublic) return <PublicIcon />;
    if (list.sharedWith && list.sharedWith.length > 0) return <GroupIcon />;
    return <LockIcon />;
  };

  const getPermissionText = (permission) => {
    switch (permission) {
      case 'owner': return 'Eigentümer';
      case 'edit': return 'Bearbeiten';
      case 'view': return 'Anzeigen';
      default: return permission;
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 300 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && favoriteLists.length === 0) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={fetchFavoriteLists}
            >
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Favoriten-Listen
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
          sx={{ 
            backgroundColor: '#7c3aed',
            '&:hover': { backgroundColor: '#6d28d9' }
          }}
        >
          Neue Liste
        </Button>
      </Box>

      {favoriteLists.length === 0 ? (
        <Alert severity="info">
          Sie haben noch keine Favoriten-Listen erstellt. Erstellen Sie Ihre erste Liste, um Prozesse zu organisieren!
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {favoriteLists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list.id}>
              <Card 
                sx={{ 
                  borderLeft: `4px solid ${list.color}`,
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { 
                    borderColor: list.color,
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => navigate(`/favorites/${list.id}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <FolderIcon sx={{ color: list.color }} />
                      <Typography variant="h6" component="h3" color="white">
                        {list.name}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, list);
                      }}
                      sx={{ color: 'white' }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  {list.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {list.description}
                    </Typography>
                  )}

                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      {list.processCount || list.processes?.length || 0} Prozesse
                    </Typography>
                  </Box>

                  <Box display="flex" gap={1}>
                    <Chip
                      size="small"
                      label={list.isOwner ? 'Eigentümer' : getPermissionText(list.permission)}
                      color={list.isOwner ? 'primary' : 'default'}
                      sx={{ fontSize: '0.75rem' }}
                    />
                    {list.isPublic && (
                      <Chip
                        size="small"
                        label="Öffentlich"
                        color="info"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    )}
                  </Box>
                </CardContent>

                {list.isOwner && (
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<ShareIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedList(list);
                        setShareDialogOpen(true);
                      }}
                      sx={{ color: 'text.secondary' }}
                    >
                      Teilen
                    </Button>
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { openEditDialog(selectedList); handleMenuClose(); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Bearbeiten
        </MenuItem>
        
        {selectedList?.isOwner && (
          <MenuItem onClick={() => { setShareDialogOpen(true); handleMenuClose(); }}>
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            Freigabe verwalten
          </MenuItem>
        )}
        
        {selectedList?.isOwner && (
          <MenuItem 
            onClick={() => { handleDeleteList(selectedList.id); handleMenuClose(); }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Löschen
          </MenuItem>
        )}
      </Menu>

      {/* Create Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { backgroundColor: '#161b22', border: '1px solid #30363d' }
        }}
      >
        <DialogTitle>Neue Favoriten-Liste erstellen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Listen-Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Beschreibung (optional)"
            multiline
            rows={3}
            fullWidth
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Farbe"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            sx={{ mb: 2, width: 120 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
          <Button 
            onClick={handleCreateList}
            variant="contained"
            disabled={!formData.name.trim()}
            sx={{ 
              backgroundColor: '#7c3aed',
              '&:hover': { backgroundColor: '#6d28d9' }
            }}
          >
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setEditingListId(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { backgroundColor: '#161b22', border: '1px solid #30363d' }
        }}
      >
        <DialogTitle>Favoriten-Liste bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Listen-Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Beschreibung (optional)"
            multiline
            rows={3}
            fullWidth
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Farbe"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            sx={{ mb: 2, width: 120 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditingListId(null);
          }}>Abbrechen</Button>
          <Button 
            onClick={handleUpdateList}
            variant="contained"
            disabled={!formData.name.trim()}
            sx={{ 
              backgroundColor: '#7c3aed',
              '&:hover': { backgroundColor: '#6d28d9' }
            }}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <ShareListDialogNew
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        favoriteList={selectedList}
      />
    </Box>
  );
};

export default FavoriteListManager;