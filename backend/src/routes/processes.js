const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access tenantId from parent route
const processController = require('../controllers/processController');
const { validateProcess } = require('../middleware/validation');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const { checkUploadLimits, processUploadAlerts, checkStorageLimits } = require('../middleware/uploadLimitMiddleware');
const videoTokenService = require('../services/videoTokenService');

// @route   GET /api/v1/tenants/:tenantId/processes
// @desc    Get all processes for tenant with optional filtering
// @access  Private (Tenant)
router.get('/', (req, res, next) => processController.getProcesses(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/processes
// @desc    Upload and create new process
// @access  Private (Tenant)
router.post('/', 
  checkUploadLimits, // Check limits before upload
  checkStorageLimits, // Check storage limits
  uploadMiddleware.single('video'),
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