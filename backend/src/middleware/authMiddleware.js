const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('-password').populate('tenantId', 'name subscription.plan subscription.status');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or inactive'
      });
    }

    // Check if tenant is still active
    if (!user.tenantId || user.tenantId.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended'
      });
    }

    // Add user info to request object
    req.user = {
      id: decoded.userId,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      tenantId: decoded.tenantId
    };

    next();

  } catch (error) {
    logger.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = authMiddleware;