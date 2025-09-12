import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Stack,
  Checkbox,
} from '@mui/material';
import { 
  Share as ShareIcon,
  Visibility as VisibilityIcon,
  AccessTime as AccessTimeIcon,
  VideoLibrary as VideoIcon,
  CheckCircle as CheckIcon,
  Circle as CircleIcon,
  ContentCopy as CopyIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import publicService from '../../services/publicService';
import VideoPlayer from '../../components/Common/VideoPlayer';
import { formatTimestamp } from '../../utils/helpers';

const SharedProcessPage = () => {
  const { shareId } = useParams();
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [process, setProcess] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [localTodos, setLocalTodos] = useState([]);

  useEffect(() => {
    fetchSharedProcess();
  }, [shareId]);

  const fetchSharedProcess = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await publicService.getSharedProcess(shareId);
      
      if (response.success) {
        setProcess(response.data.process);
        setShareInfo(response.data.shareInfo);
        // Initialize local todos state
        setLocalTodos(response.data.process.todoList || []);
      }
    } catch (err) {
      console.error('Error fetching shared process:', err);
      if (err.response?.status === 404) {
        setError('This shared link is invalid or has been removed.');
      } else if (err.response?.status === 410) {
        setError('This shared link has expired.');
      } else {
        setError('Unable to load the shared process. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTodoToggle = (index) => {
    const updatedTodos = [...localTodos];
    updatedTodos[index] = {
      ...updatedTodos[index],
      completed: !updatedTodos[index].completed
    };
    setLocalTodos(updatedTodos);
  };

  const jumpToTimestamp = (timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime(timestamp);
      videoRef.current.play();
    }
  };

  if (loading) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', py: 4 }}>
        <Container maxWidth="md">
          <Alert severity="error" sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Unable to access shared process
            </Typography>
            <Typography>{error}</Typography>
          </Alert>
        </Container>
      </Box>
    );
  }

  if (!process) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Header */}
      <Box 
        sx={{ 
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          py: 2
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography 
              variant="h6" 
              component="a"
              href="https://www.processlink.de"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                fontWeight: 600,
                color: 'inherit',
                textDecoration: 'none',
                userSelect: 'none',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
            >
              ProcessLink
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                icon={<ShareIcon />} 
                label="Shared View" 
                size="small" 
                color="primary"
              />
              {shareInfo && (
                <Chip 
                  icon={<VisibilityIcon />} 
                  label={`${shareInfo.viewCount} views`} 
                  size="small" 
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Process Title */}
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
          {process.title || 'Untitled Process'}
        </Typography>

        {/* Share Info Alert */}
        {shareInfo?.expiresAt && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              This link will expire on {new Date(shareInfo.expiresAt).toLocaleDateString()}
            </Typography>
          </Alert>
        )}

        {/* Video Player */}
        {process.files?.processed && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VideoIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Video</Typography>
              </Box>
              <VideoPlayer
                ref={videoRef}
                src={publicService.getSharedVideoUrl(shareId)}
                poster={null}
                onTimeUpdate={() => {}}
                autoPlay={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {process.tags && process.tags.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {process.tags.map((tag, index) => (
                  <Chip 
                    key={index} 
                    label={tag.name} 
                    size="small" 
                    variant={tag.weight >= 0.7 ? "filled" : "outlined"}
                    color={tag.weight >= 0.7 ? "primary" : "default"}
                    sx={{ 
                      fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal'
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Todo List */}
        {localTodos && localTodos.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Action Items
              </Typography>
              <List dense>
                {localTodos.map((todo, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={todo.completed}
                        onChange={() => handleTodoToggle(index)}
                        disableRipple
                      />
                    </ListItemIcon>
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
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Transcript */}
        {process.transcript?.text && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transcript
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 3, 
                  backgroundColor: 'background.default',
                  maxHeight: '500px',
                  overflowY: 'auto'
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8
                  }}
                >
                  {process.transcript.text}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        )}

        {/* Process Info */}
        <Box sx={{ mt: 4, textAlign: 'center', opacity: 0.7 }}>
          <Typography variant="body2" color="text.secondary">
            Created on {new Date(process.createdAt).toLocaleDateString()}
            {process.updatedAt && process.updatedAt !== process.createdAt && (
              <> • Updated on {new Date(process.updatedAt).toLocaleDateString()}</>
            )}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default SharedProcessPage;