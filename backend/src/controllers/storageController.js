const storageTrackingService = require('../services/storageTrackingService');
// Lazy load s3Service to prevent startup errors
const getS3Service = () => require('../services/s3Service').getInstance();
const { TenantUsage, UserUsage } = require('../models');
const logger = require('../utils/logger');

class StorageController {
  /**
   * Get storage usage overview for tenant
   * @route GET /api/v1/tenants/:tenantId/storage/usage
   * @access Private (Admin)
   */
  async getTenantStorageUsage(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { includeUsers = false, includeMonthlyBreakdown = false } = req.query;

      const report = await storageTrackingService.getTenantUsageReport(tenantId, {
        includeUsers: includeUsers === 'true',
        includeMonthlyBreakdown: includeMonthlyBreakdown === 'true'
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Tenant storage usage data not found'
        });
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Get tenant storage usage error:', error);
      next(error);
    }
  }

  /**
   * Get storage usage for current user
   * @route GET /api/v1/tenants/:tenantId/storage/my-usage
   * @access Private
   */
  async getUserStorageUsage(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userId = req.user.id;

      const report = await storageTrackingService.getUserUsageReport(userId, tenantId);

      if (!report) {
        // Return empty usage data if not found
        const emptyReport = {
          user: {
            id: userId,
            accountType: req.user.accountType || 'free'
          },
          storage: { usedMB: 0, totalGB: 0, videosMB: 0, audioMB: 0, otherMB: 0 },
          processes: { totalCount: 0, completedCount: 0, failedCount: 0 },
          currentMonth: { uploads: 0, storageMB: 0, processingMinutes: 0 },
          lastActivity: {},
          monthlyHistory: []
        };

        return res.json({
          success: true,
          data: emptyReport
        });
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Get user storage usage error:', error);
      next(error);
    }
  }

  /**
   * Sync tenant storage with actual S3 data
   * @route POST /api/v1/tenants/:tenantId/storage/sync-s3
   * @access Private (Admin)
   */
  async syncTenantStorageWithS3(req, res, next) {
    try {
      const { tenantId } = req.params;

      const syncResult = await storageTrackingService.syncTenantStorageWithS3(tenantId);

      res.json({
        success: true,
        message: 'Storage usage synced with S3 successfully',
        data: syncResult
      });

    } catch (error) {
      logger.error('Sync tenant storage with S3 error:', error);
      next(error);
    }
  }

  /**
   * Get platform-wide storage statistics (Super Admin only)
   * @route GET /api/v1/admin/storage/platform-stats
   * @access Super Admin
   */
  async getPlatformStorageStats(req, res, next) {
    try {
      // Check super admin permission
      if (req.user.systemRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      const stats = await storageTrackingService.getPlatformStorageStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Get platform storage stats error:', error);
      next(error);
    }
  }

  /**
   * Get top storage consuming tenants (Super Admin only)
   * @route GET /api/v1/admin/storage/top-tenants
   * @access Super Admin
   */
  async getTopConsumingTenants(req, res, next) {
    try {
      // Check super admin permission
      if (req.user.systemRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      const { limit = 20 } = req.query;
      const topTenants = await TenantUsage.getTopConsumers(parseInt(limit));

      const formattedResults = topTenants.map(usage => ({
        tenant: {
          id: usage.tenantId._id,
          name: usage.tenantId.name,
          domain: usage.tenantId.domain
        },
        storage: {
          ...usage.storage,
          totalGB: usage.storage.totalMB / 1024
        },
        files: usage.files,
        estimatedMonthlyCost: storageTrackingService.calculateMonthlyCosts(usage.storage.totalMB),
        lastSync: usage.lastSyncWithS3,
        updatedAt: usage.updatedAt
      }));

      res.json({
        success: true,
        data: {
          tenants: formattedResults,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get top consuming tenants error:', error);
      next(error);
    }
  }

  /**
   * Get top storage consuming users for tenant
   * @route GET /api/v1/tenants/:tenantId/storage/top-users
   * @access Private (Admin)
   */
  async getTopConsumingUsers(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { limit = 20 } = req.query;

      // Check if user has admin access to this tenant
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const topUsers = await UserUsage.getTopUsersByTenant(tenantId, parseInt(limit));

      const formattedResults = topUsers.map(usage => ({
        user: {
          id: usage.userId._id,
          name: usage.userId.fullName,
          email: usage.userId.email,
          accountType: usage.userId.accountType
        },
        storage: {
          ...usage.storage,
          totalGB: usage.storage.usedMB / 1024
        },
        processes: usage.processes,
        lastActivity: usage.lastActivity,
        updatedAt: usage.updatedAt
      }));

      res.json({
        success: true,
        data: {
          users: formattedResults,
          tenantId,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get top consuming users error:', error);
      next(error);
    }
  }

  /**
   * Get monthly storage trends for tenant
   * @route GET /api/v1/tenants/:tenantId/storage/trends
   * @access Private (Admin)
   */
  async getTenantStorageTrends(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { months = 12 } = req.query;

      // Check if user has admin access to this tenant
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months));

      const monthlyStats = await UserUsage.getMonthlyUsageStats(tenantId, startDate, endDate);

      res.json({
        success: true,
        data: {
          trends: monthlyStats,
          period: {
            startDate,
            endDate,
            months: parseInt(months)
          },
          tenantId
        }
      });

    } catch (error) {
      logger.error('Get tenant storage trends error:', error);
      next(error);
    }
  }

  /**
   * Cleanup orphaned storage tracking data (Super Admin only)
   * @route POST /api/v1/admin/storage/cleanup-orphaned
   * @access Super Admin
   */
  async cleanupOrphanedData(req, res, next) {
    try {
      // Check super admin permission
      if (req.user.systemRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      const cleanupResult = await storageTrackingService.cleanupOrphanedUsageData();

      res.json({
        success: true,
        message: 'Orphaned storage tracking data cleaned up successfully',
        data: cleanupResult
      });

    } catch (error) {
      logger.error('Cleanup orphaned storage data error:', error);
      next(error);
    }
  }

  /**
   * Reset monthly usage counters (Super Admin only)
   * @route POST /api/v1/admin/storage/reset-monthly-counters
   * @access Super Admin
   */
  async resetMonthlyCounters(req, res, next) {
    try {
      // Check super admin permission
      if (req.user.systemRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      const resetResult = await storageTrackingService.resetMonthlyUsageCounters();

      res.json({
        success: true,
        message: 'Monthly usage counters reset successfully',
        data: resetResult
      });

    } catch (error) {
      logger.error('Reset monthly counters error:', error);
      next(error);
    }
  }

  /**
   * Export storage usage data for billing (Super Admin only)
   * @route GET /api/v1/admin/storage/export-billing-data
   * @access Super Admin
   */
  async exportBillingData(req, res, next) {
    try {
      // Check super admin permission
      if (req.user.systemRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      const { startDate, endDate, format = 'json' } = req.query;

      // Get all tenant usage data
      const allTenantUsage = await TenantUsage.find({})
        .populate('tenantId', 'name domain createdAt')
        .sort({ 'storage.totalMB': -1 });

      const billingData = allTenantUsage.map(usage => ({
        tenant: {
          id: usage.tenantId._id,
          name: usage.tenantId.name,
          domain: usage.tenantId.domain,
          createdAt: usage.tenantId.createdAt
        },
        storage: {
          totalMB: usage.storage.totalMB,
          totalGB: usage.storage.totalMB / 1024,
          breakdown: {
            videosMB: usage.storage.videosMB,
            audioMB: usage.storage.audioMB,
            otherMB: usage.storage.otherMB
          }
        },
        files: usage.files,
        estimatedMonthlyCostEUR: storageTrackingService.calculateMonthlyCosts(usage.storage.totalMB),
        lastSyncWithS3: usage.lastSyncWithS3,
        updatedAt: usage.updatedAt
      }));

      const exportData = {
        exportedAt: new Date(),
        period: { startDate, endDate },
        totalTenants: billingData.length,
        totalStorageGB: billingData.reduce((sum, tenant) => sum + tenant.storage.totalGB, 0),
        totalEstimatedCostEUR: billingData.reduce((sum, tenant) => sum + tenant.estimatedMonthlyCostEUR, 0),
        tenants: billingData
      };

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = 'Tenant ID,Tenant Name,Domain,Storage (GB),Files Count,Monthly Cost (EUR),Last Sync\n';
        const csvRows = billingData.map(tenant => 
          `${tenant.tenant.id},${tenant.tenant.name},${tenant.tenant.domain},${tenant.storage.totalGB.toFixed(2)},${tenant.files.totalCount},${tenant.estimatedMonthlyCostEUR.toFixed(4)},${tenant.lastSyncWithS3 || 'Never'}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="storage-billing-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        res.json({
          success: true,
          data: exportData
        });
      }

    } catch (error) {
      logger.error('Export billing data error:', error);
      next(error);
    }
  }
}

module.exports = new StorageController();