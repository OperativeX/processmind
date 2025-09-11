const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Tenant, EmailDomain, PendingRegistration, UserInvitation } = require('../models');
const logger = require('../utils/logger');
const { generateRandomString } = require('../utils/helpers');
const emailVerificationService = require('../services/emailVerificationService');
const domainResolver = require('../services/domainResolverService');
const { cacheUtils, keyGenerators } = require('../config/redis');
const emailService = require('../services/emailService');
const invitationService = require('../services/invitationService');

class AuthController {
  /**
   * Start registration with email verification
   * @route POST /api/v1/auth/register
   * @access Public
   */
  async register(req, res, next) {
    try {
      const { email, password, firstName, lastName, tenantName, subdomain } = req.body;

      // Check if user already exists across all tenants
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Check if subdomain is available
      if (subdomain) {
        const existingTenant = await Tenant.findOne({ domain: subdomain.toLowerCase() });
        if (existingTenant) {
          return res.status(400).json({
            success: false,
            message: 'Subdomain is already taken'
          });
        }
      }

      // Create pending registration
      const { pendingRegistration, verificationCode, isExisting } = 
        await emailVerificationService.createPendingRegistration({
          email,
          password,
          firstName,
          lastName,
          tenantName,
          subdomain,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            source: req.body.source,
            referrer: req.get('Referrer'),
            utmCampaign: req.query.utm_campaign,
            utmSource: req.query.utm_source,
            utmMedium: req.query.utm_medium
          }
        });

      // Send verification email
      await emailVerificationService.sendVerificationEmail(
        email,
        verificationCode,
        { 
          template: 'registration',
          firstName: pendingRegistration.firstName,
          tenantName: pendingRegistration.tenantName
        }
      );

      logger.info('Registration started', {
        email: pendingRegistration.email,
        subdomain: pendingRegistration.subdomain,
        isExisting
      });

      res.status(201).json({
        success: true,
        message: isExisting 
          ? 'Verification code resent to your email' 
          : 'Registration started. Please check your email for verification code.',
        data: {
          email: pendingRegistration.email,
          // In development, include verification code
          ...(process.env.NODE_ENV === 'development' && { verificationCode })
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  /**
   * Verify registration code and complete registration
   * @route POST /api/v1/auth/verify-registration
   * @access Public
   */
  async verifyRegistration(req, res, next) {
    try {
      const { email, code } = req.body;

      const result = await emailVerificationService.completeRegistration(email, code);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          ...(result.attemptsRemaining && { attemptsRemaining: result.attemptsRemaining })
        });
      }

      res.status(201).json({
        success: true,
        message: 'Registration completed successfully',
        data: {
          user: result.user,
          tenant: result.tenant,
          tokens: result.tokens
        }
      });

    } catch (error) {
      logger.error('Verify registration error:', error);
      next(error);
    }
  }

  /**
   * Resend verification code
   * @route POST /api/v1/auth/resend-code
   * @access Public
   */
  async resendVerificationCode(req, res, next) {
    try {
      const { email } = req.body;

      const result = await emailVerificationService.resendCode(email);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      // Send verification email  
      const pendingReg = await PendingRegistration.findByEmail(email);
      await emailVerificationService.sendVerificationEmail(
        email,
        result.verificationCode,
        { 
          template: 'registration',
          firstName: pendingReg?.firstName || 'User',
          tenantName: pendingReg?.tenantName || 'Process Mind'
        }
      );

      res.json({
        success: true,
        message: 'Verification code resent successfully',
        data: {
          email,
          // In development, include verification code
          ...(process.env.NODE_ENV === 'development' && { 
            verificationCode: result.verificationCode 
          })
        }
      });

    } catch (error) {
      logger.error('Resend code error:', error);
      next(error);
    }
  }

  /**
   * Smart login - determine tenant from email
   * @route POST /api/v1/auth/login
   * @access Public
   */
  async login(req, res, next) {
    try {
      const { email, password, tenantId: explicitTenantId } = req.body;
      const emailLower = email.toLowerCase();

      let user = null;
      let resolvedTenantId = explicitTenantId;

      // If no tenant ID provided, use smart login
      if (!resolvedTenantId) {
        // Try to resolve tenant from email domain
        const tenant = await domainResolver.resolveTenantByEmail(emailLower);
        
        if (tenant) {
          resolvedTenantId = tenant.tenantId;
          logger.debug('Tenant resolved from email domain', {
            email: emailLower,
            tenantId: resolvedTenantId
          });
        } else {
          // Universal user search as fallback
          user = await User.findOne({ 
            email: emailLower
          }).select('+password +isActive +deactivationReason').populate('tenantId', 'name subscription.plan subscription.status');
          
          if (user) {
            resolvedTenantId = user.tenantId._id.toString();
            logger.debug('Tenant resolved from universal user search', {
              email: emailLower,
              tenantId: resolvedTenantId
            });
          }
        }
      }

      // If we still don't have a tenant, check if it's a public domain
      if (!resolvedTenantId && !user) {
        const domain = emailLower.split('@')[1];
        const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        
        if (publicDomains.includes(domain)) {
          // For public domains, do a universal search
          user = await User.findOne({ 
            email: emailLower
          }).select('+password +isActive +deactivationReason').populate('tenantId', 'name subscription.plan subscription.status');
        }
      }

      // Find user if not already found
      if (!user && resolvedTenantId) {
        user = await User.findOne({ 
          email: emailLower,
          tenantId: resolvedTenantId
        }).select('+password +isActive +deactivationReason').populate('tenantId', 'name subscription.plan subscription.status');
      }

      if (!user) {
        // Track failed login attempt
        const attemptKey = keyGenerators.loginAttempts(emailLower);
        await cacheUtils.set(attemptKey, '1', 300); // 5 minutes
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is deactivated
      if (!user.isActive) {
        logger.warn('Login attempt for deactivated account', {
          email: emailLower,
          deactivationReason: user.deactivationReason
        });
        
        // Provide specific message based on deactivation reason
        let message = 'Your account has been deactivated.';
        
        if (user.deactivationReason === 'tenant_downgraded_to_free') {
          message = 'Your account has been deactivated because your organization downgraded to the Free plan. Please contact your account owner to regain access.';
        } else if (user.deactivationReason === 'manual_removal') {
          message = 'Your account has been removed from the team. Please contact your account administrator.';
        }
        
        return res.status(403).json({
          success: false,
          message,
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed login attempts. Please try again later.'
        });
      }

      // Check if tenant is active
      if (!user.tenantId || !user.tenantId.subscription || user.tenantId.subscription.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended. Please contact support.'
        });
      }

      // Verify password
      const isPasswordCorrect = await user.comparePassword(password);
      if (!isPasswordCorrect) {
        // Increment failed login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login time
      user.lastLogin = new Date();
      await user.save();

      // Cache user-tenant mapping for future logins
      const emailHash = require('crypto').createHash('sha256').update(emailLower).digest('hex');
      const userTenantKey = keyGenerators.userTenant(emailHash);
      await cacheUtils.set(userTenantKey, JSON.stringify({
        tenantId: user.tenantId._id.toString(),
        tenantName: user.tenantId.name
      }), 1800); // 30 minutes

      // Generate tokens
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      // Store refresh token
      await user.addRefreshToken(
        refreshToken,
        req.get('User-Agent'),
        req.ip
      );

      logger.info('User logged in successfully', {
        userId: user._id,
        email: user.email,
        tenantId: user.tenantId._id,
        smartLogin: !explicitTenantId,
        ip: req.ip
      });

      // Prepare response data
      const userResponse = user.toJSON();
      delete userResponse.password;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          tenant: {
            id: user.tenantId._id,
            name: user.tenantId.name,
            plan: user.tenantId.subscription.plan,
            domain: user.tenantId.domain
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '15m'
          }
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  /**
   * Check tenant for email
   * @route POST /api/v1/auth/check-tenant
   * @access Public
   */
  async checkTenant(req, res, next) {
    try {
      const { email } = req.body;
      const emailLower = email.toLowerCase();

      // Try to resolve tenant
      const tenant = await domainResolver.resolveTenantByEmail(emailLower);
      
      if (tenant) {
        res.json({
          success: true,
          data: {
            hasTenant: true,
            tenant: {
              id: tenant.tenantId,
              name: tenant.tenantName
            }
          }
        });
      } else {
        // Check if user exists in any tenant
        const user = await User.findOne({ 
          email: emailLower,
          isActive: true 
        }).populate('tenantId', 'name domain');
        
        if (user) {
          res.json({
            success: true,
            data: {
              hasTenant: true,
              tenant: {
                id: user.tenantId._id,
                name: user.tenantId.name,
                domain: user.tenantId.domain
              }
            }
          });
        } else {
          res.json({
            success: true,
            data: {
              hasTenant: false
            }
          });
        }
      }

    } catch (error) {
      logger.error('Check tenant error:', error);
      next(error);
    }
  }

  /**
   * Check subdomain availability
   * @route POST /api/v1/auth/check-subdomain
   * @access Public
   */
  async checkSubdomain(req, res, next) {
    try {
      const { subdomain } = req.body;
      const subdomainLower = subdomain.toLowerCase();

      // Check if subdomain is reserved
      const reservedSubdomains = ['app', 'api', 'www', 'admin', 'super-admin', 'dashboard', 'auth', 'login', 'register'];
      if (reservedSubdomains.includes(subdomainLower)) {
        return res.json({
          success: true,
          data: {
            available: false,
            message: 'This subdomain is reserved'
          }
        });
      }

      // Check if subdomain exists in Tenant collection
      const existingTenant = await Tenant.findOne({ domain: subdomainLower });
      
      // Check if subdomain exists in PendingRegistration
      const pendingReg = await PendingRegistration.findOne({ 
        subdomain: subdomainLower,
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Created within last 24 hours
      });

      const isAvailable = !existingTenant && !pendingReg;

      res.json({
        success: true,
        data: {
          available: isAvailable,
          message: isAvailable ? 'Subdomain is available' : 'Subdomain is already taken'
        }
      });

    } catch (error) {
      logger.error('Check subdomain error:', error);
      next(error);
    }
  }

  /**
   * Refresh access token
   * @route POST /api/v1/auth/refresh
   * @access Public
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Find user and check if refresh token exists
      const user = await User.findById(decoded.userId)
        .populate('tenantId', 'name subscription.status');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Check if tenant is still active
      if (!user.tenantId || user.tenantId.subscription.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended'
        });
      }

      // Check if refresh token exists in user's tokens
      const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
      if (!tokenExists) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Update last used time for refresh token
      const tokenIndex = user.refreshTokens.findIndex(rt => rt.token === refreshToken);
      if (tokenIndex !== -1) {
        user.refreshTokens[tokenIndex].lastUsed = new Date();
        await user.save();
      }

      // Generate new access token
      const accessToken = user.generateAccessToken();

      logger.info('Token refreshed', {
        userId: user._id,
        tenantId: user.tenantId._id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        }
      });

    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      logger.error('Token refresh error:', error);
      next(error);
    }
  }

  /**
   * Logout user (invalidate refresh token)
   * @route POST /api/v1/auth/logout
   * @access Public
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        try {
          const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);
          
          if (user) {
            await user.removeRefreshToken(refreshToken);
            logger.info('User logged out', {
              userId: user._id,
              ip: req.ip
            });
          }
        } catch (error) {
          // Token might be invalid/expired, but that's okay for logout
          logger.warn('Logout with invalid/expired token:', error.message);
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  /**
   * Send password reset email
   * @route POST /api/v1/auth/forgot-password
   * @access Public
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        // Don't reveal if email exists or not
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = generateRandomString(32);
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetTokenExpiry;
      await user.save();

      // Send password reset email
      const emailSent = await emailService.sendPasswordResetEmail(
        user.email, 
        resetToken,
        {
          firstName: user.firstName || 'User'
        }
      );

      logger.info('Password reset requested', {
        userId: user._id,
        email: user.email,
        emailSent,
        // Remove resetToken logging in production
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        // Remove this in production - only for development
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

    } catch (error) {
      logger.error('Forgot password error:', error);
      next(error);
    }
  }

  /**
   * Reset password with token
   * @route POST /api/v1/auth/reset-password
   * @access Public
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
        isActive: true
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password and clear reset token
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      // Remove all refresh tokens for security
      user.refreshTokens = [];
      
      await user.save();

      logger.info('Password reset successfully', {
        userId: user._id,
        email: user.email
      });

      res.json({
        success: true,
        message: 'Password reset successful. Please login with your new password.'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  /**
   * Get current user profile
   * @route GET /api/v1/auth/me
   * @access Private
   */
  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .populate('tenantId', 'name subscription limits billing');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
          tenant: user.tenantId ? user.tenantId.toJSON() : null
        }
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  /**
   * Update user profile
   * @route PUT /api/v1/auth/profile
   * @access Private
   */
  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, avatar, preferences } = req.body;
      
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update allowed fields
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (avatar) user.avatar = avatar;
      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
      }

