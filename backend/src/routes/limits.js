const express = require('express');
const router = express.Router();
const { User } = require('../models');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

// Get user limits and usage (for Free accounts)
router.get('/user-limits', authMiddleware, async (req, res) => {
  try {
    const { id: userId } = req.user;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const limits = {
      accountType: user.accountType,
      canCreateProcess: user.canCreateProcess(),
      limits: {}
    };

    if (user.accountType === 'free') {
      // Ensure user has usage data (for users created before this feature)
      if (!user.usage) {
        user.usage = {
          processesThisMonth: 0,
          storageUsedMB: 0,
          lastResetDate: new Date()
        };
        await user.save();
      }

      // Reset monthly usage if needed
      const currentMonth = new Date().getMonth();
      const resetMonth = new Date(user.usage.lastResetDate).getMonth();
      
      if (currentMonth !== resetMonth) {
        user.usage.processesThisMonth = 0;
        user.usage.lastResetDate = new Date();
        await user.save();
      }

      // Use the same logic as uploadLimitMiddleware to check both fields
      const uploadsUsed = user.monthly_uploads_used || user.usage.processesThisMonth || 0;
      
      limits.limits = {
        processes: {
          current: uploadsUsed,
          max: 10,
          remaining: Math.max(0, 10 - uploadsUsed)
        },
        storage: {
          currentMB: user.usage.storageUsedMB || 0,
          currentGB: Math.round(((user.usage.storageUsedMB || 0) / 1024) * 100) / 100,
          maxMB: 20480, // 20GB in MB
          maxGB: 20,
          remainingMB: Math.max(0, 20480 - (user.usage.storageUsedMB || 0)),
          remainingGB: Math.round(Math.max(0, (20480 - (user.usage.storageUsedMB || 0)) / 1024) * 100) / 100,
          usagePercentage: Math.round(((user.usage.storageUsedMB || 0) / 20480) * 100)
        }
      };
    } else {
      // Pro accounts have unlimited
      limits.limits = {
        processes: {
          unlimited: true
        },
        storage: {
          unlimited: true
        }
      };
    }

    res.json({
      success: true,
      data: limits
    });
  } catch (error) {
    logger.error('Error getting user limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user limits'
    });
  }
});

// Check if user can upload a specific file size
router.post('/check-upload', authMiddleware, async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { fileSizeMB } = req.body;
    
    if (!fileSizeMB || fileSizeMB <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid file size required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const canUpload = {
      allowed: true,
      reasons: []
    };

    if (user.accountType === 'free') {
      // Check process limit
      if (!user.canCreateProcess()) {
        canUpload.allowed = false;
        canUpload.reasons.push({
          type: 'PROCESS_LIMIT',
          message: 'Monthly upload limit reached (10 processes)',
          current: user.usage.processesThisMonth,
          max: 10
        });
      }

      // Check storage limit
      if (!user.canUploadSize(fileSizeMB)) {
        canUpload.allowed = false;
        canUpload.reasons.push({
          type: 'STORAGE_LIMIT',
          message: `Storage limit would be exceeded`,
          currentGB: Math.round((user.usage.storageUsedMB / 1024) * 100) / 100,
          fileSizeGB: Math.round((fileSizeMB / 1024) * 100) / 100,
          maxGB: 20
        });
      }
    }

    res.json({
      success: true,
      data: canUpload
    });
  } catch (error) {
    logger.error('Error checking upload permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check upload permission'
    });
  }
});

module.exports = router;