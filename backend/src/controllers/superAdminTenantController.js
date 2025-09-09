const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Process = require('../models/Process');
const SystemSettings = require('../models/SystemSettings');
const TenantStatistics = require('../models/TenantStatistics');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Super Admin Tenant Management Controller
 * Handles tenant-specific operations and pricing
 */
class SuperAdminTenantController {
  /**
   * Get all tenants with detailed info
   * GET /api/v1/super-admin/tenants
   */
  static async getAllTenants(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search = '', 
        status = 'all',
        sortBy = 'createdAt',
        order = 'desc' 
      } = req.query;

      // Build query
      const query = {};
      
      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { domain: new RegExp(search, 'i') },
          { 'subscription.billingEmail': new RegExp(search, 'i') }
        ];
      }

      if (status !== 'all') {
        query.isActive = status === 'active';
      }

      // Get tenants with pagination
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

      const [tenants, total] = await Promise.all([
        Tenant.find(query)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Tenant.countDocuments(query)
      ]);

      // Enrich tenant data
      const enrichedTenants = await Promise.all(tenants.map(async (tenant) => {
        const [userCount, processCount, monthlyRevenue] = await Promise.all([
          User.countDocuments({ tenantId: tenant._id }),
          Process.countDocuments({ tenantId: tenant._id }),
          Tenant.findById(tenant._id).then(t => t.calculateMonthlyPrice())
        ]);

        return {
          ...tenant,
          userCount,
          processCount,
          monthlyRevenue,
          processesLastMonth: tenant.statistics?.processesLast30Days || 0
        };
      }));

      return res.json({
        success: true,
        tenants: enrichedTenants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Super admin get tenants error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tenants'
      });
    }
  }

  /**
   * Get detailed tenant information
   * GET /api/v1/super-admin/tenants/:tenantId
   */
  static async getTenantDetails(req, res) {
    try {
      const { tenantId } = req.params;

      // Validate ObjectId format
      if (!tenantId || !tenantId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.warn('Invalid tenant ID format:', { tenantId });
        return res.status(400).json({
          success: false,
          message: 'Invalid tenant ID format'
        });
      }

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        logger.warn('Tenant not found:', { tenantId });
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Get additional details
      const [
        users,
        processCount,
        recentProcesses,
        storageUsed,
        growthMetrics
      ] = await Promise.all([
        User.find({ tenantId }).select('email firstName lastName role createdAt'),
        Process.countDocuments({ tenantId }),
        Process.find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('title status createdAt'),
        Process.aggregate([
          { $match: { tenantId: tenant._id } },
          { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
        ]),
        TenantStatistics.getGrowthMetrics(tenantId, 90)
      ]);

      const monthlyRevenue = await tenant.calculateMonthlyPrice();
      const billableUsers = tenant.calculateBillableProUsers();

      return res.json({
        success: true,
        tenant: {
          ...tenant.toObject(),
          users: users.map(u => ({
            id: u._id,
            email: u.email,
            name: `${u.firstName} ${u.lastName}`,
            role: u.role,
            createdAt: u.createdAt
          })),
          metrics: {
            userCount: users.length,
            processCount,
            storageUsedMB: Math.round((storageUsed[0]?.totalSize || 0) / 1024 / 1024),
            monthlyRevenue,
            billableUsers,
            recentProcesses: recentProcesses.map(p => ({
              id: p._id,
              title: p.title,
              status: p.status,
              createdAt: p.createdAt
            }))
          },
          growth: growthMetrics
        }
      });

    } catch (error) {
      logger.error('Super admin get tenant details error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tenant details'
      });
    }
  }

  /**
   * Update tenant pricing
   * PUT /api/v1/super-admin/tenants/:tenantId/pricing
   */
  static async updateTenantPricing(req, res) {
    try {
      const { tenantId } = req.params;
      const { 
        enabled, 
        pricePerUser, 
        freeUsers, 
        notes,
        maxUsers
      } = req.body;

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Update custom pricing
      tenant.billing.customPricing = {
        enabled: enabled !== undefined ? enabled : tenant.billing.customPricing?.enabled,
        pricePerUser: pricePerUser !== undefined ? pricePerUser : tenant.billing.customPricing?.pricePerUser,
        freeUsers: freeUsers !== undefined ? freeUsers : tenant.billing.customPricing?.freeUsers,
        notes: notes !== undefined ? notes : tenant.billing.customPricing?.notes
      };

      // Update max users if provided
      if (maxUsers !== undefined) {
        tenant.limits.maxUsers = maxUsers;
      }

      await tenant.save();

      // Log the pricing change
      logger.info('Tenant pricing updated by super admin', {
        tenantId,
        customPricing: tenant.billing.customPricing,
        maxUsers: tenant.limits.maxUsers,
        superAdmin: req.superAdmin.email
      });

      // Calculate new monthly price
      const monthlyPrice = await tenant.calculateMonthlyPrice();

      return res.json({
        success: true,
        message: 'Tenant pricing updated successfully',
        pricing: {
          customPricing: tenant.billing.customPricing,
          maxUsers: tenant.limits.maxUsers,
          monthlyPrice
        }
      });

    } catch (error) {
      logger.error('Super admin update pricing error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update tenant pricing'
      });
    }
  }

  /**
   * Update tenant status
   * PUT /api/v1/super-admin/tenants/:tenantId/status
   */
  static async updateTenantStatus(req, res) {
    try {
      const { tenantId } = req.params;
      const { isActive, reason } = req.body;

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      const previousStatus = tenant.isActive;
      tenant.isActive = isActive;
      await tenant.save();

      // Log status change
      logger.info('Tenant status changed by super admin', {
        tenantId,
        previousStatus,
        newStatus: isActive,
        reason,
        superAdmin: req.superAdmin.email
      });

      // Send notification email to tenant owner
      const owner = await User.findOne({ 
        tenantId, 
        role: 'owner' 
      });

      if (owner && owner.email) {
        const emailTemplate = isActive 
          ? 'tenantReactivated' 
          : 'tenantSuspended';
        
        await emailService.sendEmail(
          owner.email,
          emailTemplate,
          {
            tenantName: tenant.name,
            reason: reason || 'No reason provided',
            contactEmail: process.env.SUPPORT_EMAIL || 'support@processmind.com'
          }
        );
      }

      return res.json({
        success: true,
        message: `Tenant ${isActive ? 'activated' : 'deactivated'} successfully`
      });

    } catch (error) {
      logger.error('Super admin update status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update tenant status'
      });
    }
  }

  /**
   * Get tenant statistics
   * GET /api/v1/super-admin/tenants/:tenantId/stats
   */
  static async getTenantStats(req, res) {
    try {
      const { tenantId } = req.params;
      const { period = '30' } = req.query;

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Get statistics from TenantStatistics collection
      const stats = await TenantStatistics.find({
        tenantId,
        type: 'daily',
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });

      // Aggregate totals
      const totals = stats.reduce((acc, stat) => ({
        newProcesses: acc.newProcesses + stat.metrics.newProcesses,
        apiCalls: acc.apiCalls + stat.metrics.apiCalls,
        transcriptionMinutes: acc.transcriptionMinutes + stat.metrics.transcriptionMinutes,
        estimatedCost: acc.estimatedCost + stat.metrics.estimatedCost
      }), {
        newProcesses: 0,
        apiCalls: 0,
        transcriptionMinutes: 0,
        estimatedCost: 0
      });

      return res.json({
        success: true,
        stats: {
          period: `${period} days`,
          totals,
          daily: stats.map(s => ({
            date: s.date,
            processes: s.metrics.newProcesses,
            users: s.metrics.activeUsers,
            apiCalls: s.metrics.apiCalls,
            cost: s.metrics.estimatedCost
          })),
          summary: {
            averageProcessesPerDay: totals.newProcesses / parseInt(period),
            averageCostPerDay: totals.estimatedCost / parseInt(period),
            projectedMonthlyCost: (totals.estimatedCost / parseInt(period)) * 30
          }
        }
      });

    } catch (error) {
      logger.error('Super admin get tenant stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tenant statistics'
      });
    }
  }

  /**
   * Send message to tenant
   * POST /api/v1/super-admin/tenants/:tenantId/send-message
   */
  static async sendMessageToTenant(req, res) {
    try {
      const { tenantId } = req.params;
      const { subject, message, sendToAllUsers = false } = req.body;

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Get recipients
      const query = { tenantId };
      if (!sendToAllUsers) {
        query.role = { $in: ['owner', 'admin'] };
      }

      const users = await User.find(query).select('email firstName');

      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No users found for this tenant'
        });
      }

      // Send emails
      const emailPromises = users.map(user => 
        emailService.sendEmail(
          user.email,
          'adminMessage',
          {
            subject,
            message,
            firstName: user.firstName || 'User',
            tenantName: tenant.name
          }
        )
      );

      await Promise.all(emailPromises);

      logger.info('Message sent to tenant users', {
        tenantId,
        recipientCount: users.length,
        subject,
        superAdmin: req.superAdmin.email
      });

      return res.json({
        success: true,
        message: `Message sent to ${users.length} users`
      });

    } catch (error) {
      logger.error('Super admin send message error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  }

  /**
   * Get global pricing settings
   * GET /api/v1/super-admin/settings/pricing
   */
  static async getGlobalPricingSettings(req, res) {
    try {
      const settings = await SystemSettings.getPricingSettings();

      return res.json({
        success: true,
        pricing: settings.value
      });

    } catch (error) {
      logger.error('Super admin get pricing settings error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pricing settings'
      });
    }
  }

  /**
   * Update global pricing settings
   * PUT /api/v1/super-admin/settings/pricing
   */
  static async updateGlobalPricingSettings(req, res) {
    try {
      const { defaultFreeUsers, defaultPricePerUser, currency } = req.body;

      const settings = await SystemSettings.findOneAndUpdate(
        { key: 'pricing' },
        {
          $set: {
            'value.defaultFreeUsers': defaultFreeUsers,
            'value.defaultPricePerUser': defaultPricePerUser,
            'value.currency': currency
          }
        },
        { new: true }
      );

      logger.info('Global pricing settings updated', {
        settings: settings.value,
        superAdmin: req.superAdmin.email
      });

      return res.json({
        success: true,
        message: 'Global pricing settings updated',
        pricing: settings.value
      });

    } catch (error) {
      logger.error('Super admin update pricing settings error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update pricing settings'
      });
    }
  }
}

module.exports = SuperAdminTenantController;