      await user.save();

      logger.info('Profile updated', {
        userId: user._id,
        updatedFields: Object.keys(req.body)
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  /**
   * Change password
   * @route PUT /api/v1/auth/change-password
   * @access Private
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.user.id).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordCorrect) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      
      // Remove all refresh tokens for security
      user.refreshTokens = [];
      
      await user.save();

      logger.info('Password changed', {
        userId: user._id,
        email: user.email
      });

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  /**
   * Get invitation details
   * @route GET /api/v1/auth/invitation/:token
   * @access Public
   */
  async getInvitation(req, res, next) {
    try {
      const { token } = req.params;
      
      const invitation = await UserInvitation.findByToken(token);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired invitation'
        });
      }
      
      res.json({
        success: true,
        data: {
          email: invitation.email,
          role: invitation.role,
          tenant: {
            id: invitation.tenantId._id,
            name: invitation.tenantId.name
          },
          inviter: {
            name: invitation.invitedBy.fullName,
            email: invitation.invitedBy.email
          },
          message: invitation.message,
          expiresAt: invitation.expiresAt
        }
      });
      
    } catch (error) {
      logger.error('Get invitation error:', error);
      next(error);
    }
  }

  /**
   * Accept invitation and create account
   * @route POST /api/v1/auth/accept-invitation
   * @access Public
   */
  async acceptInvitation(req, res, next) {
    try {
      const { token, password, firstName, lastName } = req.body;
      
      // Get invitation
      const invitation = await UserInvitation.findByToken(token);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired invitation'
        });
      }
      
      // Prepare user data
      const userData = {
        email: invitation.email,
        password,
        firstName,
        lastName
      };
      
      // Accept invitation and create user
      const { user, tenant } = await invitationService.acceptInvitation(token, userData);
      
      // Generate tokens
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();
      
      // Store refresh token
      await user.addRefreshToken(
        refreshToken,
        req.get('User-Agent'),
        req.ip
      );
      
      logger.info('User accepted invitation and registered', {
        userId: user._id,
        email: user.email,
        tenantId: tenant._id,
        invitationId: invitation._id
      });
      
      res.status(201).json({
        success: true,
        message: 'Invitation accepted successfully',
        data: {
          user: user.toJSON(),
          tenant: {
            id: tenant._id,
            name: tenant.name,
            plan: tenant.subscription.plan
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '15m'
          }
        }
      });
      
    } catch (error) {
      logger.error('Accept invitation error:', error);
      
      if (error.message.includes('Email does not match')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('needs to upgrade')) {
        return res.status(402).json({
          success: false,
          message: error.message,
          code: 'PAYMENT_REQUIRED'
        });
      }
      
      next(error);
    }
  }

  // @desc    Delete account (owner only)
  // @route   DELETE /api/v1/auth/account
  // @access  Private
  async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      // Get user with password
      const user = await User.findById(req.user.id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Only owners can delete their account
      if (user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only account owners can delete their account. Team members should contact the account owner.'
        });
      }

      // Verify password
      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      // Get tenant
      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      logger.info('Starting account deletion process', {
        userId: user._id,
        tenantId: tenant._id,
        email: user.email
      });

      // Delete all processes from MongoDB
      const Process = require('../models/Process');
      await Process.deleteMany({ tenantId: tenant._id });
      logger.info('Deleted all processes from database', { tenantId: tenant._id });

      // Delete all files from S3
      const s3Service = require('../services/s3Service');
      try {
        await s3Service.deleteTenantFiles(tenant._id.toString());
        logger.info('Deleted all files from S3', { tenantId: tenant._id });
      } catch (s3Error) {
        logger.error('Failed to delete S3 files', { 
          tenantId: tenant._id, 
          error: s3Error.message 
        });
        // Continue with deletion even if S3 fails
      }

      // Delete all team members (other users in the tenant)
      await User.deleteMany({ 
        tenantId: tenant._id,
        _id: { $ne: user._id } // Don't delete current user yet
      });
      logger.info('Deleted all team members', { tenantId: tenant._id });

      // Delete tenant
      await Tenant.findByIdAndDelete(tenant._id);
      logger.info('Deleted tenant', { tenantId: tenant._id });

      // Finally, delete the user
      await User.findByIdAndDelete(user._id);
      logger.info('Deleted user account', { userId: user._id, email: user.email });

      res.status(200).json({
        success: true,
        message: 'Account and all associated data have been permanently deleted'
      });

    } catch (error) {
      logger.error('Delete account error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();