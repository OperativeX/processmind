const SuperAdminAuthMiddleware = require('../middleware/superAdminAuthMiddleware');
const logger = require('../utils/logger');

/**
 * Super Admin Authentication Controller
 * Handles login/logout for super admin access
 */
class SuperAdminAuthController {
  /**
   * Login endpoint for super admin
   * POST /api/v1/super-admin/auth/login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Log login attempt
      logger.info('Super admin login attempt', {
        email,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // Verify credentials
      const isValid = await SuperAdminAuthMiddleware.verifyCredentials(email, password);

      if (!isValid) {
        logger.warn('Failed super admin login attempt', {
          email,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = SuperAdminAuthMiddleware.generateToken();

      // Log successful login
      logger.info('Super admin login successful', {
        email,
        ip: req.ip
      });

      // Return token
      return res.json({
        success: true,
        token,
        expiresIn: process.env.SUPER_ADMIN_TOKEN_EXPIRES || '4h'
      });

    } catch (error) {
      logger.error('Super admin login error:', error);

      return res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  /**
   * Verify token endpoint
   * GET /api/v1/super-admin/auth/verify
   */
  static async verify(req, res) {
    try {
      // If we reach here, the middleware has already verified the token
      return res.json({
        success: true,
        superAdmin: req.superAdmin
      });
    } catch (error) {
      logger.error('Super admin verify error:', error);
      return res.status(500).json({
        success: false,
        message: 'Verification failed'
      });
    }
  }

  /**
   * Get current session info
   * GET /api/v1/super-admin/auth/session
   */
  static async getSession(req, res) {
    try {
      // Return session info (already validated by middleware)
      return res.json({
        success: true,
        session: {
          email: req.superAdmin.email,
          sessionId: req.superAdmin.sessionId,
          loginTime: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Super admin session error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get session info'
      });
    }
  }

  /**
   * Generate password hash utility (for initial setup)
   * This is a helper method to generate the hash for .env file
   */
  static async generatePasswordHash(password) {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    console.log('Password hash for .env file:');
    console.log(`SUPER_ADMIN_PASSWORD_HASH=${hash}`);
    return hash;
  }
}

module.exports = SuperAdminAuthController;