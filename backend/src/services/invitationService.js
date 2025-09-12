const { User, Tenant, UserInvitation, SystemSettings } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class InvitationService {
  /**
   * Create and send user invitation
   */
  async createInvitation(inviterUserId, invitationData) {
    const { email, role = 'user', message } = invitationData;
    
    try {
      // Get inviter details
      const inviter = await User.findById(inviterUserId).populate('tenantId');
      if (!inviter) {
        throw new Error('Inviter not found');
      }
      
      const tenant = inviter.tenantId;
      
      // Check if inviter has permission
      if (!['owner', 'admin'].includes(inviter.role)) {
        throw new Error('Only owners and admins can invite users');
      }
      
      // Check if user already exists in this tenant
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        tenantId: tenant._id 
      });
      
      if (existingUser) {
        throw new Error('User already exists in this organization');
      }
      
      // Check if there's already a pending invitation
      const existingInvitation = await UserInvitation.findOne({
        email: email.toLowerCase(),
        tenantId: tenant._id,
        status: 'pending'
      });
      
      if (existingInvitation) {
        throw new Error('An invitation has already been sent to this email');
      }
      
      // Check if tenant has available license for Pro accounts
      if (tenant.subscription.plan === 'pro' && !tenant.hasAvailableLicense()) {
        throw new Error('No available licenses. Please purchase additional licenses before inviting new team members.');
      }
      
      // Calculate if payment is required (kept for backward compatibility)
      const { requiresPayment, pricePerUser } = await this.checkPaymentRequired(tenant);
      
      // Create invitation
      const invitation = await UserInvitation.create({
        email: email.toLowerCase(),
        tenantId: tenant._id,
        invitedBy: inviter._id,
        role,
        message,
        metadata: {
          requiresPayment,
          pricePerUser,
          inviterName: inviter.fullName,
          tenantName: tenant.name
        }
      });
      
      // Send invitation email
      await this.sendInvitationEmail(invitation, inviter, tenant);
      
      logger.info('User invitation created', {
        invitationId: invitation._id,
        email: invitation.email,
        tenantId: tenant._id,
        invitedBy: inviter._id,
        requiresPayment
      });
      
      return invitation;
      
    } catch (error) {
      logger.error('Failed to create invitation:', error);
      throw error;
    }
  }
  
  /**
   * Check if adding a user requires payment
   */
  async checkPaymentRequired(tenant) {
    const settings = await SystemSettings.getPricingSettings();
    
    const freeUsers = tenant.billing.customPricing?.enabled 
      ? tenant.billing.customPricing.freeUsers 
      : settings.value.defaultFreeUsers;
      
    const pricePerUser = tenant.billing.customPricing?.enabled
      ? tenant.billing.customPricing.pricePerUser
      : settings.value.defaultPricePerUser;
    
    // +1 because we're checking for the new user
    const requiresPayment = (tenant.limits.currentUsers + 1) > freeUsers;
    
    return { requiresPayment, pricePerUser };
  }
  
  /**
   * Send invitation email
   */
  async sendInvitationEmail(invitation, inviter, tenant) {
    const inviteUrl = `${process.env.FRONTEND_URL}/join/${invitation.token}`;
    
    const emailData = {
      to: invitation.email,
      subject: `${inviter.fullName} hat Sie eingeladen, ${tenant.name} auf ProcessLink beizutreten`,
      data: {
        inviterName: inviter.fullName,
        tenantName: tenant.name,
        role: invitation.role,
        message: invitation.message,
        inviteUrl,
        expiresIn: '7 Tage'
      }
    };
    
    // Use custom template if it exists
    await emailService.sendEmail(
      emailData.to,
      emailData.subject,
      this.getInvitationEmailHtml(emailData.data),
      this.getInvitationEmailText(emailData.data)
    );
  }
  
  /**
   * Get invitation email HTML template
   */
  getInvitationEmailHtml(data) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Einladung zu ProcessLink</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0d1117;
      margin: 0;
      padding: 0;
      color: #c9d1d9;
    }
    .wrapper {
      background-color: #0d1117;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #161b22;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: bold;
    }
    .content {
      padding: 40px 30px;
      background-color: #161b22;
      color: #c9d1d9;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      font-weight: 600;
      color: white;
    }
    .subtitle {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .message-box {
      background-color: #0d1117;
      border-left: 4px solid #7c3aed;
      padding: 20px;
      margin: 20px 0;
      border-radius: 6px;
      font-style: italic;
    }
    .info-grid {
      margin: 30px 0;
      display: table;
      width: 100%;
    }
    .info-row {
      display: table-row;
    }
    .info-label {
      display: table-cell;
      padding: 10px 0;
      color: #8b949e;
      width: 120px;
    }
    .info-value {
      display: table-cell;
      padding: 10px 0;
      font-weight: 500;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 30px 0;
      text-align: center;
    }
    .footer {
      padding: 30px;
      text-align: center;
      color: #8b949e;
      font-size: 14px;
      background-color: #0d1117;
      border-top: 1px solid #30363d;
    }
    .footer a {
      color: #7c3aed;
      text-decoration: none;
    }
    .warning {
      background-color: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: #fbbf24;
      padding: 15px;
      border-radius: 6px;
      font-size: 14px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">P</div>
        <h1>Sie wurden eingeladen!</h1>
        <p class="subtitle">Treten Sie ${data.tenantName} auf ProcessLink bei</p>
      </div>
      
      <div class="content">
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${data.inviterName}</strong> hat Sie eingeladen, seinem Team auf ProcessLink beizutreten, 
          der KI-gestützten Videoverarbeitungsplattform.
        </p>
        
        ${data.message ? `
        <div class="message-box">
          "${data.message}"
          <div style="text-align: right; margin-top: 10px; opacity: 0.7;">
            - ${data.inviterName}
          </div>
        </div>
        ` : ''}
        
        <div class="info-grid">
          <div class="info-row">
            <div class="info-label">Organisation:</div>
            <div class="info-value">${data.tenantName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ihre Rolle:</div>
            <div class="info-value">${data.role === 'admin' ? 'Administrator' : 'Team-Mitglied'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Eingeladen von:</div>
            <div class="info-value">${data.inviterName}</div>
          </div>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.inviteUrl}" class="button">Einladung annehmen</a>
        </div>
        
        <div class="warning">
          Diese Einladung läuft in ${data.expiresIn} ab. Danach müssen Sie eine neue Einladung anfordern.
        </div>
        
        <p style="color: #8b949e; font-size: 14px; margin-top: 30px;">
          Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail bedenkenlos ignorieren.
        </p>
      </div>
      
      <div class="footer">
        <p>
          <a href="${process.env.FRONTEND_URL}">ProcessLink</a> • KI-gestützte Videoverarbeitung
        </p>
        <p style="margin-top: 20px; font-size: 12px;">
          © 2024 ProcessLink. Alle Rechte vorbehalten.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
  
  /**
   * Get invitation email text template
   */
  getInvitationEmailText(data) {
    return `
Sie wurden zu ProcessLink eingeladen!

${data.inviterName} hat Sie eingeladen, ${data.tenantName} auf ProcessLink beizutreten.

${data.message ? `Persönliche Nachricht:\n"${data.message}"\n- ${data.inviterName}\n\n` : ''}

Details:
- Organisation: ${data.tenantName}
- Ihre Rolle: ${data.role === 'admin' ? 'Administrator' : 'Team-Mitglied'}
- Eingeladen von: ${data.inviterName}

Nehmen Sie Ihre Einladung an:
${data.inviteUrl}

Diese Einladung läuft in ${data.expiresIn} ab.

Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail bedenkenlos ignorieren.

---
ProcessLink - KI-gestützte Videoverarbeitung
${process.env.FRONTEND_URL}
    `;
  }
  
  /**
   * Accept invitation
   */
  async acceptInvitation(token, userData) {
    const invitation = await UserInvitation.findByToken(token);
    
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }
    
    // Check if email matches
    if (invitation.email.toLowerCase() !== userData.email.toLowerCase()) {
      throw new Error('Email does not match invitation');
    }
    
    const tenant = invitation.tenantId;
    
    // Check if payment is still required
    const { requiresPayment } = await this.checkPaymentRequired(tenant);
    if (requiresPayment && !tenant.billing.stripeSubscriptionId) {
      throw new Error('Organization needs to upgrade their plan before adding more users');
    }
    
    let user = null;
    
    try {
      // Start transaction-like behavior
      // Create user account
      user = await User.create({
        ...userData,
        email: invitation.email,
        tenantId: tenant._id,
        role: invitation.role,
        isActive: true,
        emailVerified: true, // Pre-verified since they got the invitation
        accountType: tenant.subscription.plan === 'pro' ? 'pro' : 'free'
      });
      
      // Update tenant user count
      await tenant.incrementUserCount();
      
      // Mark invitation as accepted
      await invitation.accept(user._id);
      
      // Create notification for inviter
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: invitation.invitedBy,
        tenantId: tenant._id,
        type: 'team_member_joined',
        title: 'New team member joined',
        message: `${user.fullName} has accepted your invitation and joined the team`,
        metadata: {
          newUserId: user._id,
          newUserEmail: user.email
        }
      });
      
      logger.info('Invitation accepted', {
        invitationId: invitation._id,
        userId: user._id,
        tenantId: tenant._id
      });
      
      return { user, tenant };
      
    } catch (error) {
      // Rollback: Delete user if created
      if (user) {
        try {
          await User.findByIdAndDelete(user._id);
          logger.info('Rolled back user creation due to error', { 
            userId: user._id,
            error: error.message 
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback user creation', rollbackError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId, userId) {
    const invitation = await UserInvitation.findById(invitationId)
      .populate('tenantId');
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }
    
    // Check permission
    const user = await User.findById(userId);
    if (invitation.invitedBy.toString() !== userId && 
        !['owner', 'admin'].includes(user.role)) {
      throw new Error('Not authorized to cancel this invitation');
    }
    
    await invitation.cancel();
    
    logger.info('Invitation cancelled', {
      invitationId: invitation._id,
      cancelledBy: userId
    });
    
    return invitation;
  }
  
  /**
   * Get pending invitations for tenant
   */
  async getTenantInvitations(tenantId, options = {}) {
    const query = {
      tenantId,
      status: options.status || 'pending'
    };
    
    if (options.status === 'all') {
      delete query.status;
    }
    
    return await UserInvitation.find(query)
      .populate('invitedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }
  
  /**
   * Resend invitation email
   */
  async resendInvitation(invitationId, userId) {
    const invitation = await UserInvitation.findById(invitationId)
      .populate('tenantId invitedBy');
    
    if (!invitation || invitation.status !== 'pending') {
      throw new Error('Invalid invitation');
    }
    
    // Check permission
    const user = await User.findById(userId);
    if (invitation.invitedBy._id.toString() !== userId && 
        !['owner', 'admin'].includes(user.role)) {
      throw new Error('Not authorized to resend this invitation');
    }
    
    // Send email again
    await this.sendInvitationEmail(
      invitation, 
      invitation.invitedBy, 
      invitation.tenantId
    );
    
    logger.info('Invitation resent', {
      invitationId: invitation._id,
      resentBy: userId
    });
    
    return invitation;
  }
}

module.exports = new InvitationService();