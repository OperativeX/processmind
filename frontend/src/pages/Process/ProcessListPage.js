import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Alert,
  Menu,
  IconButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Autocomplete,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  MoreVert as MoreIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  VideoLibrary as VideoIcon,
  Upload as UploadIcon,
  FavoriteAdd as FavoriteAddIcon,
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
  truncateText,
  getStatusColor,
  getStatusText
} from '../../utils/helpers';
import { SkeletonLoader } from '../../components/Common/LoadingScreen';
import AddToFavoritesDialog from '../../components/Dialogs/AddToFavoritesDialog';

const ITEMS_PER_PAGE = 12;

const ProcessListPage = ({ userFilter = false }) => {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for filters and controls
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState(searchParams.get('tags')?.split(',').filter(Boolean) || []);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  
  // Menu and dialog state
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);

  // Build query parameters
  const queryParams = {
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    sortBy,
    sortOrder,
    ...(searchQuery && { search: searchQuery }),
    ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
    ...(userFilter && user?.id && { userId: user.id }),
  };

  // Update URL params when filters change
  React.useEffect(() => {
    const newParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) newParams.set(key, value.toString());
    });
    setSearchParams(newParams, { replace: true });
  }, [currentPage, sortBy, sortOrder, searchQuery, selectedTags, setSearchParams]);

  // Fetch processes with enhanced error logging
  const { 
    data: processesData, 
    isLoading: processesLoading,
    error: processesError 
  } = useQuery({
    queryKey: ['processes', tenant?.id, queryParams],
    queryFn: async () => {
      console.log('🔍 ProcessListPage: Fetching processes...', {
        tenantId: tenant?.id,
        queryParams,
        apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1'
      });
      
      try {
        const result = await processAPI.getProcesses(tenant?.id, queryParams);
        console.log('✅ ProcessListPage: Processes fetched successfully', {
          count: result.data.data.processes?.length || 0,
          pagination: result.data.data.pagination
        });
        return result.data; // Return only the data, not the entire response
      } catch (error) {
        console.error('❌ ProcessListPage: Failed to fetch processes', {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        throw error;
      }
    },
    enabled: !!tenant?.id,
    retry: 2,
    retryDelay: 1000,
  });

  // Delete process mutation
  const deleteProcessMutation = useMutation({
    mutationFn: (processId) => processAPI.deleteProcess(tenant?.id, processId),
    onSuccess: () => {
      showNotification('Process deleted successfully', 'success');
      queryClient.invalidateQueries(['processes', tenant?.id]);
      setDeleteDialogOpen(false);
      setProcessToDelete(null);
    },
    onError: (error) => {
      showNotification(error.response?.data?.message || 'Failed to delete process', 'error');
    },
  });

  const processes = processesData?.data?.processes || [];
  const pagination = processesData?.data?.pagination || {};

  // Extract unique tags from all processes for the autocomplete
  const availableTags = React.useMemo(() => {
    const tagSet = new Set();
    processes.forEach(process => {
      if (process.tags && Array.isArray(process.tags)) {
        process.tags.forEach(tag => {
          if (tag.name) tagSet.add(tag.name);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [processes]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };


  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

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
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedProcess) {
      navigate(`/processes/${selectedProcess.id}`);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    console.log('Delete clicked, selectedProcess:', selectedProcess);
    if (selectedProcess) {
      setProcessToDelete(selectedProcess);
      setDeleteDialogOpen(true);
      console.log('Delete dialog should open now');
    } else {
      console.error('No process selected for deletion');
    }
    handleMenuClose();
  };

  const handleAddToFavoritesClick = () => {
    // Close menu but keep selectedProcess
    setMenuAnchor(null);
    setFavoriteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (processToDelete) {
      deleteProcessMutation.mutate(processToDelete.id);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            {userFilter ? 'Meine Prozesse' : 'All Processes'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {userFilter ? 'Manage and view your video processes' : 'Manage and view all your video processes'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/upload')}
          size="large"
        >
          Upload Video
        </Button>
      </Box>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search processes..."
                value={searchQuery}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                multiple
                value={selectedTags}
                onChange={(event, newValue) => {
                  setSelectedTags(newValue);
                  setCurrentPage(1);
                }}
                options={availableTags}
                renderInput={(params) => (
                  <TextField {...params} label="Filter by Tags" placeholder="Select tags..." />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                    />
                  ))
                }
              />
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort"
                >
                  <MenuItem value="createdAt">Date</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  label="Order"
                >
                  <MenuItem value="desc">↓</MenuItem>
                  <MenuItem value="asc">↑</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                fullWidth
                startIcon={<FilterIcon />}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          {processesLoading ? (
            'Loading...'
          ) : (
            `Showing ${pagination.totalCount || 0} process${pagination.totalCount !== 1 ? 'es' : ''}`
          )}
        </Typography>
      </Box>

      {/* Error State */}
      {processesError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load processes. Please try again.
        </Alert>
      )}

      {/* Processes Grid */}
      <Grid container spacing={3}>
        {processesLoading ? (
          // Loading skeletons
          Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
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
                <CardActions>
                  <SkeletonLoader height={32} width={100} />
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : processes.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <VideoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No processes found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search criteria'
                    : userFilter 
                      ? 'You haven\'t uploaded any videos yet'
                      : 'Upload your first video to get started'
                  }
                </Typography>
                {!searchQuery && selectedTags.length === 0 && (
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
          processes.map((process) => (
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
                    <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, mr: 1 }}>
                      {truncateText(process.title || process.originalFilename, 45)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, process)}
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
                  {!['completed', 'failed'].includes(process.status) && process.progress && (
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
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
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

                  {/* Tags */}
                  {process.tags && process.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={pagination.totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
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
        <MenuItem onClick={handleAddToFavoritesClick}>
          <ListItemIcon>
            <PlaylistAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Zu Favoriten hinzufügen</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Process</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{processToDelete?.title || processToDelete?.originalFilename}"? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            disabled={deleteProcessMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Favorites Dialog */}
      <AddToFavoritesDialog
        open={favoriteDialogOpen}
        onClose={() => {
          setFavoriteDialogOpen(false);
          setSelectedProcess(null);
        }}
        processId={selectedProcess?.id}
        processTitle={selectedProcess?.title}
      />
    </Box>
  );
};

export default ProcessListPage;