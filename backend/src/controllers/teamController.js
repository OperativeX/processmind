const { User, Tenant, UserInvitation, SystemSettings } = require('../models');
const invitationService = require('../services/invitationService');
const logger = require('../utils/logger');

class TeamController {
  /**
   * Get team members
   * @route GET /api/v1/tenants/:tenantId/team/members
   */
  async getTeamMembers(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { page = 1, limit = 50, role, search } = req.query;
      
      // Get tenant and check if teams are allowed
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }
      
      // Check if tenant has team access (Pro accounts only)
      if (tenant.subscription.plan === 'free' || !tenant.limits.allowTeams) {
        return res.status(403).json({
          success: false,
          message: 'Team management not available for Free accounts. Upgrade to Pro to access team features.',
          code: 'TEAMS_NOT_AVAILABLE',
          upgradeRequired: true
        });
      }
      
      // Build query
      const query = {
        tenantId,
        isActive: true
      };
      
      if (role) {
        query.role = role;
      }
      
      if (search) {
        query.$or = [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }
      
      // Get total count
      const total = await User.countDocuments(query);
      
      // Get users with pagination
      const users = await User.find(query)
        .select('-password -refreshTokens')
        .sort({ role: 1, firstName: 1, lastName: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      // Count billable users for Pro plans (all users are billable)
      const billableUsers = tenant.subscription.plan === 'pro' ? total : 0;
      
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          limits: {
            currentUsers: tenant.limits.currentUsers,
            maxUsers: tenant.subscription.plan === 'free' ? 1 : -1, // Free: 1 user, Pro: unlimited
            billableUsers
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching team members:', error);
      next(error);
    }
  }
  
  /**
   * Get team billing status
   * @route GET /api/v1/tenants/:tenantId/team/billing-status
   */
  async getBillingStatus(req, res, next) {
    try {
      const { tenantId } = req.params;
      
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }
      
      // Count current active users
      const currentUsers = await User.countDocuments({ 
        tenantId, 
        isActive: true 
      });
      
      // Count Pro users specifically
      const currentProUsers = await User.countDocuments({
        tenantId,
        isActive: true,
        accountType: 'pro'
      });
      
      // Update tenant user count for Pro plans
      if (tenant.subscription.plan === 'pro') {
        await Tenant.updateOne(
          { _id: tenantId },
          { 'limits.currentProUsers': currentProUsers }
        );
      }
      
      // Simple Free/Pro billing model
      const isFreePlan = tenant.subscription.plan === 'free';
      const isProPlan = tenant.subscription.plan === 'pro';
      const pricePerUser = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10); // Price per user per month for Pro accounts
      
      // License management for Pro accounts
      const purchasedLicenses = tenant.limits.purchasedLicenses || 1;
      const availableLicenses = tenant.getAvailableLicenses ? tenant.getAvailableLicenses() : 0;
      
      // Get free users from tenant settings
      const freeUsers = isProPlan ? (tenant.billing.customPricing?.enabled 
        ? tenant.billing.customPricing.freeProUsers || 0
        : tenant.billing.freeProUsers || 0) : 0;
      const billableUsers = isProPlan ? Math.max(0, purchasedLicenses - freeUsers) : 0;
      const monthlyPrice = billableUsers * pricePerUser;
      
      res.json({
        success: true,
        data: {
          plan: tenant.subscription.plan,
          currentUsers: isProPlan ? currentProUsers : currentUsers,
          maxUsers: isFreePlan ? 1 : -1, // -1 = unlimited for Pro
          purchasedLicenses: isProPlan ? purchasedLicenses : 0,
          availableLicenses: isProPlan ? availableLicenses : 0,
          freeUsers,
          billableUsers,
          pricePerUser,
          currentMonthlyPrice: monthlyPrice,
          nextUserPrice: isProPlan ? pricePerUser : 0,
          canAddMoreUsers: isFreePlan ? currentUsers < 1 : (isProPlan ? availableLicenses > 0 : true),
          allowTeams: tenant.limits.allowTeams,
          hasStripeCustomer: !!tenant.billing.stripeCustomerId,
          hasActiveSubscription: !!tenant.billing.stripeSubscriptionId,
          hasCustomPricing: tenant.billing.customPricing?.enabled || false,
          customPricingNotes: tenant.billing.customPricing?.notes
        }
      });
      
    } catch (error) {
      logger.error('Error fetching billing status:', error);
      next(error);
    }
  }
  
