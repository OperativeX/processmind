const express = require('express');
const router = express.Router({ mergeParams: true });
const notificationController = require('../controllers/notificationController');

// @route   GET /api/v1/tenants/:tenantId/notifications
// @desc    Get user notifications
// @access  Private (Tenant)
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (Tenant)
router.put('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private (Tenant)
router.put('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/notifications/:id/archive
// @desc    Archive notification
// @access  Private (Tenant)
router.put('/:id/archive', (req, res, next) => notificationController.archiveNotification(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/notifications/pending-shares
// @desc    Get pending share invitations
// @access  Private (Tenant)
router.get('/pending-shares', (req, res, next) => notificationController.getPendingShares(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/notifications/shares/:shareId
// @desc    Get share details by ID
// @access  Private (Tenant)
router.get('/shares/:shareId', (req, res, next) => notificationController.getShareDetails(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/notifications/shares/:shareId/accept
// @desc    Accept share invitation
// @access  Private (Tenant)
router.post('/shares/:shareId/accept', (req, res, next) => notificationController.acceptShare(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/notifications/shares/:shareId/reject
// @desc    Reject share invitation
// @access  Private (Tenant)
router.post('/shares/:shareId/reject', (req, res, next) => notificationController.rejectShare(req, res, next));

module.exports = router;