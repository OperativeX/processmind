const { User } = require('../models');
const logger = require('../utils/logger');

// Middleware to check upload limits and send smart alerts
const checkUploadLimits = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Pro users have unlimited uploads
    if (user.accountType === 'pro' || user.plan_type === 'pro') {
      return next();
    }

    // Check if user can create process
    if (!user.canCreateProcess()) {
      const uploadsUsed = user.monthly_uploads_used || user.usage.processesThisMonth || 0;
      
      return res.status(403).json({
        success: false,
        message: 'Monthly upload limit reached',
        error: {
          code: 'UPLOAD_LIMIT_REACHED',
          details: {
            uploadsUsed,
            uploadLimit: 10,
            resetDate: user.uploads_reset_date || user.usage.lastResetDate,
            suggestion: 'Upgrade to Pro for unlimited uploads'
          }
        }
      });
    }

    // Check if user should receive alert
    const percentage = user.getUploadUsagePercentage();
    const shouldAlert = user.shouldReceiveUploadAlert();

    // Add alert info to request for later processing
    if (shouldAlert) {
      req.uploadAlert = {
        type: 'upload_limit_approaching',
        percentage,
        uploadsUsed: user.monthly_uploads_used || user.usage.processesThisMonth || 0,
        uploadLimit: 10,
        remaining: 10 - (user.monthly_uploads_used || user.usage.processesThisMonth || 0)
      };
    }

    // Add usage info to response locals for frontend
    res.locals.usageInfo = {
      uploadsUsed: user.monthly_uploads_used || user.usage.processesThisMonth || 0,
      uploadLimit: 10,
      percentage,
      resetDate: user.uploads_reset_date || user.usage.lastResetDate
    };

    next();
  } catch (error) {
    logger.error('Error checking upload limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check upload limits'
    });
  }
};

// Middleware to process upload alerts after successful upload
const processUploadAlerts = async (req, res, next) => {
  try {
    if (req.uploadAlert && req.user?.id) {
      const user = await User.findById(req.user.id);
      
      if (user && !user.usage_alerts_sent.upload_80_percent) {
        // Mark alert as sent
        await user.markAlertSent('upload');
        
        // Add alert to response for frontend
        if (res.locals) {
          res.locals.alert = {
            type: 'warning',
            title: 'Upload Limit Approaching',
            message: `You've used ${req.uploadAlert.uploadsUsed} of your 10 monthly uploads (${req.uploadAlert.percentage}%)`,
            action: {
              text: 'Upgrade to Pro',
              link: '/settings/billing'
            }
          };
        }
        
        logger.info(`Upload limit alert sent to user ${user.email}`, {
          userId: user._id,
          percentage: req.uploadAlert.percentage,
          uploadsUsed: req.uploadAlert.uploadsUsed
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error processing upload alerts:', error);
    // Don't fail the request, just log the error
    next();
  }
};

// Middleware to check storage limits (for file size)
const checkStorageLimits = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const fileSizeMB = req.body?.fileSizeMB || req.headers['x-file-size-mb'];
    
    if (!userId || !fileSizeMB) {
      return next();
    }

    const user = await User.findById(userId);
    if (!user) {
      return next();
    }

    // Pro users have unlimited storage
    if (user.accountType === 'pro' || user.plan_type === 'pro') {
      return next();
    }

    // Check storage limit
    if (!user.canUploadSize(parseFloat(fileSizeMB))) {
      const storageUsedGB = Math.round((user.usage.storageUsedMB / 1024) * 100) / 100;
      const fileSizeGB = Math.round((parseFloat(fileSizeMB) / 1024) * 100) / 100;
      
      return res.status(403).json({
        success: false,
        message: 'Storage limit would be exceeded',
        error: {
          code: 'STORAGE_LIMIT_EXCEEDED',
          details: {
            storageUsedGB,
            storageLimit: 20,
            fileSizeGB,
            totalAfterUpload: storageUsedGB + fileSizeGB,
            suggestion: 'Upgrade to Pro for unlimited storage'
          }
        }
      });
    }

    // Check if approaching storage limit (80%)
    const storagePercentage = Math.round((user.usage.storageUsedMB / 20480) * 100);
    if (storagePercentage >= 80 && !user.usage_alerts_sent.storage_80_percent) {
      req.storageAlert = {
        type: 'storage_limit_approaching',
        percentage: storagePercentage,
        storageUsedGB: Math.round((user.usage.storageUsedMB / 1024) * 100) / 100,
        storageLimit: 20
      };
    }

    next();
  } catch (error) {
    logger.error('Error checking storage limits:', error);
    next();
  }
};

module.exports = {
  checkUploadLimits,
  processUploadAlerts,
  checkStorageLimits
};