  /**
   * Invite user to team
   * @route POST /api/v1/tenants/:tenantId/team/invite
   */
  async inviteUser(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { email, role = 'user', message } = req.body;
      const inviterId = req.user.id;
      
      // Validate tenant
      if (req.user.tenantId !== tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this tenant'
        });
      }
      
      // Check permissions
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only owners and admins can invite users'
        });
      }
      
      // Owner role can only be set by current owner
      if (role === 'owner' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only owners can invite other owners'
        });
      }
      
      // Create invitation
      const invitation = await invitationService.createInvitation(inviterId, {
        email,
        role,
        message
      });
      
      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        data: {
          invitation: {
            id: invitation._id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            requiresPayment: invitation.metadata.requiresPayment,
            pricePerUser: invitation.metadata.pricePerUser
          }
        }
      });
      
    } catch (error) {
      logger.error('Error inviting user:', error);
      
      if (error.message.includes('already')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Get pending invitations
   * @route GET /api/v1/tenants/:tenantId/team/invitations
   */
  async getInvitations(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { status = 'pending' } = req.query;
      
      const invitations = await invitationService.getTenantInvitations(tenantId, {
        status
      });
      
      res.json({
        success: true,
        data: invitations
      });
      
    } catch (error) {
      logger.error('Error fetching invitations:', error);
      next(error);
    }
  }
  
  /**
   * Cancel invitation
   * @route DELETE /api/v1/tenants/:tenantId/team/invitations/:invitationId
   */
  async cancelInvitation(req, res, next) {
    try {
      const { invitationId } = req.params;
      const userId = req.user.id;
      
      await invitationService.cancelInvitation(invitationId, userId);
      
      res.json({
        success: true,
        message: 'Invitation cancelled successfully'
      });
      
    } catch (error) {
      logger.error('Error cancelling invitation:', error);
      
      if (error.message.includes('Not authorized')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Resend invitation
   * @route POST /api/v1/tenants/:tenantId/team/invitations/:invitationId/resend
   */
  async resendInvitation(req, res, next) {
    try {
      const { invitationId } = req.params;
      const userId = req.user.id;
      
      await invitationService.resendInvitation(invitationId, userId);
      
      res.json({
        success: true,
        message: 'Invitation resent successfully'
      });
      
    } catch (error) {
      logger.error('Error resending invitation:', error);
      
      if (error.message.includes('Not authorized')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      next(error);
    }
  }
  
  /**
   * Update user role
   * @route PUT /api/v1/tenants/:tenantId/team/members/:userId/role
   */
  async updateUserRole(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user.id;
      
      // Validate role
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin or user'
        });
      }
      
      // Check permissions
      if (req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only owners can change user roles'
        });
      }
      
      // Can't change own role
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }
      
      // Find and update user
      const user = await User.findOne({ _id: userId, tenantId });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Can't demote another owner
      if (user.role === 'owner') {
        return res.status(400).json({
          success: false,
          message: 'Cannot change role of another owner'
        });
      }
      
      user.role = role;
      await user.save();
      
      logger.info('User role updated', {
        userId,
        newRole: role,
        updatedBy: currentUserId
      });
      
      res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
          }
        }
      });
      
    } catch (error) {
      logger.error('Error updating user role:', error);
      next(error);
    }
  }
  
  /**
   * Remove user from team
   * @route DELETE /api/v1/tenants/:tenantId/team/members/:userId
   */
  async removeUser(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const currentUserId = req.user.id;
      
      // Check permissions
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to remove users'
        });
      }
      
      // Can't remove self
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove yourself from the team'
        });
      }
      
      // Find user
      const user = await User.findOne({ _id: userId, tenantId });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Can't remove owner unless you're owner
      if (user.role === 'owner' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only owners can remove other owners'
        });
      }
      
      // Check if this is the last owner
      if (user.role === 'owner') {
        const ownerCount = await User.countDocuments({
          tenantId,
          role: 'owner',
          isActive: true
        });
        
        if (ownerCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot remove the last owner. Transfer ownership first.'
          });
        }
      }
      
      // Deactivate user (keep their data and processes)
      user.isActive = false;
      user.deactivatedAt = new Date();
      user.deactivatedBy = currentUserId;
      user.deactivationReason = 'manual_removal';
      await user.save();
      
      // Update tenant user count
      const tenant = await Tenant.findById(tenantId);
      if (tenant) {
        await tenant.decrementUserCount();
      }
      
      logger.info('User removed from team', {
        userId,
        tenantId,
        removedBy: currentUserId
      });
      
      res.json({
        success: true,
        message: 'User removed from team successfully'
      });
      
    } catch (error) {
      logger.error('Error removing user:', error);
      next(error);
    }
  }
}

module.exports = new TeamController();