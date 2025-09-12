const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access tenantId from parent route
const processController = require('../controllers/processController');
const { validateProcess } = require('../middleware/validation');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const streamingUploadMiddleware = require('../middleware/streamingUploadMiddleware');
const { checkUploadLimits, processUploadAlerts, checkStorageLimits } = require('../middleware/uploadLimitMiddleware');
const videoTokenService = require('../services/videoTokenService');
const { 
  handleChunkUpload, 
  validateChunkUpload, 
  processChunk 
} = require('../middleware/chunkUploadMiddleware');
const chunkFinalizationMiddleware = require('../middleware/chunkFinalizationMiddleware');

// @route   GET /api/v1/tenants/:tenantId/processes
// @desc    Get all processes for tenant with optional filtering
// @access  Private (Tenant)
router.get('/', (req, res, next) => processController.getProcesses(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/processes/upload-chunk
// @desc    Upload a single chunk of a video file
// @access  Private (Tenant)
router.post('/upload-chunk',
  handleChunkUpload,
  validateChunkUpload,
  processChunk
);

// @route   POST /api/v1/tenants/:tenantId/processes/finalize-chunked-upload
// @desc    Finalize a chunked upload
// @access  Private (Tenant)
router.post('/finalize-chunked-upload',
  (req, res, next) => processController.finalizeChunkedUpload(req, res, next)
);

// @route   POST /api/v1/tenants/:tenantId/processes
// @desc    Upload and create new process (supports both direct and chunked uploads)
// @access  Private (Tenant)
router.post('/', 
  checkUploadLimits, // Check upload count limits before upload
  // TODO: Fix chunkFinalizationMiddleware - it consumes the stream for normal uploads
  // chunkFinalizationMiddleware, // Check for chunk finalization requests
  streamingUploadMiddleware({ fieldName: 'video' }),
  // Debug middleware to log state after upload
  (req, res, next) => {
    const logger = require('../utils/logger');
    logger.info('State after streaming upload:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      filePath: req.file?.path,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      processId: req.processId,
      uploadDir: req.uploadDir,
      userId: req.user?.id,
      tenantId: req.params?.tenantId
    });
    next();
  },
  checkStorageLimits, // Check storage limits AFTER file is uploaded
  validateProcess.create,
  (req, res, next) => processController.createProcess(req, res, next),
  processUploadAlerts // Process alerts after successful upload
);

// Specific routes MUST come before parameterized routes
// @route   GET /api/v1/tenants/:tenantId/processes/search
// @desc    Search processes by tags, title, or transcript content
// @access  Private (Tenant)
router.get('/search', (req, res, next) => processController.searchProcesses(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/processes/tags
// @desc    Get all unique tags for tenant
// @access  Private (Tenant)
router.get('/tags', (req, res, next) => processController.getTags(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/processes/graph-data
// @desc    Get data for graph visualization (processes and tag connections)
// @access  Private (Tenant)
router.get('/graph-data', (req, res, next) => processController.getGraphData(req, res, next));

// Parameterized routes come AFTER specific routes
// @route   GET /api/v1/tenants/:tenantId/processes/:id
// @desc    Get single process by ID
// @access  Private (Tenant)
router.get('/:id', (req, res, next) => processController.getProcess(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/processes/:id
// @desc    Update process (edit transcript, tags, todo list, title)
// @access  Private (Tenant)
router.put('/:id', validateProcess.update, (req, res, next) => processController.updateProcess(req, res, next));

// @route   DELETE /api/v1/tenants/:tenantId/processes/:id
// @desc    Delete process and associated files
// @access  Private (Tenant)
router.delete('/:id', (req, res, next) => processController.deleteProcess(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/processes/:id/share
// @desc    Generate or update share link for process
// @access  Private (Tenant)
router.post('/:id/share', (req, res, next) => processController.generateShareLink(req, res, next));

// @route   DELETE /api/v1/tenants/:tenantId/processes/:id/share
// @desc    Disable sharing for process
// @access  Private (Tenant)
router.delete('/:id/share', (req, res, next) => processController.disableSharing(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/processes/:id/status
// @desc    Get processing status and job progress
// @access  Private (Tenant)
router.get('/:id/status', (req, res, next) => processController.getProcessStatus(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/processes/:id/video-token
// @desc    Generate video access token
// @access  Private (Tenant)
router.get('/:id/video-token', (req, res, next) => processController.generateVideoToken(req, res, next));

// Video streaming route has been moved to /api/v1/video/:tenantId/:processId
// to avoid conflict with tenant authentication middleware

module.exports = router;