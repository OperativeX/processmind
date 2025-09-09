const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class VideoTokenService {
  /**
   * Generate a video-specific JWT token with minimal claims
   * @param {string} processId - Process ID
   * @param {string} tenantId - Tenant ID
   * @param {number} expiresInMinutes - Token expiration in minutes (default: 10)
   * @returns {string} Video JWT token
   */
  generateVideoToken(processId, tenantId, expiresInMinutes = 60) {
    try {
      const payload = {
        type: 'video_access',
        processId,
        tenantId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60)
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        algorithm: 'HS256'
      });

      logger.debug('Video token generated', {
        processId,
        tenantId,
        expiresIn: `${expiresInMinutes}m`
      });

      return token;
    } catch (error) {
      logger.error('Error generating video token:', error);
      throw new Error('Failed to generate video access token');
    }
  }

  /**
   * Verify and decode a video JWT token
   * @param {string} token - Video JWT token
   * @returns {Object} Decoded token payload
   */
  verifyVideoToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ensure this is a video access token
      if (decoded.type !== 'video_access') {
        throw new Error('Invalid token type');
      }

      // Ensure required fields are present
      if (!decoded.processId || !decoded.tenantId) {
        throw new Error('Invalid token payload');
      }

      logger.debug('Video token verified', {
        processId: decoded.processId,
        tenantId: decoded.tenantId,
        expiresAt: new Date(decoded.exp * 1000)
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.debug('Video token expired');
        throw new Error('Video access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Invalid video token');
        throw new Error('Invalid video access token');
      } else {
        logger.error('Error verifying video token:', error);
        throw new Error('Failed to verify video access token');
      }
    }
  }

  /**
   * Extract token from request query parameters or headers
   * @param {Object} req - Express request object
   * @returns {string|null} Token string or null if not found
   */
  extractTokenFromRequest(req) {
    // Check query parameter first (for video URLs)
    if (req.query.token) {
      return req.query.token;
    }

    // Fallback to Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Middleware for video token authentication
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  authenticateVideoToken(req, res, next) {
    try {
      const token = this.extractTokenFromRequest(req);
      
      logger.debug('Video token authentication attempt', {
        tokenPresent: !!token,
        tokenLength: token ? token.length : 0,
        queryParams: Object.keys(req.query),
        url: req.url,
        method: req.method
      });
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Video access token required'
        });
      }

      const decoded = this.verifyVideoToken(token);
      
      // Add decoded token data to request
      req.videoAuth = {
        processId: decoded.processId,
        tenantId: decoded.tenantId,
        tokenType: decoded.type
      };

      logger.debug('Video token authenticated successfully', {
        processId: decoded.processId,
        tenantId: decoded.tenantId,
        expiresAt: new Date(decoded.exp * 1000)
      });

      next();
    } catch (error) {
      logger.warn('Video token authentication failed:', {
        error: error.message,
        url: req.url,
        ip: req.ip,
        queryParams: Object.keys(req.query)
      });

      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new VideoTokenService();