const logger = require('../utils/logger');

/**
 * Middleware to check if user has super admin system role
 */
const superAdminMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user has super_admin system role
    if (req.user.systemRole !== 'super_admin') {
      logger.warn('Unauthorized super admin access attempt', {
        userId: req.user.id,
        email: req.user.email,
        systemRole: req.user.systemRole,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }
    
    // User is super admin, continue
    logger.info('Super admin access granted', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    logger.error('Super admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = superAdminMiddleware;