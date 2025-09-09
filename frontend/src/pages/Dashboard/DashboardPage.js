import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Skeleton,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  Upload as UploadIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Star as ProIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

import { processAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { limitsAPI } from '../../services/api';
import { 
  formatBytes, 
  formatRelativeTime, 
  formatDuration, 
  truncateText,
  getStatusColor,
  getStatusText
} from '../../utils/helpers';
import { SkeletonLoader } from '../../components/Common/LoadingScreen';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Fetch user limits for account status
  const { data: limitsData } = useQuery({
    queryKey: ['user-limits', tenant?.id],
    queryFn: () => limitsAPI.getUserLimits(tenant?.id),
    enabled: !!tenant?.id,
    select: (data) => data.data,
    refetchOnWindowFocus: false,
  });

  // Fetch recent processes
  const { 
    data: processesData, 
    isLoading: processesLoading,
    error: processesError 
  } = useQuery({
    queryKey: ['processes', tenant?.id, { limit: 6, sortBy: 'createdAt', sortOrder: 'desc' }],
    queryFn: async () => {
      const result = await processAPI.getProcesses(tenant?.id, { 
        limit: 6, 
        sortBy: 'createdAt', 
        sortOrder: 'desc' 
      });
      return result.data; // Return only the data part
    },
    enabled: !!tenant?.id,
  });

  // Fetch processing statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', tenant?.id],
    queryFn: async () => {
      // This would be a dedicated endpoint in a real app
      const [processes, tags] = await Promise.all([
        processAPI.getProcesses(tenant?.id, { limit: 100 }),
        processAPI.getTags(tenant?.id)
      ]);
      
      const processesArray = processes.data.data.processes;
      const completed = processesArray.filter(p => p.status === 'completed').length;
      const processing = processesArray.filter(p => 
        ['processing', 'processing_video', 'extracting_audio', 'transcribing', 'analyzing'].includes(p.status)
      ).length;
      const failed = processesArray.filter(p => p.status === 'failed').length;
      
      return {
        total: processesArray.length,
        completed,
        processing,
        failed,
        tags: tags.data.data?.tags?.length || 0
      };
    },
    enabled: !!tenant?.id,
  });

  const processes = processesData?.data?.processes || [];
  const stats = statsData || { total: 0, completed: 0, processing: 0, failed: 0, tags: 0 };

  const handleProcessClick = (processId) => {
    navigate(`/processes/${processId}`);
  };

  const handleMenuOpen = (event, process) => {
    event.stopPropagation();
    setSelectedProcess(process);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProcess(null);
  };

  const handleShare = () => {
    if (selectedProcess) {
      navigate(`/processes/${selectedProcess.id}`);
      // Open share dialog in process page
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedProcess) {
      navigate(`/processes/${selectedProcess.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedProcess) {
      // Implement delete functionality
      console.log('Delete process:', selectedProcess.id);
    }
    handleMenuClose();
  };

  const filteredProcesses = processes.filter(process => {
    // If no search query, show all processes
    if (!searchQuery.trim()) return true;
    
    // Search in title (with fallback to "New Process" if no title)
    const processTitle = process.title || 'New Process';
    if (processTitle.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    
    // Search in filename
    if (process.originalFilename?.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    
    // Search in tags
    if (process.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) return true;
    
    return false;
  }
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back! Here's an overview of your video processing activity.
        </Typography>
      </Box>

      {/* Account Status Card - Only show for Free accounts */}
      {user?.accountType === 'free' && limitsData && limitsData.limits && (
        <Alert 
          severity="info" 
          sx={{ mb: 4 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => navigate('/billing')}
              startIcon={<ProIcon />}
            >
              Upgrade to Pro
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Free Account: {limitsData.limits.processes?.remaining || 0}/{limitsData.limits.processes?.max || 10} uploads remaining
              </Typography>
              <Typography variant="body2">
                {limitsData.limits.storage?.remainingGB || 0}GB of {limitsData.limits.storage?.maxGB || 20}GB storage available
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Pro Account Status */}
      {user?.accountType === 'pro' && (
        <Alert severity="success" sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ProIcon />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Pro Account: Unlimited uploads and storage
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VideoIcon sx={{ color: 'primary.main', mr: 2, fontSize: 32 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Processes
                  </Typography>
                  <Typography variant="h4">
                    {statsLoading ? <Skeleton width={60} /> : stats.total}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingIcon sx={{ color: 'success.main', mr: 2, fontSize: 32 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Completed
                  </Typography>
                  <Typography variant="h4">
                    {statsLoading ? <Skeleton width={60} /> : stats.completed}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ color: 'info.main', mr: 2, fontSize: 32 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Processing
                  </Typography>
                  <Typography variant="h4">
                    {statsLoading ? <Skeleton width={60} /> : stats.processing}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShareIcon sx={{ color: 'secondary.main', mr: 2, fontSize: 32 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Unique Tags
                  </Typography>
                  <Typography variant="h4">
                    {statsLoading ? <Skeleton width={60} /> : stats.tags}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => navigate('/upload')}
              size="large"
            >
              Upload New Video
            </Button>
            <Button
              variant="outlined"
              startIcon={<VideoIcon />}
              onClick={() => navigate('/processes')}
              size="large"
            >
              View All Processes
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={() => navigate('/graph')}
              size="large"
            >
              Graph View
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Recent Processes */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Recent Processes
        </Typography>
        <TextField
          placeholder="Search processes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {processesError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load processes. Please try again.
        </Alert>
      )}

      {/* Processes Grid */}
      <Grid container spacing={3}>
        {processesLoading ? (
          // Loading skeletons
          Array.from({ length: 6 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <CardContent>
                  <SkeletonLoader height={24} sx={{ mb: 1 }} />
                  <SkeletonLoader height={16} width="60%" sx={{ mb: 2 }} />
                  <SkeletonLoader height={16} width="80%" sx={{ mb: 1 }} />
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <SkeletonLoader height={24} width={60} />
                    <SkeletonLoader height={24} width={80} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : filteredProcesses.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <VideoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  {searchQuery ? 'No processes found' : 'No processes yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Upload your first video to get started with AI-powered analysis'
                  }
                </Typography>
                {!searchQuery && (
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => navigate('/upload')}
                  >
                    Upload Video
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredProcesses.map((process) => (
            <Grid item xs={12} sm={6} md={4} key={process.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => handleProcessClick(process.id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {truncateText(process.title || 'New Process', 40)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, process)}
                      sx={{ ml: 1 }}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {formatRelativeTime(process.createdAt)}
                  </Typography>

                  {/* Status */}
                  <Box sx={{ mb: 2 }}>
                    <Chip 
                      label={getStatusText(process.status)}
                      color={getStatusColor(process.status)}
                      size="small"
                    />
                  </Box>

                  {/* Progress bar for processing */}
                  {process.status !== 'completed' && process.status !== 'failed' && process.progress && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {process.progress.currentStep} ({process.progress.percentage}%)
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={process.progress.percentage || 0}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )}

                  {/* File info */}
                  {process.files?.processed?.size && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {formatBytes(process.files.processed.size)}
                      {process.files.original?.duration && (
                        <> • {formatDuration(process.files.original.duration)}</>
                      )}
                    </Typography>
                  )}

                  {/* Tags */}
                  {process.tags && process.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
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

                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<PlayIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcessClick(process.id);
                    }}
                  >
                    View Details
                  </Button>
                  {process.sharing?.enabled && (
                    <Chip
                      label="Shared"
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ ml: 'auto' }}
                    />
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* View All Button */}
      {!processesLoading && filteredProcesses.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/processes')}
            size="large"
          >
            View All Processes
          </Button>
        </Box>
      )}

      {/* Process Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShare}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default DashboardPage;