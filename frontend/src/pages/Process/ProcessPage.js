import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Menu,
  MenuItem,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as TimeIcon,
  Tag as TagIcon,
  Description as TranscriptIcon,
  Assignment as TodoIcon,
  MoreVert as MoreVertIcon,
  PlaylistAdd as PlaylistAddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { processAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { 
  formatBytes, 
  formatRelativeTime, 
  formatDuration,
  formatTimestamp,
  getStatusColor,
  getStatusText,
  copyToClipboard,
  downloadFile
} from '../../utils/helpers';
import LoadingScreen from '../../components/Common/LoadingScreen';
import { ProcessWebSocket } from '../../services/api';
import AddToFavoritesDialog from '../../components/Dialogs/AddToFavoritesDialog';
import TagEditor from '../../components/TagEditor/TagEditor';

const ProcessPage = () => {
  const { processId } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [rawTagInput, setRawTagInput] = useState('');
  const [editingTodoIndex, setEditingTodoIndex] = useState(null);
  const [editingTodoValue, setEditingTodoValue] = useState('');
  const [editingTodoTimestamp, setEditingTodoTimestamp] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [wsConnection, setWsConnection] = useState(null);
  const [videoToken, setVideoToken] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);

  // Fetch process details
  const { 
    data: processData, 
    isLoading: processLoading,
    error: processError,
    refetch: refetchProcess
  } = useQuery({
    queryKey: ['process', tenant?.id, processId],
    queryFn: async () => {
      const result = await processAPI.getProcess(tenant?.id, processId);
      return result.data.data; // Return the data object containing process
    },
    enabled: !!tenant?.id && !!processId,
    refetchInterval: (data) => {
      // Auto-refresh if still processing
      const process = data?.process;
      return process && !['completed', 'failed'].includes(process.status) ? 5000 : false;
    },
  });

  // Extract process from the data structure
  const process = processData?.process;
  
  // Debug logging for todo timestamps
  React.useEffect(() => {
    if (process?.todoList) {
      console.log('🔍 Todo timestamps debug:', process.todoList.map(todo => ({
        task: todo.task?.substring(0, 30) + '...',
        timestamp: todo.timestamp,
        timestampType: typeof todo.timestamp
      })));
    }
  }, [process?.todoList]);

  // Fetch video token when process is completed
  const { data: tokenData } = useQuery({
    queryKey: ['videoToken', tenant?.id, processId],
    queryFn: async () => {
      const result = await processAPI.getVideoToken(tenant?.id, processId);
      return result.data.data;
    },
    enabled: !!tenant?.id && !!processId && process?.status === 'completed',
    staleTime: 50 * 60 * 1000, // 50 minutes (token expires in 60)
    refetchInterval: 50 * 60 * 1000, // Auto-refresh every 50 minutes
  });

  // Update video URL when token changes
  useEffect(() => {
    if (tokenData?.token && tenant?.id && processId) {
      const url = processAPI.getVideoUrl(tenant.id, processId, tokenData.token);
      setVideoUrl(url);
      setVideoToken(tokenData.token);
    }
  }, [tokenData, tenant?.id, processId]);

  // Handle video token refresh on error
  const handleVideoError = async (error) => {
    console.error('Video playback error details:', {
      errorType: error.type,
      errorCode: error.target?.error?.code,
      errorMessage: error.target?.error?.message,
      networkState: error.target?.networkState,
      readyState: error.target?.readyState,
      currentSrc: error.target?.currentSrc
    });
    
    // MediaError codes:
    // 1 = MEDIA_ERR_ABORTED - fetching aborted
    // 2 = MEDIA_ERR_NETWORK - network error
    // 3 = MEDIA_ERR_DECODE - decoding error
    // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED - format not supported
    
    const errorCode = error.target?.error?.code;
    
    // If it's a network error or source not supported, try refreshing the token
    if (errorCode === 2 || errorCode === 4 || error.target?.networkState === 3) {
      try {
        showNotification('Refreshing video access...', 'info');
        // Invalidate and refetch the video token
        await queryClient.invalidateQueries(['videoToken', tenant?.id, processId]);
        // The query will automatically refetch due to invalidation
      } catch (refreshError) {
        console.error('Failed to refresh video token:', refreshError);
        showNotification('Video playback failed. Please try refreshing the page.', 'error');
      }
    } else {
      showNotification('Video playback failed. Please check your connection and try again.', 'error');
    }
  };

  // Update process mutation
  const updateProcessMutation = useMutation({
    mutationFn: (updates) => processAPI.updateProcess(tenant?.id, processId, updates),
    onSuccess: () => {
      showNotification('Process updated successfully', 'success');
      queryClient.invalidateQueries(['process', tenant?.id, processId]);
      setEditingField(null);
      setEditValues({});
      setRawTagInput('');
      setEditingTodoIndex(null);
      setEditingTodoValue('');
    },
    onError: (error) => {
      console.error('Update process error:', error.response?.data);
      const errorMsg = error.response?.data?.errors 
        ? error.response.data.errors.join(', ')
        : error.response?.data?.message || 'Failed to update process';
      showNotification(errorMsg, 'error');
    },
  });

  // Share link mutation
  const generateShareMutation = useMutation({
    mutationFn: () => processAPI.generateShareLink(tenant?.id, processId),
    onSuccess: (data) => {
      setShareLink(data.data.data.shareUrl);
      setShareDialogOpen(true);
    },
    onError: (error) => {
      showNotification(error.response?.data?.message || 'Failed to generate share link', 'error');
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!process || ['completed', 'failed'].includes(process.status)) {
      return;
    }

    const ws = new ProcessWebSocket(tenant?.id, processId);
    
    ws.on('update', (data) => {
      // Update the process data with real-time info
      queryClient.setQueryData(['process', tenant?.id, processId], (old) => ({
        ...old,
        data: {
          ...old.data,
          process: {
            ...old.data.process,
            status: data.status,
            progress: data.progress,
          }
        }
      }));
    });

    ws.on('completed', () => {
      refetchProcess();
    });

    ws.connect();
    setWsConnection(ws);

    return () => {
      ws.disconnect();
    };
  }, [process?.status, tenant?.id, processId, queryClient, refetchProcess]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleEdit = (field, currentValue) => {
    setEditingField(field);
    if (field === 'tags') {
      // For tags, we'll use the TagEditor component
      setEditValues({ [field]: currentValue });
    } else {
      setEditValues({ [field]: currentValue });
    }
  };

  const handleSave = () => {
    if (editingField === 'tags') {
      // Tags are already in the correct format from TagEditor
      updateProcessMutation.mutate({ tags: editValues.tags });
    } else {
      updateProcessMutation.mutate(editValues);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValues({});
    setRawTagInput('');
  };

  const handleSaveTags = (newTags) => {
    updateProcessMutation.mutate({ tags: newTags });
  };

  const sanitizeTodos = (todos) => {
    return todos.map(todo => ({
      task: todo.task,
      timestamp: todo.timestamp !== null && todo.timestamp !== undefined 
        ? (typeof todo.timestamp === 'string' ? parseFloat(todo.timestamp) : Number(todo.timestamp))
        : null,
      completed: Boolean(todo.completed)
    }));
  };

  const handleTodoToggle = (todoIndex) => {
    const updatedTodos = [...process.todoList];
    updatedTodos[todoIndex].completed = !updatedTodos[todoIndex].completed;
    
    updateProcessMutation.mutate({ todoList: sanitizeTodos(updatedTodos) });
  };

  const handleTodoEdit = (todoIndex) => {
    setEditingTodoIndex(todoIndex);
    setEditingTodoValue(process.todoList[todoIndex].task);
    setEditingTodoTimestamp(process.todoList[todoIndex].timestamp || null);
  };

  const handleTodoSave = (todoIndex) => {
    const updatedTodos = [...process.todoList];
    updatedTodos[todoIndex].task = editingTodoValue.trim();
    updatedTodos[todoIndex].timestamp = editingTodoTimestamp;
    
    if (updatedTodos[todoIndex].task) {
      updateProcessMutation.mutate({ todoList: sanitizeTodos(updatedTodos) });
      setEditingTodoIndex(null);
      setEditingTodoValue('');
      setEditingTodoTimestamp(null);
    }
  };

  const handleTodoCancel = () => {
    setEditingTodoIndex(null);
    setEditingTodoValue('');
    setEditingTodoTimestamp(null);
  };

  const setCurrentVideoTime = () => {
    setEditingTodoTimestamp(Math.round(videoCurrentTime));
  };

  const handleCopyTranscript = async () => {
    if (process?.transcript?.text) {
      const success = await copyToClipboard(process.transcript.text);
      if (success) {
        showNotification('Transcript copied to clipboard', 'success');
      } else {
        showNotification('Failed to copy transcript', 'error');
      }
    }
  };

  const handleDownloadTranscript = () => {
    if (process?.transcript?.text) {
      const filename = `${process.title || process.originalFilename}_transcript.txt`;
      downloadFile(process.transcript.text, filename, 'text/plain');
    }
  };

  const handleCopyShareLink = async () => {
    const success = await copyToClipboard(shareLink);
    if (success) {
      showNotification('Share link copied to clipboard', 'success');
    }
  };

  const jumpToTimestamp = (timestamp) => {
    const videoElement = document.getElementById('process-video');
    if (videoElement) {
      videoElement.currentTime = timestamp;
      videoElement.play();
    }
  };

  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleAddToFavoritesClick = () => {
    handleMenuClose();
    setFavoriteDialogOpen(true);
  };

  if (processLoading) {
    return <LoadingScreen message="Loading process details..." />;
  }

  if (processError) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        <AlertTitle>Error</AlertTitle>
        Failed to load process details. Please try again.
      </Alert>
    );
  }

  if (!process) {
    return (
      <Alert severity="warning" sx={{ m: 3 }}>
        <AlertTitle>Not Found</AlertTitle>
        Process not found.
      </Alert>
    );
  }

  const tabs = [
    { label: 'Overview', icon: <PlayIcon /> },
    { label: 'Transcript', icon: <TranscriptIcon /> },
    { label: 'Todo List', icon: <TodoIcon /> },
    { label: 'Details', icon: <TimeIcon /> },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {editingField === 'title' ? (
              <TextField
                value={editValues.title || ''}
                onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                variant="standard"
                sx={{ fontSize: 'h4.fontSize' }}
                autoFocus
              />
            ) : (
              process.title || process.originalFilename
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {editingField === 'title' ? (
              <>
                <IconButton onClick={handleSave} color="primary">
                  <SaveIcon />
                </IconButton>
                <IconButton onClick={handleCancel}>
                  <CancelIcon />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton 
                  onClick={() => handleEdit('title', process.title || process.originalFilename)}
                  color="primary"
                >
                  <EditIcon />
                </IconButton>
                <IconButton 
                  onClick={() => generateShareMutation.mutate()}
                  color="primary"
                  disabled={process.status !== 'completed'}
                >
                  <ShareIcon />
                </IconButton>
                <IconButton
                  onClick={handleMenuOpen}
                  color="primary"
                >
                  <MoreVertIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={getStatusText(process.status)}
            color={getStatusColor(process.status)}
          />
          <Typography variant="body2" color="text.secondary">
            Created {formatRelativeTime(process.createdAt)}
          </Typography>
          {process.files?.processed?.size && (
            <Typography variant="body2" color="text.secondary">
              {formatBytes(process.files.processed.size)}
            </Typography>
          )}
          {process.files?.original?.duration && (
            <Typography variant="body2" color="text.secondary">
              {formatDuration(process.files.original.duration)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Progress Bar for Processing */}
      {!['completed', 'failed'].includes(process.status) && process.progress && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Processing Status
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {process.progress.currentStep || 'Processing...'}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={process.progress.percentage || 0}
              sx={{ height: 8, borderRadius: 4, mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {process.progress.percentage || 0}% complete
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Video Player */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              {process.status === 'completed' && process.files?.processed && videoUrl ? (
                <video
                  id="process-video"
                  controls
                  width="100%"
                  style={{
                    maxHeight: '400px',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                  }}
                  onTimeUpdate={(e) => setVideoCurrentTime(e.target.currentTime)}
                  onError={(e) => {
                    console.error('Video playback error:', e.target.error);
                    console.error('Video URL:', videoUrl);
                    console.error('Error code:', e.target.error?.code);
                    console.error('Error message:', e.target.error?.message);
                    handleVideoError(e);
                  }}
                >
                  <source 
                    src={videoUrl} 
                    type="video/mp4" 
                  />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <Box
                  sx={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    flexDirection: 'column',
                  }}
                >
                  <PlayIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    {process.status === 'failed' 
                      ? 'Processing failed' 
                      : process.status === 'completed' && !videoUrl
                        ? 'Loading video...'
                        : 'Video will be available after processing'
                    }
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                {tabs.map((tab, index) => (
                  <Tab 
                    key={index}
                    label={tab.label} 
                    icon={tab.icon}
                    iconPosition="start"
                  />
                ))}
              </Tabs>
            </Box>

            <CardContent sx={{ minHeight: 400 }}>
              {/* Overview Tab */}
              {activeTab === 0 && (
                <Box>
                  {/* Tags */}
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <TagIcon sx={{ mr: 1 }} />
                    Tags
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TagEditor
                        tags={process.tags}
                        open={false}
                      />
                      {process.tags && process.tags.length === 0 && (
                        <Typography color="text.secondary">No tags available</Typography>
                      )}
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit('tags', process.tags)}
                        sx={{ ml: 1 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Quick Stats */}
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Quick Stats
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {process.transcript?.statistics?.wordCount || 0}
                        </Typography>
                        <Typography variant="caption">Words</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {process.todoList?.length || 0}
                        </Typography>
                        <Typography variant="caption">Tasks</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {process.tags?.length || 0}
                        </Typography>
                        <Typography variant="caption">Tags</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {process.transcript?.segments?.length || 0}
                        </Typography>
                        <Typography variant="caption">Segments</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Transcript Tab */}
              {activeTab === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Full Transcript
                    </Typography>
                    <Box>
                      <Tooltip title="Copy transcript">
                        <IconButton onClick={handleCopyTranscript}>
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download transcript">
                        <IconButton onClick={handleDownloadTranscript}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {process.transcript?.text ? (
                    <Box>
                      {/* Timed Segments */}
                      {process.transcript.segments && process.transcript.segments.length > 0 && (
                        <Accordion sx={{ mb: 2 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>View Timed Segments</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List>
                              {process.transcript.segments.map((segment, index) => (
                                <ListItem 
                                  key={index}
                                  button
                                  onClick={() => jumpToTimestamp(segment.start)}
                                >
                                  <ListItemIcon>
                                    <Chip 
                                      label={formatTimestamp(segment.start)}
                                      size="small"
                                      variant="outlined"
                                    />
                                  </ListItemIcon>
                                  <ListItemText primary={segment.text} />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Full Text */}
                      <Paper 
                        sx={{ 
                          p: 2, 
                          maxHeight: 400, 
                          overflow: 'auto',
                          backgroundColor: 'background.default',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {process.transcript.text}
                        </Typography>
                      </Paper>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">
                      {process.status === 'completed' 
                        ? 'No transcript available' 
                        : 'Transcript will be generated during processing'
                      }
                    </Typography>
                  )}
                </Box>
              )}

              {/* Todo List Tab */}
              {activeTab === 2 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Generated Todo List
                  </Typography>
                  
                  {process.todoList && process.todoList.length > 0 ? (
                    <List>
                      {process.todoList.map((todo, index) => (
                        <ListItem key={index} sx={{ pl: 0 }}>
                          <ListItemIcon>
                            <Checkbox
                              checked={todo.completed || false}
                              onChange={() => handleTodoToggle(index)}
                              icon={<UncheckedIcon />}
                              checkedIcon={<CheckedIcon />}
                            />
                          </ListItemIcon>
                          {editingTodoIndex === index ? (
                            <Box sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TextField
                                  fullWidth
                                  value={editingTodoValue}
                                  onChange={(e) => setEditingTodoValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleTodoSave(index);
                                    } else if (e.key === 'Escape') {
                                      handleTodoCancel();
                                    }
                                  }}
                                  variant="standard"
                                  placeholder="Enter task description"
                                  autoFocus
                                />
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  label="Timestamp (seconds)"
                                  type="number"
                                  value={editingTodoTimestamp || ''}
                                  onChange={(e) => setEditingTodoTimestamp(e.target.value ? parseInt(e.target.value, 10) : null)}
                                  variant="outlined"
                                  size="small"
                                  sx={{ width: 150 }}
                                  inputProps={{ min: 0, step: 1 }}
                                />
                                <Button 
                                  size="small" 
                                  onClick={setCurrentVideoTime}
                                  variant="outlined"
                                  startIcon={<TimeIcon />}
                                >
                                  Current Time
                                </Button>
                                <IconButton onClick={() => handleTodoSave(index)} size="small" color="primary">
                                  <SaveIcon />
                                </IconButton>
                                <IconButton onClick={handleTodoCancel} size="small">
                                  <CancelIcon />
                                </IconButton>
                              </Box>
                            </Box>
                          ) : (
                            <>
                              <ListItemText 
                                primary={todo.task}
                                secondary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    {typeof todo.timestamp === 'number' && (
                                      <Chip
                                        label={formatTimestamp(todo.timestamp)}
                                        size="small"
                                        variant="outlined"
                                        clickable
                                        onClick={() => jumpToTimestamp(todo.timestamp)}
                                        icon={<TimeIcon />}
                                        color="primary"
                                      />
                                    )}
                                  </Box>
                                }
                                sx={{
                                  textDecoration: todo.completed ? 'line-through' : 'none',
                                  opacity: todo.completed ? 0.7 : 1
                                }}
                              />
                              <IconButton 
                                onClick={() => handleTodoEdit(index)} 
                                size="small"
                                sx={{ ml: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">
                      {process.status === 'completed' 
                        ? 'No todo items generated' 
                        : 'Todo list will be generated during processing'
                      }
                    </Typography>
                  )}
                </Box>
              )}

              {/* Details Tab */}
              {activeTab === 3 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Process Details
                  </Typography>
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Original Filename</strong></TableCell>
                          <TableCell>{process.originalFilename}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Status</strong></TableCell>
                          <TableCell>
                            <Chip 
                              label={getStatusText(process.status)}
                              color={getStatusColor(process.status)}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Created</strong></TableCell>
                          <TableCell>{formatRelativeTime(process.createdAt)}</TableCell>
                        </TableRow>
                        {process.completedAt && (
                          <TableRow>
                            <TableCell><strong>Completed</strong></TableCell>
                            <TableCell>{formatRelativeTime(process.completedAt)}</TableCell>
                          </TableRow>
                        )}
                        {process.files?.original?.duration && (
                          <TableRow>
                            <TableCell><strong>Duration</strong></TableCell>
                            <TableCell>{formatDuration(process.files.original.duration)}</TableCell>
                          </TableRow>
                        )}
                        {process.files?.original?.resolution && (
                          <TableRow>
                            <TableCell><strong>Resolution</strong></TableCell>
                            <TableCell>
                              {process.files.original.resolution.width} × {process.files.original.resolution.height}
                            </TableCell>
                          </TableRow>
                        )}
                        {process.files?.processed?.size && (
                          <TableRow>
                            <TableCell><strong>File Size</strong></TableCell>
                            <TableCell>{formatBytes(process.files.processed.size)}</TableCell>
                          </TableRow>
                        )}
                        {process.transcript?.language && (
                          <TableRow>
                            <TableCell><strong>Detected Language</strong></TableCell>
                            <TableCell>{process.transcript.language.toUpperCase()}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Actions Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<ShareIcon />}
                  onClick={() => generateShareMutation.mutate()}
                  disabled={process.status !== 'completed' || generateShareMutation.isPending}
                  fullWidth
                >
                  Share Process
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTranscript}
                  disabled={!process.transcript?.text}
                  fullWidth
                >
                  Download Transcript
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Error Messages */}
          {process.errors && process.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Processing Errors</AlertTitle>
              {process.errors.map((error, index) => (
                <Typography key={index} variant="body2">
                  {error.step}: {error.message}
                </Typography>
              ))}
            </Alert>
          )}
        </Grid>
      </Grid>

      {/* Tag Editor Dialog - only render when editing */}
      {editingField === 'tags' && (
        <TagEditor
          tags={process?.tags || []}
          open={true}
          onSave={handleSaveTags}
          onCancel={handleCancel}
        />
      )}

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Process</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Anyone with this link can view your process (read-only):
          </Typography>
          <TextField
            fullWidth
            value={shareLink}
            variant="outlined"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton onClick={handleCopyShareLink}>
                  <CopyIcon />
                </IconButton>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
          <Button onClick={handleCopyShareLink} variant="contained">
            Copy Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleAddToFavoritesClick}>
          <ListItemIcon>
            <PlaylistAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Zu Favoriten hinzufügen</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add to Favorites Dialog */}
      <AddToFavoritesDialog
        open={favoriteDialogOpen}
        onClose={() => setFavoriteDialogOpen(false)}
        processId={processId}
        processTitle={process?.title || process?.originalFilename}
      />
    </Box>
  );
};

export default ProcessPage;