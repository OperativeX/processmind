const TenantUsage = require('../models/TenantUsage');
const UserUsage = require('../models/UserUsage');
const logger = require('../utils/logger');

// Lazy load s3Service to prevent startup errors
let s3Service = null;
const getS3Service = () => {
  if (!s3Service) {
    s3Service = require('./s3Service').getInstance();
  }
  return s3Service;
};

class StorageTrackingService {
  constructor() {
    this.costPerGBPerMonth = 0.05; // Example: 5 cents per GB per month
    this.transferCostPerGB = 0.02; // Example: 2 cents per GB transfer
  }

  /**
   * Track file upload for user and tenant
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {number} fileSizeMB - File size in MB
   * @param {string} fileType - File type (video, audio, other)
   * @returns {Promise<Object>} Tracking result
   */
  async trackFileUpload(userId, tenantId, fileSizeMB, fileType = 'video') {
    try {
      logger.info('Tracking file upload', {
        userId,
        tenantId,
        fileSizeMB,
        fileType
      });

      // Update tenant usage
      const tenantUsage = await TenantUsage.findOrCreateByTenant(tenantId);
      await tenantUsage.addStorage(fileSizeMB, fileType);

      // Update user usage
      const userUsage = await UserUsage.findOrCreateByUser(userId, tenantId);
      await userUsage.addStorageUsage(fileSizeMB, fileType);
      await userUsage.incrementProcessCount();

      // Add monthly activity
      const currentMonth = new Date();
      await userUsage.addMonthlyActivity(currentMonth, {
        uploads: 1,
        storageMB: fileSizeMB
      });

      // Update tenant monthly stats
      await tenantUsage.addMonthlyStats(currentMonth, {
        processesCreated: 1,
        filesUploaded: 1,
        storageAdded: fileSizeMB
      });

      logger.info('File upload tracking completed', {
        userId,
        tenantId,
        fileSizeMB,
        fileType
      });

      return {
        success: true,
        tenantUsage: {
          totalMB: tenantUsage.storage.totalMB,
          filesCount: tenantUsage.files.totalCount
        },
        userUsage: {
          usedMB: userUsage.storage.usedMB,
          processesCount: userUsage.processes.totalCount
        }
      };

    } catch (error) {
      logger.error('Track file upload failed', {
        userId,
        tenantId,
        fileSizeMB,
        fileType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track file deletion for user and tenant
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {number} fileSizeMB - File size in MB
   * @param {string} fileType - File type (video, audio, other)
   * @returns {Promise<Object>} Tracking result
   */
  async trackFileDeletion(userId, tenantId, fileSizeMB, fileType = 'video') {
    try {
      logger.info('Tracking file deletion', {
        userId,
        tenantId,
        fileSizeMB,
        fileType
      });

      // Update tenant usage
      const tenantUsage = await TenantUsage.findOne({ tenantId });
      if (tenantUsage) {
        await tenantUsage.removeStorage(fileSizeMB, fileType);
      }

      // Update user usage
      const userUsage = await UserUsage.findOne({ userId, tenantId });
      if (userUsage) {
        await userUsage.removeStorageUsage(fileSizeMB, fileType);
      }

      // Add monthly activity for deletion
      if (tenantUsage) {
        const currentMonth = new Date();
        await tenantUsage.addMonthlyStats(currentMonth, {
          filesDeleted: 1,
          storageRemoved: fileSizeMB
        });
      }

      logger.info('File deletion tracking completed', {
        userId,
        tenantId,
        fileSizeMB,
        fileType
      });

      return {
        success: true,
        tenantUsage: tenantUsage ? {
          totalMB: tenantUsage.storage.totalMB,
          filesCount: tenantUsage.files.totalCount
        } : null,
        userUsage: userUsage ? {
          usedMB: userUsage.storage.usedMB,
          processesCount: userUsage.processes.totalCount
        } : null
      };

    } catch (error) {
      logger.error('Track file deletion failed', {
        userId,
        tenantId,
        fileSizeMB,
        fileType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track process completion for analytics
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {number} processingTimeMinutes - Processing time in minutes
   * @param {Object} apiUsage - API usage data (whisper, gpt calls)
   * @returns {Promise<void>}
   */
  async trackProcessCompletion(userId, tenantId, processingTimeMinutes, apiUsage = {}) {
    try {
      logger.info('Tracking process completion', {
        userId,
        tenantId,
        processingTimeMinutes,
        apiUsage
      });

      const userUsage = await UserUsage.findOrCreateByUser(userId, tenantId);
      await userUsage.markProcessCompleted();

      // Add monthly processing stats
      const currentMonth = new Date();
      await userUsage.addMonthlyActivity(currentMonth, {
        processingMinutes: processingTimeMinutes,
        whisperCalls: apiUsage.whisperCalls || 0,
        gptCalls: apiUsage.gptCalls || 0
      });

      logger.info('Process completion tracking completed', {
        userId,
        tenantId
      });

    } catch (error) {
      logger.error('Track process completion failed', {
        userId,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track process failure for analytics
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<void>}
   */
  async trackProcessFailure(userId, tenantId) {
    try {
      const userUsage = await UserUsage.findOrCreateByUser(userId, tenantId);
      await userUsage.markProcessFailed();

      logger.info('Process failure tracked', {
        userId,
        tenantId
      });

    } catch (error) {
      logger.error('Track process failure failed', {
        userId,
        tenantId,
        error: error.message
      });
    }
  }

  /**
   * Sync storage usage with actual S3 data for accuracy
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Sync result
   */
  async syncTenantStorageWithS3(tenantId) {
    try {
      logger.info('Starting S3 storage sync for tenant', { tenantId });

      // Get actual S3 usage
      const s3Usage = await getS3Service().getTenantStorageUsage(tenantId);

      // Update tenant usage with actual data
      const tenantUsage = await TenantUsage.findOrCreateByTenant(tenantId);
      
      tenantUsage.storage.totalMB = s3Usage.totalSizeMB;
      tenantUsage.storage.videosMB = s3Usage.breakdown.videos.size / (1024 * 1024);
      tenantUsage.storage.audioMB = s3Usage.breakdown.audio.size / (1024 * 1024);
      tenantUsage.storage.otherMB = s3Usage.breakdown.other.size / (1024 * 1024);
      
      tenantUsage.files.totalCount = s3Usage.totalFiles;
      tenantUsage.files.videosCount = s3Usage.breakdown.videos.count;
      tenantUsage.files.audioCount = s3Usage.breakdown.audio.count;
      
      tenantUsage.lastSyncWithS3 = new Date();
      
      await tenantUsage.save();

      logger.info('S3 storage sync completed for tenant', {
        tenantId,
        totalMB: tenantUsage.storage.totalMB,
        totalFiles: tenantUsage.files.totalCount
      });

      return {
        success: true,
        syncedAt: tenantUsage.lastSyncWithS3,
        storage: tenantUsage.storage,
        files: tenantUsage.files,
        differences: {
          storageDiffMB: tenantUsage.storage.totalMB - s3Usage.totalSizeMB,
          filesDiff: tenantUsage.files.totalCount - s3Usage.totalFiles
        }
      };

    } catch (error) {
      logger.error('S3 storage sync failed', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get storage usage report for tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Usage report
   */
  async getTenantUsageReport(tenantId, options = {}) {
    try {
      const { includeUsers = false, includeMonthlyBreakdown = false } = options;

      // Get tenant usage
      const tenantUsage = await TenantUsage.findOne({ tenantId })
        .populate('tenantId', 'name domain');

      if (!tenantUsage) {
        return null;
      }

      const report = {
        tenant: {
          id: tenantId,
          name: tenantUsage.tenantId?.name,
          domain: tenantUsage.tenantId?.domain
        },
        storage: {
          ...tenantUsage.storage,
          totalGB: tenantUsage.storage.totalMB / 1024,
          breakdown: {
            videos: { sizeMB: tenantUsage.storage.videosMB, sizeGB: tenantUsage.storage.videosMB / 1024 },
            audio: { sizeMB: tenantUsage.storage.audioMB, sizeGB: tenantUsage.storage.audioMB / 1024 },
            other: { sizeMB: tenantUsage.storage.otherMB, sizeGB: tenantUsage.storage.otherMB / 1024 }
          }
        },
        files: tenantUsage.files,
        costs: {
          estimatedMonthlyEUR: this.calculateMonthlyCosts(tenantUsage.storage.totalMB),
          lastCalculated: tenantUsage.estimatedCosts?.lastCalculated
        },
        lastSyncWithS3: tenantUsage.lastSyncWithS3
      };

      // Include user breakdown if requested
      if (includeUsers) {
        const userUsages = await UserUsage.find({ tenantId })
          .populate('userId', 'firstName lastName email accountType')
          .sort({ 'storage.usedMB': -1 });

        report.users = userUsages.map(usage => ({
          user: {
            id: usage.userId._id,
            name: usage.userId.fullName,
            email: usage.userId.email,
            accountType: usage.userId.accountType
          },
          storage: usage.storage,
          processes: usage.processes,
          lastActivity: usage.lastActivity
        }));
      }

      // Include monthly breakdown if requested
      if (includeMonthlyBreakdown && tenantUsage.monthlyStats.length > 0) {
        report.monthlyBreakdown = tenantUsage.monthlyStats
          .sort((a, b) => b.month - a.month)
          .slice(0, 12); // Last 12 months
      }

      return report;

    } catch (error) {
      logger.error('Get tenant usage report failed', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get storage usage report for user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} User usage report
   */
  async getUserUsageReport(userId, tenantId) {
    try {
      const userUsage = await UserUsage.findOne({ userId, tenantId })
        .populate('userId', 'firstName lastName email accountType');

      if (!userUsage) {
        return null;
      }

      const currentMonth = userUsage.getCurrentMonthStats();

      return {
        user: {
          id: userId,
          name: userUsage.userId.fullName,
          email: userUsage.userId.email,
          accountType: userUsage.userId.accountType
        },
        storage: {
          ...userUsage.storage,
          totalGB: userUsage.storage.usedMB / 1024
        },
        processes: userUsage.processes,
        currentMonth: currentMonth,
        lastActivity: userUsage.lastActivity,
        monthlyHistory: userUsage.monthlyStats
          .sort((a, b) => b.month - a.month)
          .slice(0, 6) // Last 6 months
      };

    } catch (error) {
      logger.error('Get user usage report failed', {
        userId,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate estimated monthly costs based on storage usage
   * @param {number} storageMB - Storage usage in MB
   * @returns {number} Estimated monthly cost in EUR
   */
  calculateMonthlyCosts(storageMB) {
    const storageGB = storageMB / 1024;
    return storageGB * this.costPerGBPerMonth;
  }

  /**
   * Get platform-wide storage statistics
   * @returns {Promise<Object>} Platform statistics
   */
  async getPlatformStorageStats() {
    try {
      const [tenantStats, userStats, s3BucketStats] = await Promise.all([
        TenantUsage.aggregate([
          {
            $group: {
              _id: null,
              totalTenants: { $sum: 1 },
              totalStorageMB: { $sum: '$storage.totalMB' },
              totalFiles: { $sum: '$files.totalCount' },
              totalVideosMB: { $sum: '$storage.videosMB' },
              totalAudioMB: { $sum: '$storage.audioMB' }
            }
          }
        ]),
        
        UserUsage.aggregate([
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              activeUsers: {
                $sum: {
                  $cond: [
                    { $gte: ['$lastActivity.uploadedAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        
        // Get actual S3 bucket statistics
        getS3Service().getBucketStats().catch(error => {
          logger.warn('Could not get S3 bucket stats', { error: error.message });
          return null;
        })
      ]);

      const platformStats = {
        tenants: tenantStats[0] || { totalTenants: 0, totalStorageMB: 0, totalFiles: 0 },
        users: userStats[0] || { totalUsers: 0, activeUsers: 0 },
        storage: {
          trackedMB: tenantStats[0]?.totalStorageMB || 0,
          trackedGB: (tenantStats[0]?.totalStorageMB || 0) / 1024,
          actualS3: s3BucketStats ? {
            sizeMB: s3BucketStats.totalSizeMB,
            sizeGB: s3BucketStats.totalSizeGB,
            files: s3BucketStats.totalFiles
          } : null
        },
        costs: {
          estimatedMonthlyEUR: this.calculateMonthlyCosts(tenantStats[0]?.totalStorageMB || 0)
        },
        generatedAt: new Date()
      };

      logger.info('Platform storage statistics generated', {
        tenants: platformStats.tenants.totalTenants,
        users: platformStats.users.totalUsers,
        storageMB: platformStats.storage.trackedMB
      });

      return platformStats;

    } catch (error) {
      logger.error('Get platform storage stats failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if user can upload file based on their limits
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {number} fileSizeMB - File size in MB
   * @param {string} accountType - Account type (free, pro)
   * @returns {Promise<Object>} Validation result
   */
  async validateUserUpload(userId, tenantId, fileSizeMB, accountType) {
    try {
      if (accountType === 'pro') {
        return { allowed: true, reason: 'pro_account' };
      }

      // Check free account limits
      const userUsage = await UserUsage.findOrCreateByUser(userId, tenantId);
      const currentMonthStats = userUsage.getCurrentMonthStats();

      // Monthly process limit (10 for free)
      if (currentMonthStats.uploads >= 10) {
        return {
          allowed: false,
          reason: 'monthly_limit_exceeded',
          limit: 10,
          current: currentMonthStats.uploads
        };
      }

      // Storage limit (20GB for free)
      const freeStorageLimitMB = 20 * 1024; // 20GB in MB
      if (userUsage.storage.usedMB + fileSizeMB > freeStorageLimitMB) {
        return {
          allowed: false,
          reason: 'storage_limit_exceeded',
          limitMB: freeStorageLimitMB,
          currentMB: userUsage.storage.usedMB,
          fileSizeMB: fileSizeMB,
          wouldExceedBy: (userUsage.storage.usedMB + fileSizeMB) - freeStorageLimitMB
        };
      }

      return { 
        allowed: true, 
        reason: 'within_limits',
        remaining: {
          uploads: 10 - currentMonthStats.uploads,
          storageMB: freeStorageLimitMB - userUsage.storage.usedMB
        }
      };

    } catch (error) {
      logger.error('Validate user upload failed', {
        userId,
        tenantId,
        fileSizeMB,
        accountType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cleanup orphaned usage tracking data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOrphanedUsageData() {
    try {
      logger.info('Starting cleanup of orphaned usage data');

      // Find tenant usage records without corresponding tenants
      const { Tenant } = require('../models');
      const orphanedTenantUsage = await TenantUsage.aggregate([
        {
          $lookup: {
            from: 'tenants',
            localField: 'tenantId',
            foreignField: '_id',
            as: 'tenant'
          }
        },
        {
          $match: { tenant: { $size: 0 } }
        },
        {
          $project: { _id: 1, tenantId: 1 }
        }
      ]);

      // Find user usage records without corresponding users
      const { User } = require('../models');
      const orphanedUserUsage = await UserUsage.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $match: { user: { $size: 0 } }
        },
        {
          $project: { _id: 1, userId: 1, tenantId: 1 }
        }
      ]);

      // Delete orphaned records
      const [deletedTenantUsage, deletedUserUsage] = await Promise.all([
        orphanedTenantUsage.length > 0 ? 
          TenantUsage.deleteMany({ 
            _id: { $in: orphanedTenantUsage.map(doc => doc._id) } 
          }) : { deletedCount: 0 },
        
        orphanedUserUsage.length > 0 ? 
          UserUsage.deleteMany({ 
            _id: { $in: orphanedUserUsage.map(doc => doc._id) } 
          }) : { deletedCount: 0 }
      ]);

      logger.info('Cleanup of orphaned usage data completed', {
        deletedTenantUsage: deletedTenantUsage.deletedCount,
        deletedUserUsage: deletedUserUsage.deletedCount
      });

      return {
        success: true,
        deleted: {
          tenantUsage: deletedTenantUsage.deletedCount,
          userUsage: deletedUserUsage.deletedCount
        }
      };

    } catch (error) {
      logger.error('Cleanup orphaned usage data failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reset monthly usage counters (to be run monthly)
   * @returns {Promise<Object>} Reset result
   */
  async resetMonthlyUsageCounters() {
    try {
      logger.info('Starting monthly usage counter reset');

      const { User } = require('../models');
      const currentMonth = new Date().getMonth();
      
      // Reset process counters for free accounts where month has changed
      const result = await User.updateMany(
        {
          accountType: 'free',
          $expr: {
            $ne: [
              { $month: '$usage.lastResetDate' },
              currentMonth + 1 // MongoDB months are 1-indexed
            ]
          }
        },
        {
          $set: {
            'usage.processesThisMonth': 0,
            'usage.lastResetDate': new Date()
          }
        }
      );

      logger.info('Monthly usage counter reset completed', {
        affectedUsers: result.modifiedCount
      });

      return {
        success: true,
        affectedUsers: result.modifiedCount
      };

    } catch (error) {
      logger.error('Reset monthly usage counters failed', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new StorageTrackingService();