const express = require('express');
const router = express.Router();
const SuperAdminAuthController = require('../controllers/superAdminAuthController');
const SuperAdminDashboardController = require('../controllers/superAdminDashboardController');
const SuperAdminTenantController = require('../controllers/superAdminTenantController');
const SuperAdminAuthMiddleware = require('../middleware/superAdminAuthMiddleware');

/**
 * Super Admin Routes
 * All routes prefixed with /api/v1/super-admin
 */

// Auth routes (no auth middleware needed)
router.post('/auth/login', SuperAdminAuthController.login);

// Protected routes (require super admin auth)
router.use(SuperAdminAuthMiddleware.authenticate);

// Auth verification routes
router.get('/auth/verify', SuperAdminAuthController.verify);
router.get('/auth/session', SuperAdminAuthController.getSession);

// Dashboard routes
router.get('/dashboard/stats', SuperAdminDashboardController.getStats);
router.get('/dashboard/activity', SuperAdminDashboardController.getRecentActivity);
router.get('/dashboard/growth', SuperAdminDashboardController.getGrowthMetrics);

// Tenant management routes
router.get('/tenants', SuperAdminTenantController.getAllTenants);
router.get('/tenants/:tenantId', SuperAdminTenantController.getTenantDetails);

// Manual upgrade endpoint (temporary fix)
router.post('/tenants/:tenantId/upgrade-to-pro', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const Tenant = require('../models/Tenant');
    const User = require('../models/User');
    
    // Find and upgrade tenant
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Upgrade tenant to Pro
    await tenant.upgradeToProPlan();
    
    // Find and upgrade all users in this tenant
    const users = await User.find({ tenantId: tenant._id });
    let upgradedCount = 0;
    
    for (const user of users) {
      await user.upgradeToProAccount();
      upgradedCount++;
    }
    
    res.json({
      success: true,
      message: `Successfully upgraded tenant ${tenant.name} to Pro plan`,
      data: {
        tenant: tenant.name,
        upgradedUsers: upgradedCount,
        users: users.map(u => ({ email: u.email, accountType: u.accountType }))
      }
    });
  } catch (error) {
    console.error('Error upgrading tenant to Pro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade tenant',
      error: error.message
    });
  }
});
router.put('/tenants/:tenantId/pricing', SuperAdminTenantController.updateTenantPricing);
router.put('/tenants/:tenantId/status', SuperAdminTenantController.updateTenantStatus);
router.get('/tenants/:tenantId/stats', SuperAdminTenantController.getTenantStats);
router.post('/tenants/:tenantId/send-message', SuperAdminTenantController.sendMessageToTenant);

// System settings routes
router.get('/settings/pricing', SuperAdminTenantController.getGlobalPricingSettings);
router.put('/settings/pricing', SuperAdminTenantController.updateGlobalPricingSettings);

// Export routes
router.get('/export/tenants', SuperAdminDashboardController.exportTenantData);
router.get('/export/analytics', SuperAdminDashboardController.exportAnalytics);

module.exports = router;