const crypto = require('crypto');
const { PendingRegistration } = require('../models');
const { cacheUtils, keyGenerators } = require('../config/redis');
const logger = require('../utils/logger');
const emailService = require('./emailService');

class EmailVerificationService {
  /**
   * Generate a 6-digit verification code
   * @returns {string} - 6-digit code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create a pending registration with verification code
   * @param {Object} registrationData - Registration data
   * @returns {Promise<{pendingRegistration: Object, verificationCode: string}>}
   */
  async createPendingRegistration(registrationData) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        tenantName,
        subdomain,
        ipAddress,
        userAgent,
        metadata
      } = registrationData;

      // Check if pending registration already exists
      const existing = await PendingRegistration.findByEmail(email);
      if (existing) {
        // If not expired and not max attempts, reuse it
        if (!existing.isMaxAttemptsReached()) {
          return {
            pendingRegistration: existing,
            verificationCode: existing.verificationCode,
            isExisting: true
          };
        }
        
        // Delete the old one
        await existing.deleteOne();
      }

      // Generate verification code
      const verificationCode = this.generateVerificationCode();

      // Hash password before storing
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create pending registration
      const pendingRegistration = new PendingRegistration({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        tenantName,
        subdomain,
        verificationCode,
        ipAddress,
        userAgent,
        metadata
      });

      await pendingRegistration.save();

      // Store verification code in Redis with TTL
      const cacheKey = keyGenerators.verificationCode(email.toLowerCase());
      await cacheUtils.set(cacheKey, verificationCode, 600); // 10 minutes

      logger.info('Pending registration created:', {
        email: pendingRegistration.email,
        subdomain: pendingRegistration.subdomain
      });

      return {
        pendingRegistration,
        verificationCode,
        isExisting: false
      };

    } catch (error) {
      logger.error('Create pending registration error:', error);
      throw error;
    }
  }

  /**
   * Verify registration code
   * @param {string} email - User email
   * @param {string} code - Verification code
   * @returns {Promise<{success: boolean, pendingRegistration?: Object, error?: string}>}
   */
  async verifyCode(email, code) {
    try {
      const emailLower = email.toLowerCase();
      
      // Check Redis first for quick validation
      const cacheKey = keyGenerators.verificationCode(emailLower);
      const cachedCode = await cacheUtils.get(cacheKey);
      
      if (cachedCode !== code) {
        // If not in cache or doesn't match, check database
        const pendingReg = await PendingRegistration.findByVerificationCode(emailLower, code);
        
        if (!pendingReg) {
          return {
            success: false,
            error: 'Invalid or expired verification code'
          };
        }
        
        // Check max attempts
        if (pendingReg.isMaxAttemptsReached()) {
          return {
            success: false,
            error: 'Maximum verification attempts exceeded'
          };
        }
        
        // Increment attempts if code doesn't match
        if (pendingReg.verificationCode !== code) {
          await pendingReg.incrementVerificationAttempts();
          return {
            success: false,
            error: 'Invalid verification code',
            attemptsRemaining: 5 - pendingReg.verificationAttempts
          };
        }
      }
      
      // Code is valid, get full registration data
      const pendingRegistration = await PendingRegistration.findByEmail(emailLower);
      
      if (!pendingRegistration) {
        return {
          success: false,
          error: 'Registration not found'
        };
      }
      
      // Clear verification code from cache
      await cacheUtils.delete(cacheKey);
      
      return {
        success: true,
        pendingRegistration
      };
      
    } catch (error) {
      logger.error('Verify code error:', error);
      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }

  /**
   * Complete registration after verification
   * @param {string} email - User email
   * @param {string} code - Verification code
   * @returns {Promise<{success: boolean, user?: Object, tenant?: Object, error?: string}>}
   */
  async completeRegistration(email, code) {
    try {
      // Verify code first
      const verification = await this.verifyCode(email, code);
      
      if (!verification.success) {
        return verification;
      }
      
      const pendingReg = verification.pendingRegistration;
      
      // Import required models
      const { User, Tenant, EmailDomain } = require('../models');
      const domainResolver = require('./domainResolverService');
      
      // Start transaction-like process
      let tenant = null;
      let user = null;
      
      try {
        // Create tenant
        tenant = new Tenant({
          name: pendingReg.tenantName,
          domain: pendingReg.subdomain,
          subscription: {
            plan: 'free',
            status: 'active'
          }
        });
        
        await tenant.save();
        logger.info('Tenant created:', { 
          tenantId: tenant._id, 
          name: tenant.name,
          domain: tenant.domain 
        });
        
        // Create user with owner role and Free account defaults
        user = new User({
          email: pendingReg.email,
          password: pendingReg.password, // Already hashed
          firstName: pendingReg.firstName,
          lastName: pendingReg.lastName,
          tenantId: tenant._id,
          role: 'owner',
          accountType: 'free',
          emailVerified: true,
          lastLogin: new Date(),
          usage: {
            processesThisMonth: 0,
            storageUsedMB: 0,
            lastResetDate: new Date()
          }
        });
        
        // Skip password hashing since it's already hashed
        user.$skipPasswordHash = true;
        await user.save();
        delete user.$skipPasswordHash;
        
        logger.info('User created:', {
          userId: user._id,
          email: user.email,
          tenantId: tenant._id
        });
        
        // Add subdomain mapping if provided
        if (pendingReg.subdomain) {
          await domainResolver.addDomainMapping(
            pendingReg.subdomain,
            tenant._id.toString(),
            tenant.name
          );
        }
        
        // NOTE: Removed automatic email domain mapping
        // With subdomain-based tenancy, we no longer automatically map email domains
        // This prevents conflicts when multiple tenants use the same email domain
        
        // Optional: Log the email domain for analytics
        const emailDomain = pendingReg.email.split('@')[1];
        logger.info('User registered with email domain:', { 
          domain: emailDomain, 
          subdomain: tenant.domain,
          tenantId: tenant._id,
          tenantName: tenant.name
        });
        
        // Delete pending registration
        await pendingReg.deleteOne();
        
        // Generate tokens
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        // Store refresh token
        await user.addRefreshToken(
          refreshToken,
          pendingReg.userAgent,
          pendingReg.ipAddress
        );
        
        return {
          success: true,
          user: user.toJSON(),
          tenant: {
            id: tenant._id,
            name: tenant.name,
            domain: tenant.domain,
            plan: tenant.subscription.plan
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '15m'
          }
        };
        
      } catch (error) {
        // Rollback on error
        if (tenant) {
          await Tenant.findByIdAndDelete(tenant._id);
        }
        if (user) {
          await User.findByIdAndDelete(user._id);
        }
        
        throw error;
      }
      
    } catch (error) {
      logger.error('Complete registration error:', error);
      return {
        success: false,
        error: 'Registration completion failed'
      };
    }
  }

  /**
   * Resend verification code
   * @param {string} email - User email
   * @returns {Promise<{success: boolean, verificationCode?: string, error?: string}>}
   */
  async resendCode(email) {
    try {
      const emailLower = email.toLowerCase();
      
      // Find pending registration
      const pendingReg = await PendingRegistration.findByEmail(emailLower);
      
      if (!pendingReg) {
        return {
          success: false,
          error: 'No pending registration found'
        };
      }
      
      // Check if max attempts reached
      if (pendingReg.isMaxAttemptsReached()) {
        return {
          success: false,
          error: 'Maximum verification attempts exceeded'
        };
      }
      
      // Generate new code
      const newCode = this.generateVerificationCode();
      pendingReg.verificationCode = newCode;
      pendingReg.verificationAttempts = 0; // Reset attempts
      await pendingReg.save();
      
      // Update Redis
      const cacheKey = keyGenerators.verificationCode(emailLower);
      await cacheUtils.set(cacheKey, newCode, 600); // 10 minutes
      
      logger.info('Verification code resent:', { email: emailLower });
      
      return {
        success: true,
        verificationCode: newCode
      };
      
    } catch (error) {
      logger.error('Resend code error:', error);
      return {
        success: false,
        error: 'Failed to resend code'
      };
    }
  }

  /**
   * Clean up expired registrations
   * @returns {Promise<number>} - Number of deleted registrations
   */
  async cleanupExpiredRegistrations() {
    try {
      const count = await PendingRegistration.cleanup();
      logger.info(`Cleaned up ${count} expired registrations`);
      return count;
    } catch (error) {
      logger.error('Cleanup expired registrations error:', error);
      return 0;
    }
  }

  /**
   * Send verification email
   * @param {string} email - Recipient email
   * @param {string} code - Verification code
   * @param {Object} options - Email options
   */
  async sendVerificationEmail(email, code, options = {}) {
    try {
      // Extract first name and tenant name from options or use defaults
      const { firstName, tenantName } = options;
      
      // Send actual email
      const sent = await emailService.sendVerificationEmail(email, code, {
        firstName,
        tenantName
      });
      
      if (sent) {
        logger.info('Verification email sent successfully:', {
          to: email,
          template: 'verification'
        });
      } else {
        logger.warn('Failed to send verification email:', {
          to: email
        });
      }
      
      // In development, also log the code
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📧 Verification Code for ${email}: ${code}\n`);
      }
      
      return sent;
      
    } catch (error) {
      logger.error('Send verification email error:', error);
      
      // In development, at least show the code
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📧 Verification Code for ${email}: ${code}\n`);
      }
      
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailVerificationService();