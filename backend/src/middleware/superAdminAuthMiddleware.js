const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

/**
 * Super Admin Authentication Middleware
 * Completely separate from regular user authentication
 */
class SuperAdminAuthMiddleware {
  /**
   * Verify super admin JWT token
   */
  static async authenticate(req, res, next) {
    try {
      // Extract token from header
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Super admin access token required'
        });
      }

      const token = authHeader.substring(7);
      const secret = process.env.SUPER_ADMIN_SECRET;
      
      if (!secret) {
        logger.error('SUPER_ADMIN_SECRET not configured');
        return res.status(500).json({
          success: false,
          message: 'Super admin authentication not configured'
        });
      }

      // Verify JWT token with super admin secret
      const decoded = jwt.verify(token, secret);
      
      // Verify it's a super admin token
      if (!decoded.superAdmin || decoded.email !== process.env.SUPER_ADMIN_EMAIL) {
        logger.warn('Invalid super admin token attempt', {
          email: decoded.email,
          ip: req.ip
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid super admin credentials'
        });
      }

      // Add super admin info to request
      req.superAdmin = {
        email: decoded.email,
        sessionId: decoded.sessionId
      };

      logger.info('Super admin access granted', {
        email: decoded.email,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      next();

    } catch (error) {
      logger.error('Super admin auth middleware error:', error);

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid super admin token'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Super admin token expired'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Super admin authentication error'
      });
    }
  }

  /**
   * Verify super admin credentials
   */
  static async verifyCredentials(email, password) {
    // Check email
    if (email !== process.env.SUPER_ADMIN_EMAIL) {
      return false;
    }

    // Check password
    const storedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;
    if (!storedHash) {
      logger.error('SUPER_ADMIN_PASSWORD_HASH not configured');
      return false;
    }

    return await bcrypt.compare(password, storedHash);
  }

  /**
   * Generate super admin JWT token
   */
  static generateToken() {
    const secret = process.env.SUPER_ADMIN_SECRET;
    if (!secret) {
      throw new Error('SUPER_ADMIN_SECRET not configured');
    }

    const sessionId = require('crypto').randomBytes(16).toString('hex');
    
    return jwt.sign(
      {
        email: process.env.SUPER_ADMIN_EMAIL,
        superAdmin: true,
        sessionId
      },
      secret,
      { 
        expiresIn: process.env.SUPER_ADMIN_TOKEN_EXPIRES || '4h'
      }
    );
  }

  /**
   * Optional: Check IP whitelist
   */
  static checkIPWhitelist(req, res, next) {
    const allowedIPs = process.env.SUPER_ADMIN_ALLOWED_IPS;
    
    // If no whitelist configured, allow all
    if (!allowedIPs) {
      return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const whitelist = allowedIPs.split(',').map(ip => ip.trim());
    
    if (!whitelist.includes(clientIP)) {
      logger.warn('Super admin access denied - IP not whitelisted', {
        clientIP,
        allowedIPs: whitelist
      });
      
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP address'
      });
    }

    next();
  }
}

module.exports = SuperAdminAuthMiddleware;