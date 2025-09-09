const { Process } = require('../models');
const logger = require('../utils/logger');

class PublicController {
  /**
   * Get shared process (read-only, no authentication required)
   * @route GET /api/v1/public/processes/:shareId
   * @access Public
   */
  async getSharedProcess(req, res, next) {
    try {
      const { shareId } = req.params;

      if (!shareId) {
        return res.status(400).json({
          success: false,
          message: 'Share ID is required'
        });
      }

      // Find process by share ID
      const process = await Process.findByShareId(shareId);

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Shared process not found or expired'
        });
      }

      // Check if sharing has expired
      if (process.sharing.expiresAt && process.sharing.expiresAt < new Date()) {
        return res.status(410).json({
          success: false,
          message: 'This shared link has expired'
        });
      }

      // Increment view count
      await process.incrementViewCount();

      // Prepare response data (remove sensitive information)
      const processData = process.toJSON();
      
      // Remove sensitive fields for public access
      delete processData.userId;
      delete processData.tenantId;
      delete processData.jobs;
      delete processData.metadata;
      delete processData.errors;
      
      // Only show basic file information
      if (processData.files) {
        delete processData.files.original;
        if (processData.files.processed) {
          // Only keep public information
          processData.files.processed = {
            format: processData.files.processed.format,
            codec: processData.files.processed.codec,
            resolution: processData.files.processed.resolution
          };
        }
      }

      logger.info('Shared process accessed', {
        shareId,
        processId: process._id,
        viewCount: process.sharing.viewCount,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          process: processData,
          shareInfo: {
            shareId,
            viewCount: process.sharing.viewCount,
            lastViewedAt: process.sharing.lastViewedAt,
            expiresAt: process.sharing.expiresAt
          }
        }
      });

    } catch (error) {
      logger.error('Get shared process error:', {
        error: error.message,
        shareId: req.params.shareId,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * Get shared process video stream
   * @route GET /api/v1/public/processes/:shareId/video
   * @access Public
   */
  async getSharedProcessVideo(req, res, next) {
    try {
      const { shareId } = req.params;

      // Find process by share ID
      const process = await Process.findByShareId(shareId);

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Shared process not found or expired'
        });
      }

      // Check if sharing has expired
      if (process.sharing.expiresAt && process.sharing.expiresAt < new Date()) {
        return res.status(410).json({
          success: false,
          message: 'This shared link has expired'
        });
      }

      // Check if processed video exists in S3
      const videoS3Key = process.files.processed?.path;
      if (!videoS3Key) {
        return res.status(404).json({
          success: false,
          message: 'Video not available'
        });
      }

      // Verify that video is stored in S3 (no local file support)
      if (process.files.processed.storageType !== 's3') {
        return res.status(404).json({
          success: false,
          message: 'Video not available in cloud storage'
        });
      }

      const s3Service = require('../services/s3Service').getInstance();

      // Verify file exists in S3
      const fileExists = await s3Service.fileExists(videoS3Key);
      if (!fileExists) {
        return res.status(404).json({
          success: false,
          message: 'Video file not found in storage'
        });
      }

      // Generate pre-signed URL for direct S3 streaming (1 hour expiry)
      const presignedUrl = await s3Service.generateVideoStreamUrl(videoS3Key, 3600);

      // Set CORS headers for video streaming
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Redirect to S3 pre-signed URL for direct streaming
      res.redirect(302, presignedUrl);

      logger.info('Shared video streamed from S3', {
        shareId,
        processId: process._id,
        s3Key: videoS3Key,
        ip: req.ip
      });

    } catch (error) {
      logger.error('Get shared video error:', {
        error: error.message,
        shareId: req.params.shareId,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * Get public statistics (for homepage, etc.)
   * @route GET /api/v1/public/stats
   * @access Public
   */
  async getPublicStats(req, res, next) {
    try {
      // Get basic anonymized statistics
      const [totalProcesses, totalSharedProcesses] = await Promise.all([
        Process.countDocuments({ 
          isDeleted: false,
          status: 'completed'
        }),
        Process.countDocuments({ 
          isDeleted: false,
          'sharing.enabled': true
        })
      ]);

      // Get total processing time (anonymized)
      const processingStats = await Process.aggregate([
        {
          $match: {
            isDeleted: false,
            status: 'completed',
            'metadata.processingTime.total': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalProcessingTime: { $sum: '$metadata.processingTime.total' },
            avgProcessingTime: { $avg: '$metadata.processingTime.total' },
            totalCount: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        totalProcesses,
        totalSharedProcesses,
        totalProcessingTimeHours: processingStats[0] 
          ? Math.round(processingStats[0].totalProcessingTime / 3600)
          : 0,
        averageProcessingTimeMinutes: processingStats[0]
          ? Math.round(processingStats[0].avgProcessingTime / 60)
          : 0
      };

      // Cache for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');
      
      res.json({
        success: true,
        data: {
          stats
        }
      });

    } catch (error) {
      logger.error('Get public stats error:', error);
      next(error);
    }
  }

  /**
   * Rate limiting info for public API
   * @route GET /api/v1/public/rate-limit
   * @access Public
   */
  async getRateLimitInfo(req, res, next) {
    try {
      const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
      const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

      res.json({
        success: true,
        data: {
          windowMs,
          maxRequests,
          windowMinutes: windowMs / (60 * 1000),
          remaining: res.get('X-RateLimit-Remaining') || maxRequests,
          resetTime: res.get('X-RateLimit-Reset')
        }
      });

    } catch (error) {
      logger.error('Get rate limit info error:', error);
      next(error);
    }
  }
}

module.exports = new PublicController();