const Tenant = require('../models/Tenant');
const Process = require('../models/Process');
const User = require('../models/User');
const TenantStatistics = require('../models/TenantStatistics');
const logger = require('../utils/logger');

/**
 * Super Admin Dashboard Controller
 * Provides analytics and overview data
 */
class SuperAdminDashboardController {
  /**
   * Get overall platform statistics
   * GET /api/v1/super-admin/dashboard/stats
   */
  static async getStats(req, res) {
    try {
      const [
        totalTenants,
        activeTenants,
        totalUsers,
        totalProcesses,
        monthlyStats
      ] = await Promise.all([
        Tenant.countDocuments(),
        Tenant.countDocuments({ isActive: true }),
        User.countDocuments(),
        Process.countDocuments(),
        TenantStatistics.aggregate([
          {
            $match: {
              type: 'daily',
              date: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: null,
              totalNewProcesses: { $sum: '$metrics.newProcesses' },
              totalNewUsers: { $sum: '$metrics.newUsers' },
              totalApiCalls: { $sum: '$metrics.apiCalls' },
              totalEstimatedCost: { $sum: '$metrics.estimatedCost' }
            }
          }
        ])
      ]);

      // Calculate revenue
      const tenants = await Tenant.find({ isActive: true });
      let monthlyRevenue = 0;
      
      for (const tenant of tenants) {
        monthlyRevenue += await tenant.calculateMonthlyPrice();
      }

      return res.json({
        success: true,
        stats: {
          tenants: {
            total: totalTenants,
            active: activeTenants,
            inactive: totalTenants - activeTenants
          },
          users: {
            total: totalUsers,
            newThisMonth: monthlyStats[0]?.totalNewUsers || 0
          },
          processes: {
            total: totalProcesses,
            newThisMonth: monthlyStats[0]?.totalNewProcesses || 0
          },
          revenue: {
            monthlyRecurring: monthlyRevenue,
            currency: 'EUR'
          },
          apiUsage: {
            totalCallsThisMonth: monthlyStats[0]?.totalApiCalls || 0,
            estimatedCostThisMonth: monthlyStats[0]?.totalEstimatedCost || 0
          }
        }
      });

    } catch (error) {
      logger.error('Super admin dashboard stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }

  /**
   * Get recent platform activity
   * GET /api/v1/super-admin/dashboard/activity
   */
  static async getRecentActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;

      // Get recent tenant registrations
      const recentTenants = await Tenant.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name domain createdAt subscription.plan');

      // Get recent processes
      const recentProcesses = await Process.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'email firstName lastName')
        .populate('tenantId', 'name domain')
        .select('title status createdAt userId tenantId');

      // Get recent user registrations
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('tenantId', 'name')
        .select('email firstName lastName role createdAt tenantId');

      return res.json({
        success: true,
        activity: {
          recentTenants: recentTenants.map(t => ({
            id: t._id,
            name: t.name,
            domain: t.domain,
            plan: t.subscription.plan,
            createdAt: t.createdAt
          })),
          recentProcesses: recentProcesses.map(p => ({
            id: p._id,
            title: p.title,
            status: p.status,
            userName: p.userId ? `${p.userId.firstName} ${p.userId.lastName}` : 'Unknown',
            userEmail: p.userId?.email,
            tenantName: p.tenantId?.name,
            createdAt: p.createdAt
          })),
          recentUsers: recentUsers.map(u => ({
            id: u._id,
            email: u.email,
            name: `${u.firstName} ${u.lastName}`,
            role: u.role,
            tenantName: u.tenantId?.name,
            createdAt: u.createdAt
          }))
        }
      });

    } catch (error) {
      logger.error('Super admin activity error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activity'
      });
    }
  }

  /**
   * Get growth metrics
   * GET /api/v1/super-admin/dashboard/growth
   */
  static async getGrowthMetrics(req, res) {
    try {
      const period = req.query.period || '30'; // days
      const periodDays = parseInt(period);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get daily growth data
      const dailyStats = await TenantStatistics.aggregate([
        {
          $match: {
            type: 'daily',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
            },
            newProcesses: { $sum: '$metrics.newProcesses' },
            newUsers: { $sum: '$metrics.newUsers' },
            activeUsers: { $sum: '$metrics.activeUsers' },
            revenue: { $sum: { $multiply: ['$metrics.totalUsers', 10] } } // Simplified calculation
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ]);

      // Calculate growth rates
      const calculateGrowthRate = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      // Get current vs previous period metrics
      const midPoint = Math.floor(periodDays / 2);
      const currentPeriodStats = dailyStats.slice(midPoint);
      const previousPeriodStats = dailyStats.slice(0, midPoint);

      const sumMetrics = (stats, field) => 
        stats.reduce((sum, stat) => sum + (stat[field] || 0), 0);

      const currentMetrics = {
        processes: sumMetrics(currentPeriodStats, 'newProcesses'),
        users: sumMetrics(currentPeriodStats, 'newUsers'),
        revenue: sumMetrics(currentPeriodStats, 'revenue')
      };

      const previousMetrics = {
        processes: sumMetrics(previousPeriodStats, 'newProcesses'),
        users: sumMetrics(previousPeriodStats, 'newUsers'),
        revenue: sumMetrics(previousPeriodStats, 'revenue')
      };

      const growthRates = {
        processes: calculateGrowthRate(currentMetrics.processes, previousMetrics.processes),
        users: calculateGrowthRate(currentMetrics.users, previousMetrics.users),
        revenue: calculateGrowthRate(currentMetrics.revenue, previousMetrics.revenue)
      };

      return res.json({
        success: true,
        growth: {
          period: `${periodDays} days`,
          currentPeriod: currentMetrics,
          previousPeriod: previousMetrics,
          growthRates,
          dailyStats: dailyStats.map(stat => ({
            date: stat._id.date,
            processes: stat.newProcesses,
            users: stat.newUsers,
            activeUsers: stat.activeUsers,
            revenue: stat.revenue
          }))
        }
      });

    } catch (error) {
      logger.error('Super admin growth metrics error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch growth metrics'
      });
    }
  }

  /**
   * Export tenant data
   * GET /api/v1/super-admin/export/tenants
   */
  static async exportTenantData(req, res) {
    try {
      const tenants = await Tenant.find()
        .populate('limits')
        .lean();

      const exportData = await Promise.all(tenants.map(async (tenant) => {
        const userCount = await User.countDocuments({ tenantId: tenant._id });
        const processCount = await Process.countDocuments({ tenantId: tenant._id });
        const monthlyPrice = await Tenant.findById(tenant._id).then(t => t.calculateMonthlyPrice());

        return {
          name: tenant.name,
          domain: tenant.domain,
          status: tenant.isActive ? 'Active' : 'Inactive',
          plan: tenant.subscription.plan,
          createdAt: tenant.createdAt,
          userCount,
          processCount,
          totalProcesses: tenant.statistics?.totalProcesses || 0,
          processesLast30Days: tenant.statistics?.processesLast30Days || 0,
          monthlyPrice,
          customPricing: tenant.billing?.customPricing?.enabled || false,
          pricePerUser: tenant.billing?.customPricing?.pricePerUser,
          freeUsers: tenant.billing?.customPricing?.freeUsers
        };
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tenants-export.csv');

      // Create CSV
      const csvHeaders = [
        'Name', 'Domain', 'Status', 'Plan', 'Created Date',
        'User Count', 'Process Count', 'Total Processes',
        'Processes Last 30 Days', 'Monthly Price (EUR)',
        'Custom Pricing', 'Price Per User', 'Free Users'
      ].join(',');

      const csvRows = exportData.map(tenant => [
        tenant.name,
        tenant.domain || '',
        tenant.status,
        tenant.plan,
        new Date(tenant.createdAt).toISOString().split('T')[0],
        tenant.userCount,
        tenant.processCount,
        tenant.totalProcesses,
        tenant.processesLast30Days,
        tenant.monthlyPrice,
        tenant.customPricing ? 'Yes' : 'No',
        tenant.pricePerUser || '',
        tenant.freeUsers || ''
      ].map(val => `"${val}"`).join(','));

      const csv = [csvHeaders, ...csvRows].join('\n');
      return res.send(csv);

    } catch (error) {
      logger.error('Super admin export error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export tenant data'
      });
    }
  }

  /**
   * Export analytics data
   * GET /api/v1/super-admin/export/analytics
   */
  static async exportAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const analyticsData = await TenantStatistics.find({
        type: 'daily',
        date: { $gte: start, $lte: end }
      })
      .populate('tenantId', 'name')
      .sort({ date: -1 })
      .lean();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');

      // Create CSV
      const csvHeaders = [
        'Date', 'Tenant', 'New Processes', 'Total Processes',
        'Active Users', 'New Users', 'API Calls',
        'Transcription Minutes', 'Estimated Cost'
      ].join(',');

      const csvRows = analyticsData.map(stat => [
        new Date(stat.date).toISOString().split('T')[0],
        stat.tenantId?.name || 'Unknown',
        stat.metrics.newProcesses,
        stat.metrics.totalProcesses,
        stat.metrics.activeUsers,
        stat.metrics.newUsers,
        stat.metrics.apiCalls,
        stat.metrics.transcriptionMinutes,
        stat.metrics.estimatedCost
      ].map(val => `"${val}"`).join(','));

      const csv = [csvHeaders, ...csvRows].join('\n');
      return res.send(csv);

    } catch (error) {
      logger.error('Super admin analytics export error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export analytics data'
      });
    }
  }
}

module.exports = SuperAdminDashboardController;