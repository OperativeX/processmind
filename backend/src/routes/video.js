const express = require('express');
const router = express.Router();
const processController = require('../controllers/processController');
const videoTokenService = require('../services/videoTokenService');

// Video streaming route with token-based authentication
// @route   GET /api/v1/video/:tenantId/:processId
// @desc    Stream video file with token authentication
// @access  Video Token Required
router.get('/:tenantId/:processId', 
  videoTokenService.authenticateVideoToken.bind(videoTokenService), 
  (req, res, next) => {
    // Override params to match the expected structure
    req.params.tenantId = req.params.tenantId;
    req.params.id = req.params.processId;
    return processController.getVideo(req, res, next);
  }
);

module.exports = router;