import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  VideoFile as VideoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadFile, processAPI, limitsAPI } from '../../services/api';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useUpload } from '../../contexts/UploadContext';
import UploadLimits from '../../components/Upload/UploadLimits';
import UsageAlert from '../../components/Common/UsageAlert';
import { useNotification } from '../../contexts/NotificationContext';
import { formatBytes, formatDuration } from '../../utils/helpers';
import { useQuery } from '@tanstack/react-query';

const ACCEPTED_FORMATS = {
  'video/mp4': ['.mp4'],
  'video/avi': ['.avi'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'video/ogg': ['.ogv'],
  'video/3gpp': ['.3gp'],
};

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const UploadPage = () => {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  // Fetch user limits for Free accounts
  const { data: limitsData, isLoading: limitsLoading } = useQuery({
    queryKey: ['user-limits', tenant?.id],
    queryFn: () => limitsAPI.getUserLimits(tenant?.id),
    enabled: !!tenant?.id,
    select: (data) => data.data,
    refetchOnWindowFocus: false,
  });
  
  // Use persistent upload context
  const {
    uploadProgress,
    isUploading,
    processingStatus,
    currentProcess,
    selectedFile,
    cancelTokenSource,
    updateUploadProgress,
    setIsUploading,
    setProcessingStatus,
    setCurrentProcess,
    setSelectedFile: setSelectedFileContext,
    setCancelTokenSource,
    cancelUpload,
    resetUploadState
  } = useUpload();

  // Local state only for UI-specific things
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [localFile, setLocalFile] = useState(null); // Store actual File object locally

  // Enhanced upload mutation with cancellation support
  const uploadMutation = useMutation({
    mutationFn: (file) => {
      console.log('🚀 Starting upload for file:', file.name, 'Size:', formatBytes(file.size));
      
      // Create cancel token for this upload
      const cancelToken = axios.CancelToken.source();
      setCancelTokenSource(cancelToken);
      
      setIsUploading(true);
      return uploadFile(tenant.id, file, (progress) => {
        console.log('📤 Upload progress:', progress + '%');
        updateUploadProgress(progress);
      }, cancelToken);
    },
    onSuccess: (response) => {
      const process = response.data.data.process;
      const processId = process.id || process._id;
      const filename = process.originalFilename;
      
      console.log('✅ Upload successful! Process ID:', processId);
      console.log('🔄 Starting AI processing pipeline...');
      
      // Store the process info with tenantId
      setCurrentProcess({ ...process, tenantId: tenant.id });
      setProcessingStatus('processing');
      
      // Show success notification
      showNotification(
        `${filename} uploaded successfully! Processing has started...`,
        'success',
        { duration: 3000 }
      );
      
      // Start polling for status updates
      startStatusPolling(processId);
      
      // Invalidate processes cache to ensure dashboard shows new process
      queryClient.invalidateQueries({ queryKey: ['processes', tenant?.id] });
      
      // Clear the selected file but keep showing status
      setSelectedFileContext(null);
      setLocalFile(null);
      setPreviewUrl(null);
      updateUploadProgress(0);
      setIsUploading(false);
      setCancelTokenSource(null);
    },
    onError: (error) => {
      console.error('❌ Upload failed:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      let message;
      if (axios.isCancel(error)) {
        message = 'Upload cancelled';
        console.log('Upload was cancelled by user');
      } else {
        message = error.response?.data?.message || 'Upload failed. Please try again.';
      }
      
      showNotification(message, 'error');
      // Always reset upload state completely on error
      resetUploadState();
    },
  });

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let message = 'File rejected: ';
      
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        message += `File too large (max ${formatBytes(MAX_FILE_SIZE)})`;
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        message += 'Invalid file type. Please select a video file.';
      } else {
        message += rejection.errors[0]?.message || 'Unknown error';
      }
      
      showNotification(message, 'error');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setLocalFile(file); // Store actual File object locally
      setSelectedFileContext({
        name: file.name,
        size: file.size,
        type: file.type
      }); // Store serializable data in context
      
      // Create preview URL for video
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, [showNotification]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading, // Disable dropzone during upload
  });

  const handleUpload = () => {
    if (!localFile || isUploading) {
      console.warn('❌ Cannot upload:', !localFile ? 'No file selected' : 'Upload already in progress');
      return;
    }
    
    // Check limits for Free accounts
    if (limitsData?.accountType === 'free') {
      if (!limitsData.canCreateProcess) {
        showNotification(
          `Monthly upload limit reached (${limitsData.limits.processes.current}/${limitsData.limits.processes.max}). Upgrade to Pro for unlimited uploads.`, 
          'error'
        );
        return;
      }
      
      const fileSizeMB = localFile.size / (1024 * 1024);
      if (!limitsData.limits.storage.remainingMB || fileSizeMB > limitsData.limits.storage.remainingMB) {
        const fileSizeGB = (fileSizeMB / 1024).toFixed(2);
        showNotification(
          `Storage limit would be exceeded. This file (${fileSizeGB}GB) is too large for your remaining ${limitsData.limits.storage.remainingGB}GB.`,
          'error'
        );
        return;
      }
    }
    
    console.log('🚀 Initiating upload for:', localFile.name);
    uploadMutation.mutate(localFile);
  };

  const handleClear = () => {
    if (isUploading) {
      // Cancel ongoing upload
      cancelUpload();
    } else {
      // If not uploading, just clear local states
      setSelectedFileContext(null);
      setLocalFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      updateUploadProgress(0);
      setShowPreview(false);
    }
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
  };

  // Status polling function
  const startStatusPolling = (processId) => {
    console.log('Starting status polling for process:', processId);
    
    // Poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await processAPI.getProcessStatus(tenant?.id, processId);
        const process = response.data.data.process;
        
        setCurrentProcess({ ...process, tenantId: tenant.id });
        setProcessingStatus(process.status);
        
        // Check if processing is complete
        if (process.status === 'completed' || process.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          
          // Invalidate cache to ensure dashboard shows updated process
          queryClient.invalidateQueries({ queryKey: ['processes', tenant?.id] });
          
          if (process.status === 'completed') {
            showNotification(
              `Processing complete! "${process.title}" is ready.`,
              'success',
              { duration: 4000 }
            );
          } else if (process.status === 'failed') {
            showNotification('Processing failed. Please try again.', 'error');
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    }, 2000);
    
    setPollingInterval(interval);
  };

  // Resume polling if there was an active process
  React.useEffect(() => {
    if (currentProcess && processingStatus && processingStatus !== 'completed' && processingStatus !== 'failed') {
      // Validate that the process belongs to the current tenant
      if (currentProcess.tenantId && currentProcess.tenantId !== tenant?.id) {
        console.warn('Process belongs to different tenant - resetting upload state');
        resetUploadState();
        return;
      }
      
      console.log('Resuming polling for process:', currentProcess.id || currentProcess._id);
      startStatusPolling(currentProcess.id || currentProcess._id);
    }
    
    // Clean up invalid upload states on mount
    if (isUploading && !cancelTokenSource) {
      console.warn('Invalid upload state detected - resetting');
      resetUploadState();
    }
  }, []); // Only on mount

  // Clean up polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Get status display text with main and detail status
  const getStatusText = (status, processingDetails) => {
    // Hauptstatus-Map
    const mainStatusMap = {
      'uploading': 'Video wird hochgeladen',
      'uploaded': 'Upload abgeschlossen',
      'processing_media': 'Medienverarbeitung',
      'transcribing': 'Transkription',
      'analyzing': 'KI-Analyse',
      'finalizing': 'Finalisierung',
      'completed': 'Verarbeitung abgeschlossen!',
      'failed': 'Verarbeitung fehlgeschlagen'
    };
    
    // Detail-Status-Map
    const detailStatusMap = {
      'extracting_audio': 'Audio-Spur wird extrahiert...',
      'video_compressing': 'Video wird komprimiert...',
      'generating_tags': 'Tags werden generiert...',
      'generating_todos': 'Todo-Listen werden erstellt...',
      'generating_title': 'Titel wird generiert...',
      'generating_embeddings': 'Embeddings werden generiert...',
      'uploading_to_s3': 'Video wird zu S3 hochgeladen...'
    };
    
    const mainStatus = mainStatusMap[status] || status;
    const detailStatus = processingDetails ? detailStatusMap[processingDetails] : null;
    
    return {
      main: mainStatus,
      detail: detailStatus
    };
  };

  // Get active step for the stepper
  const getActiveStep = (status) => {
    const statusSteps = {
      'uploading': 0,
      'uploaded': 0,
      'starting': 0,
      'processing_media': 1,  // Konsolidiert Audio + Video
      'extracting_audio': 1,
      'audio_extracted': 1,
      'video_compressing': 1,
      'transcription': 2,
      'transcribing': 2,
      'ai_analysis': 3,
      'analyzing': 3,
      'video_validating': 4,
      'video_completed': 4,
      'uploading_to_s3': 4,
      's3_upload_complete': 4,
      'cleanup': 4,
      'finalizing': 4,
      'completed': 4,
      'failed': -1
    };
    return statusSteps[status] || 0;
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
        Upload Video
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Upload your video to automatically generate transcripts, tags, and todo lists
      </Typography>

      {/* Show limits for Free accounts */}
      <UploadLimits 
        limits={limitsData} 
        loading={limitsLoading}
        accountType={user?.accountType}
        onUpgradeClick={() => navigate('/billing')} 
      />

      {/* Show usage alert if approaching limits */}
      {user?.accountType === 'free' && limitsData?.limits && (
        <>
          {limitsData.limits.processes && (
            <UsageAlert
              type="upload"
              data={{
                percentage: Math.round((limitsData.limits.processes.current / limitsData.limits.processes.max) * 100),
                uploadsUsed: limitsData.limits.processes.current,
                uploadLimit: limitsData.limits.processes.max
              }}
            />
          )}
          {limitsData.limits.storage && (
            <UsageAlert
              type="storage"
              data={{
                percentage: limitsData.limits.storage.usagePercentage,
                storageUsedGB: limitsData.limits.storage.currentGB,
                storageLimit: limitsData.limits.storage.maxGB
              }}
            />
          )}
        </>
      )}

      {/* Upload Area */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          mb: 3,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: isDragActive 
            ? 'primary.main' 
            : isDragReject 
            ? 'error.main' 
            : 'divider',
          backgroundColor: isDragActive 
            ? 'rgba(124, 58, 237, 0.08)' 
            : isDragReject 
            ? 'rgba(220, 38, 38, 0.08)'
            : 'transparent',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': !isUploading ? {
            borderColor: 'primary.main',
            backgroundColor: 'rgba(124, 58, 237, 0.04)',
          } : {},
        }}
      >
        <input {...getInputProps()} disabled={isUploading} />
        
        <UploadIcon 
          sx={{ 
            fontSize: 64, 
            color: isDragReject ? 'error.main' : 'primary.main',
            mb: 2 
          }} 
        />
        
        <Typography variant="h6" sx={{ mb: 1 }}>
          {isDragActive 
            ? 'Drop your video here' 
            : 'Drag & drop your video here, or click to browse'
          }
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supported formats: MP4, AVI, MOV, WebM, OGV, 3GP
        </Typography>
        
        <Typography variant="caption" color="text.secondary">
          Maximum file size: {formatBytes(MAX_FILE_SIZE)}
        </Typography>
        
        {fileRejections.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {fileRejections[0].errors[0]?.message}
          </Alert>
        )}
      </Paper>

      {/* Selected File Info */}
      {selectedFile && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VideoIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">{selectedFile.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip 
                    label={formatBytes(selectedFile.size)} 
                    size="small" 
                    variant="outlined" 
                  />
                  <Chip 
                    label={selectedFile.type} 
                    size="small" 
                    variant="outlined" 
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {previewUrl && (
                  <IconButton 
                    onClick={() => setShowPreview(true)}
                    color="primary"
                    disabled={isUploading}
                  >
                    <PlayIcon />
                  </IconButton>
                )}
                {!isUploading && (
                  <IconButton 
                    onClick={handleClear}
                    color="error"
                  >
                    <CloseIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Upload Progress */}
            {isUploading && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Uploading...</Typography>
                  <Typography variant="body2">{uploadProgress}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleClear}
                    startIcon={<CloseIcon />}
                    fullWidth
                    size="small"
                  >
                    Cancel Upload
                  </Button>
                </Box>
              </Box>
            )}

            {/* Upload Button */}
            {!isUploading && (
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={isUploading}
                startIcon={<UploadIcon />}
                fullWidth
                size="large"
              >
                Start Upload & Processing
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {processingStatus && currentProcess && (
        <Card sx={{ mb: 3, backgroundColor: 'background.default' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              Processing Status
              {processingStatus !== 'completed' && processingStatus !== 'failed' && (
                <CircularProgress size={20} sx={{ ml: 2 }} />
              )}
            </Typography>
            
            {/* Process Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                File: {currentProcess.originalFilename}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Status: <strong>{getStatusText(processingStatus, currentProcess.processingDetails).main}</strong>
                </Typography>
                {getStatusText(processingStatus, currentProcess.processingDetails).detail && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Details: {getStatusText(processingStatus, currentProcess.processingDetails).detail}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Progress Steps */}
            <Stepper activeStep={getActiveStep(processingStatus)} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Upload</StepLabel>
              </Step>
              <Step>
                <StepLabel>Medienverarbeitung</StepLabel>
              </Step>
              <Step>
                <StepLabel>Transkription</StepLabel>
              </Step>
              <Step>
                <StepLabel>KI-Analyse</StepLabel>
              </Step>
              <Step>
                <StepLabel>Fertig</StepLabel>
              </Step>
            </Stepper>

            {/* Action Buttons */}
            {processingStatus === 'completed' && (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => navigate(`/processes/${currentProcess.id || currentProcess._id}`)}
                  startIcon={<PlayIcon />}
                >
                  View Process
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    resetUploadState();
                  }}
                >
                  Upload Another
                </Button>
              </Box>
            )}

            {processingStatus === 'failed' && (
              <Alert severity="error">
                Processing failed. Please try uploading the file again.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <InfoIcon sx={{ mr: 1, color: 'info.main' }} />
              Processing Pipeline
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Video Compression" 
                  secondary="H.265 encoding, Full HD output"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Audio Transcription" 
                  secondary="AI-powered with timestamps"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Content Analysis" 
                  secondary="Auto-generate tags and todos"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <ErrorIcon sx={{ mr: 1, color: 'warning.main' }} />
              Important Notes
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Processing Time" 
                  secondary="Typically 5-10 minutes per hour of video"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="File Retention" 
                  secondary="Original files deleted after processing"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Real-time Updates" 
                  secondary="You'll see progress on the process page"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Video Preview Dialog */}
      <Dialog 
        open={showPreview} 
        onClose={handlePreviewClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Video Preview
          <IconButton onClick={handlePreviewClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {previewUrl && (
            <video
              controls
              style={{
                width: '100%',
                maxHeight: '400px',
                backgroundColor: '#000',
                borderRadius: '8px',
              }}
            >
              <source src={previewUrl} type={selectedFile?.type} />
              Your browser does not support the video tag.
            </video>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePreviewClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UploadPage;