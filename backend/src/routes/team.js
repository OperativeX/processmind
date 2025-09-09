const express = require('express');
const router = express.Router({ mergeParams: true });
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/authMiddleware');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { validateTeam } = require('../middleware/validation');

// All routes require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// @route   GET /api/v1/tenants/:tenantId/team/members
// @desc    Get team members
// @access  Private (All users)
router.get('/members', teamController.getTeamMembers);

// @route   GET /api/v1/tenants/:tenantId/team/billing-status
// @desc    Get team billing status
// @access  Private (All users)
router.get('/billing-status', teamController.getBillingStatus);

// @route   POST /api/v1/tenants/:tenantId/team/invite
// @desc    Invite user to team
// @access  Private (Owner/Admin only)
router.post('/invite', validateTeam.inviteUser, teamController.inviteUser);

// @route   GET /api/v1/tenants/:tenantId/team/invitations
// @desc    Get pending invitations
// @access  Private (Owner/Admin only)
router.get('/invitations', teamController.getInvitations);

// @route   DELETE /api/v1/tenants/:tenantId/team/invitations/:invitationId
// @desc    Cancel invitation
// @access  Private (Owner/Admin only)
router.delete('/invitations/:invitationId', teamController.cancelInvitation);

// @route   POST /api/v1/tenants/:tenantId/team/invitations/:invitationId/resend
// @desc    Resend invitation
// @access  Private (Owner/Admin only)
router.post('/invitations/:invitationId/resend', teamController.resendInvitation);

// @route   PUT /api/v1/tenants/:tenantId/team/members/:userId/role
// @desc    Update user role
// @access  Private (Owner only)
router.put('/members/:userId/role', validateTeam.updateRole, teamController.updateUserRole);

// @route   DELETE /api/v1/tenants/:tenantId/team/members/:userId
// @desc    Remove user from team
// @access  Private (Owner/Admin only)
router.delete('/members/:userId', teamController.removeUser);

module.exports = router;