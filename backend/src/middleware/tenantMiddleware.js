const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User, Tenant } = require('../models');
const domainResolver = require('../services/domainResolverService');
const { cacheUtils, keyGenerators } = require('../config/redis');

const tenantMiddleware = async (req, res, next) => {
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
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.debug('Token decoded successfully:', {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        email: decoded.email
      });
    } catch (verifyError) {
      logger.error('JWT verification failed:', {
        error: verifyError.message,
        tokenPrefix: token.substring(0, 20) + '...',
        secretExists: !!process.env.JWT_SECRET,
        secretLength: process.env.JWT_SECRET?.length
      });
      throw verifyError;
    }
    
    // Extract tenant ID from various sources
    let requestedTenantId = null;
    let tenantSource = null;
    
    // Priority 1: URL parameter
    if (req.params.tenantId) {
      requestedTenantId = req.params.tenantId;
      tenantSource = 'url_param';
    }
    // Priority 2: Header
    else if (req.headers['x-tenant']) {
      requestedTenantId = req.headers['x-tenant'];
      tenantSource = 'header';
    }
    // Priority 3: Query parameter
    else if (req.query.tenant) {
      requestedTenantId = req.query.tenant;
      tenantSource = 'query';
    }
    // Priority 4: Subdomain
    else {
      const host = req.get('host');
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        // Resolve tenant from subdomain using domain resolver
        const tenant = await domainResolver.resolveTenant(subdomain);
        if (tenant) {
          requestedTenantId = tenant.tenantId;
          tenantSource = 'subdomain';
        }
      }
    }
    
    if (!requestedTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    // Verify user belongs to the requested tenant
    // Ensure both are strings for comparison
    const tokenTenantId = String(decoded.tenantId);
    requestedTenantId = String(requestedTenantId);
    
    if (tokenTenantId !== requestedTenantId) {
      logger.warn('Tenant access denied:', {
        userId: decoded.userId,
        requestedTenant: requestedTenantId,
        userTenant: tokenTenantId,
        tenantSource,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Access denied to this tenant'
      });
    }

    // Check user cache first
    const userCacheKey = `user:${decoded.userId}:active`;
    let userActive = await cacheUtils.get(userCacheKey);
    
    if (userActive === null) {
      // Verify user still exists and is active
      const user = await User.findById(decoded.userId).select('isActive email role');
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account not found or inactive'
        });
      }
      
      // Cache user active status for 5 minutes
      await cacheUtils.set(userCacheKey, 'true', 300);
      
      // Add user info to request
      req.user = {
        id: decoded.userId,
        email: user.email,
        role: user.role,
        tenantId: decoded.tenantId
      };
    } else {
      // User is active from cache
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId
      };
    }

    // Check tenant status in cache
    const tenantCacheKey = `tenant:${requestedTenantId}:status`;
    let tenantStatus = await cacheUtils.get(tenantCacheKey);
    
    if (tenantStatus === null) {
      // Check tenant status in database
      const tenant = await Tenant.findById(requestedTenantId).select('isActive subscription.status');
      if (!tenant || !tenant.isActive || tenant.subscription.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Tenant account is not active'
        });
      }
      
      // Cache tenant status for 10 minutes
      await cacheUtils.set(tenantCacheKey, 'active', 600);
    } else if (tenantStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is not active'
      });
    }

    req.tenantId = requestedTenantId;
    req.tenantSource = tenantSource;

    // Track tenant access
    trackTenantAccess(requestedTenantId, decoded.userId);

    next();

  } catch (error) {
    logger.error('Tenant middleware error:', error);

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

/**
 * Extract subdomain from host
 * @param {string} host - Host header value
 * @returns {string|null} - Subdomain or null
 */
function extractSubdomain(host) {
  if (!host) return null;
  
  // Remove port if present
  const hostname = host.split(':')[0];
  
  // Split by dots
  const parts = hostname.split('.');
  
  // Check if it's a subdomain (at least 3 parts)
  if (parts.length >= 3) {
    // Exclude www
    if (parts[0] === 'www') {
      return parts.length > 3 ? parts[1] : null;
    }
    return parts[0];
  }
  
  return null;
}

/**
 * Track tenant access for analytics
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 */
async function trackTenantAccess(tenantId, userId) {
  try {
    const key = `tenant:${tenantId}:access:${new Date().toISOString().split('T')[0]}`;
    const member = `${userId}:${Date.now()}`;
    
    // Use Redis sorted set to track unique accesses
    const redis = require('../config/redis').getRedisClient();
    if (redis) {
      await redis.zAdd(key, { score: Date.now(), value: member });
      await redis.expire(key, 7 * 24 * 60 * 60); // Keep for 7 days
    }
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.error('Tenant access tracking error:', error);
  }
}

module.exports = tenantMiddleware;