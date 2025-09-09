const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// @route   GET /api/v1/public/processes/:shareId
// @desc    Get shared process (read-only, no authentication required)
// @access  Public
router.get('/processes/:shareId', publicController.getSharedProcess);

// @route   GET /api/v1/public/processes/:shareId/video
// @desc    Stream shared process video (read-only, no authentication required)
// @access  Public
router.get('/processes/:shareId/video', publicController.getSharedProcessVideo);

// @route   GET /api/v1/public/health
// @desc    Public health check endpoint
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ProcessLink API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;