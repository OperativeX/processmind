import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Alert,
  Breadcrumbs,
  Link,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  Remove as RemoveIcon,
  Share as ShareIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import Layout from '../../components/Layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { favoriteListAPI } from '../../services/api';
import { 
  extractResponseData, 
  ensureArray, 
  ensureObject,
  extractErrorMessage,
  createAbortController 
} from '../../utils/apiHelpers';

const FavoriteListDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const { showNotification } = useNotification();
  
  const [favoriteList, setFavoriteList] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [availableProcesses, setAvailableProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [abortController, setAbortController] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setAbortController(controller);
    
    // Load data sequentially
    loadListData(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [id]);

  const loadListData = async (signal) => {
    try {
      setLoading(true);
      setError(null);
      
      // First validate and clean the list
      const validateResponse = await favoriteListAPI.validateAndCleanList(tenant.id, id, { signal });
      const validateData = extractResponseData(validateResponse, 'data.data');
      
      if (validateData?.cleaned) {
        showNotification(`${validateData.removedCount} gelöschte Prozesse wurden aus der Liste entfernt`, 'info');
      }
      
      // Load processes in list (this endpoint returns both list and processes)
      const response = await favoriteListAPI.getProcessesInList(tenant.id, id, { signal });
      
      const data = extractResponseData(response, 'data.data');
      
      if (data) {
        // Safely extract list and processes
        const list = ensureObject(data.list);
        const processList = ensureArray(data.processes);
        
        if (list && list.id) {
          setFavoriteList(list);
          setProcesses(processList);
        } else {
          // If no list data, try to fetch it separately
          const listResponse = await favoriteListAPI.getFavoriteList(tenant.id, id, { signal });
          const listData = extractResponseData(listResponse, 'data.data');
          
          if (listData) {
            setFavoriteList(listData);
            setProcesses(processList);
          } else {
            throw new Error('Favoriten-Liste nicht gefunden');
          }
        }
      } else {
        throw new Error('Keine Daten empfangen');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      
      const errorMessage = extractErrorMessage(error);
      console.error('Error loading list data:', error);
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      
      // Navigate back if list not found
      if (error.response?.status === 404) {
        navigate('/favorites');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProcesses = async () => {
    try {
      const controller = createAbortController();
      const response = await favoriteListAPI.getAvailableProcesses(
        tenant.id, 
        id, 
        { signal: controller.controller.signal }
      );
      
      const data = extractResponseData(response, 'data.data');
      setAvailableProcesses(ensureArray(data));
      
      return controller.cleanup;
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      const errorMessage = extractErrorMessage(error);
      console.error('Error loading available processes:', error);
      showNotification(errorMessage, 'error');
      setAvailableProcesses([]);
    }
  };

  const handleAddProcesses = async () => {
    if (selectedProcesses.length === 0) return;
    
    try {
      const response = await favoriteListAPI.bulkAddProcesses(tenant.id, id, selectedProcesses);
      
      if (response.data?.success) {
        showNotification(
          `${selectedProcesses.length} Prozess(e) zur Liste hinzugefügt`,
          'success'
        );
        setAddDialogOpen(false);
        setSelectedProcesses([]);
        
        // Reload list data
        if (abortController) {
          loadListData(abortController.signal);
        }
      } else {
        throw new Error('Hinzufügen fehlgeschlagen');
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
    }
  };

  const handleRemoveProcess = async (processId) => {
    try {
      const response = await favoriteListAPI.removeProcessFromList(tenant.id, id, processId);
      
      if (response.data?.success) {
        showNotification('Prozess aus der Liste entfernt', 'success');
        
        // Remove from state immediately for better UX
        setProcesses(prev => prev.filter(p => p.id !== processId));
        
        // Update favorite list process count
        setFavoriteList(prev => ({
          ...prev,
          processCount: prev.processCount - 1
        }));
      } else {
        throw new Error('Entfernen fehlgeschlagen');
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      showNotification(errorMessage, 'error');
    }
  };

  const handleProcessSelect = (processId) => {
    setSelectedProcesses(prev => 
      prev.includes(processId)
        ? prev.filter(id => id !== processId)
        : [...prev, processId]
    );
  };

  const openAddDialog = () => {
    fetchAvailableProcesses();
    setAddDialogOpen(true);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'processing': return 'In Bearbeitung';
      case 'failed': return 'Fehler';
      default: return status;
    }
  };

  const getPermissionText = (permission) => {
    switch (permission) {
      case 'owner': return 'Eigentümer';
      case 'edit': return 'Bearbeiten';
      case 'view': return 'Anzeigen';
      default: return permission;
    }
  };

  if (loading && !favoriteList) {
    return (
      <Layout>
        <Box sx={{ 
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          color: '#f0f6fc',
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Lade Favoriten-Liste...</Typography>
          </Box>
        </Box>
      </Layout>
    );
  }

  if (error && !favoriteList) {
    return (
      <Layout>
        <Box sx={{ 
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          color: '#f0f6fc',
          p: 3
        }}>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => navigate('/favorites')}
              >
                Zurück
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      </Layout>
    );
  }

  if (!favoriteList) {
    return (
      <Layout>
        <Box sx={{ 
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          color: '#f0f6fc',
          p: 3
        }}>
          <Alert severity="warning">Favoriten-Liste nicht gefunden</Alert>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ 
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#f0f6fc',
        p: 3
      }}>
        {/* Header */}
        <Box mb={3}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link 
              color="inherit" 
              href="/favorites"
              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Favoriten-Listen
            </Link>
            <Typography color="text.primary">{favoriteList.name}</Typography>
          </Breadcrumbs>
          
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Typography variant="h4" component="h1" sx={{ color: favoriteList.color }}>
                  {favoriteList.name}
                </Typography>
                <Chip
                  size="small"
                  label={getPermissionText(favoriteList.permission)}
                  color={favoriteList.isOwner ? 'primary' : 'default'}
                />
              </Box>
              {favoriteList.description && (
                <Typography variant="body1" color="text.secondary">
                  {favoriteList.description}
                </Typography>
              )}
            </Box>
            
            <Box display="flex" gap={2}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/favorites')}
              >
                Zurück
              </Button>
              {(favoriteList.permission === 'owner' || favoriteList.permission === 'edit') && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openAddDialog}
                  sx={{ 
                    backgroundColor: favoriteList.color,
                    '&:hover': { backgroundColor: favoriteList.color + 'dd' }
                  }}
                >
                  Prozesse hinzufügen
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#30363d' }} />

        {/* Processes Grid */}
        {processes.length === 0 ? (
          <Alert severity="info">
            Diese Liste enthält noch keine Prozesse. 
            {(favoriteList.permission === 'owner' || favoriteList.permission === 'edit') && 
              ' Fügen Sie Prozesse hinzu, um loszulegen!'
            }
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {processes.map((process) => (
              <Grid item xs={12} sm={6} md={4} key={process.id}>
                <Card 
                  sx={{ 
                    backgroundColor: '#161b22',
                    border: '1px solid #30363d',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      borderColor: favoriteList.color,
                      transform: 'translateY(-2px)',
                      boxShadow: 4
                    }
                  }}
                  onClick={() => navigate(`/processes/${process.id}`)}
                >
                  {process.files?.processed && (
                    <CardMedia
                      component="video"
                      height="140"
                      src={process.files.processed.url}
                      sx={{ objectFit: 'cover' }}
                    />
                  )}
                  
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h3" color="white" noWrap>
                        {process.title}
                      </Typography>
                      {(favoriteList.permission === 'owner' || favoriteList.permission === 'edit') && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchor(e.currentTarget);
                            setSelectedProcess(process);
                          }}
                          sx={{ color: 'white' }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Chip
                        label={getStatusText(process.status)}
                        color={getStatusColor(process.status)}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(process.createdAt).toLocaleDateString('de-DE')}
                      </Typography>
                    </Box>

                    {process.tags && process.tags.length > 0 && (
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {process.tags.slice(0, 3).map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag.name}
                            size="small"
                            variant={tag.weight >= 0.7 ? "filled" : "outlined"}
                            color={tag.weight >= 0.7 ? "primary" : "default"}
                            sx={{ 
                              fontSize: '0.7rem',
                              fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal'
                            }}
                          />
                        ))}
                        {process.tags.length > 3 && (
                          <Chip
                            label={`+${process.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    )}
                  </CardContent>

                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Process Actions Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => { setMenuAnchor(null); setSelectedProcess(null); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem 
            onClick={() => {
              handleRemoveProcess(selectedProcess.id);
              setMenuAnchor(null);
              setSelectedProcess(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <RemoveIcon fontSize="small" sx={{ mr: 1 }} />
            Aus Liste entfernen
          </MenuItem>
        </Menu>

        {/* Add Processes Dialog */}
        <Dialog 
          open={addDialogOpen} 
          onClose={() => setAddDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { backgroundColor: '#161b22', border: '1px solid #30363d' }
          }}
        >
          <DialogTitle>
            Prozesse zu "{favoriteList?.name}" hinzufügen
          </DialogTitle>
          <DialogContent>
            {availableProcesses.length === 0 ? (
              <Alert severity="info">
                Alle verfügbaren Prozesse sind bereits in dieser Liste enthalten.
              </Alert>
            ) : (
              <List>
                {availableProcesses.map((process) => (
                  <ListItem key={process.id}>
                    <ListItemText
                      primary={process.title}
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(process.createdAt).toLocaleDateString('de-DE')}
                          </Typography>
                          {process.tags && process.tags.length > 0 && (
                            <Box mt={1}>
                              {process.tags.slice(0, 3).map((tag, index) => (
                                <Chip
                                  key={index}
                                  label={tag.name}
                                  size="small"
                                  variant={tag.weight >= 0.7 ? "filled" : "outlined"}
                                  color={tag.weight >= 0.7 ? "primary" : "default"}
                                  sx={{ 
                                    mr: 0.5, 
                                    fontSize: '0.7rem',
                                    fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal'
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Checkbox
                        checked={selectedProcesses.includes(process.id)}
                        onChange={() => handleProcessSelect(process.id)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>Abbrechen</Button>
            <Button 
              onClick={handleAddProcesses}
              variant="contained"
              disabled={selectedProcesses.length === 0}
              sx={{ 
                backgroundColor: favoriteList?.color || '#7c3aed',
                '&:hover': { backgroundColor: (favoriteList?.color || '#7c3aed') + 'dd' }
              }}
            >
              {selectedProcesses.length} Prozess(e) hinzufügen
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default FavoriteListDetailPage;