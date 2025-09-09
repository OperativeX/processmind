const express = require('express');
const router = express.Router({ mergeParams: true });
const userController = require('../controllers/userController');

// @route   GET /api/v1/tenants/:tenantId/users
// @desc    Get all users in tenant
// @access  Private (Tenant)
router.get('/', (req, res, next) => userController.getTenantUsers(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/users/search
// @desc    Get user by email within tenant
// @access  Private (Tenant)
router.get('/search', (req, res, next) => userController.getUserByEmail(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/users/check-email
// @desc    Check if email exists in tenant
// @access  Private (Tenant)
router.post('/check-email', (req, res, next) => userController.checkEmailExists(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/users/stats
// @desc    Get tenant user statistics
// @access  Private (Tenant, Admin/Owner only)
router.get('/stats', (req, res, next) => userController.getTenantUserStats(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/users/:userId/role
// @desc    Update user role
// @access  Private (Tenant, Admin/Owner only)
router.put('/:userId/role', (req, res, next) => userController.updateUserRole(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/users/:userId/deactivate
// @desc    Deactivate user
// @access  Private (Tenant, Admin/Owner only)
router.post('/:userId/deactivate', (req, res, next) => userController.deactivateUser(req, res, next));

module.exports = router;