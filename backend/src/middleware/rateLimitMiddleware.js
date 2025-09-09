const { cacheUtils, keyGenerators } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Create rate limit middleware with Redis-based sliding window
 * @param {Object} options - Rate limit options
 * @returns {Function} - Express middleware
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute default
    max = 10, // max requests per window
    message = 'Too many requests, please try again later',
    keyGenerator = null, // custom key generator function
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true, // Return rate limit info in headers
    legacyHeaders = false, // Return rate limit info in legacy headers
    tenantSpecific = true, // Rate limit per tenant
    globalFallback = 100 // Global rate limit if no tenant
  } = options;

  return async (req, res, next) => {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) {
        // If Redis is not available, allow the request
        logger.warn('Rate limiter: Redis not available, allowing request');
        return next();
      }

      // Generate rate limit key
      let key;
      if (keyGenerator) {
        key = keyGenerator(req);
      } else if (tenantSpecific && req.tenantId) {
        key = keyGenerators.rateLimit(req.tenantId, req.ip);
      } else {
        key = keyGenerators.rateLimit('global', req.ip);
      }

      // Get current window start time
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use Redis sorted set for sliding window
      const requestKey = `${key}:${now}`;
      
      // Add current request to sorted set
      await redis.zAdd(key, { score: now, value: requestKey });
      
      // Remove old entries outside the window
      await redis.zRemRangeByScore(key, '-inf', windowStart);
      
      // Count requests in current window
      const requestCount = await redis.zCard(key);
      
      // Set expiry on the key
      await redis.expire(key, Math.ceil(windowMs / 1000));

      // Calculate rate limit headers
      const limit = tenantSpecific && req.tenantId ? max : globalFallback;
      const remaining = Math.max(0, limit - requestCount);
      const resetTime = new Date(now + windowMs);

      // Set headers if enabled
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', limit);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetTime.toISOString());
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
      }

      // Check if limit exceeded
      if (requestCount > limit) {
        // Log rate limit hit
        logger.warn('Rate limit exceeded', {
          key,
          ip: req.ip,
          tenantId: req.tenantId,
          requestCount,
          limit
        });

        // Track rate limit hits in metrics
        trackRateLimitHit(req);

        // Remove the request we just added since it's rejected
        await redis.zRem(key, requestKey);

        // Send rate limit response
        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil(windowMs / 1000),
          resetTime: resetTime.toISOString()
        });
      }

      // Track successful request if needed
      if (!skipSuccessfulRequests) {
        res.on('finish', async () => {
          if (res.statusCode < 400 && skipSuccessfulRequests) {
            // Remove successful request from count
            await redis.zRem(key, requestKey);
          }
        });
      }

      // Track failed request if needed
      if (!skipFailedRequests) {
        res.on('finish', async () => {
          if (res.statusCode >= 400 && skipFailedRequests) {
            // Remove failed request from count
            await redis.zRem(key, requestKey);
          }
        });
      }

      next();

    } catch (error) {
      logger.error('Rate limiter error:', error);
      // On error, allow the request
      next();
    }
  };
};

/**
 * Create endpoint-specific rate limiters
 */
const rateLimiters = {
  // Strict rate limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true, // Don't count successful logins
    tenantSpecific: false // Global rate limit for auth
  }),

  // Registration rate limit
  registration: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts, please try again later',
    tenantSpecific: false
  }),

  // General API rate limit
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'API rate limit exceeded',
    tenantSpecific: true
  }),

  // Upload rate limit
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload rate limit exceeded',
    tenantSpecific: true,
    globalFallback: 20
  }),

  // Public endpoint rate limit
  public: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Public API rate limit exceeded',
    tenantSpecific: false
  })
};

/**
 * Track rate limit hits for monitoring
 */
async function trackRateLimitHit(req) {
  try {
    const redis = require('../config/redis').getRedisClient();
    if (!redis) return;

    const date = new Date().toISOString().split('T')[0];
    const endpoint = req.route?.path || req.path;
    const key = `metrics:ratelimit:${date}`;
    
    await redis.hIncrBy(key, endpoint, 1);
    await redis.hIncrBy(key, 'total', 1);
    await redis.expire(key, 30 * 24 * 60 * 60); // Keep for 30 days

  } catch (error) {
    logger.error('Track rate limit hit error:', error);
  }
}

/**
 * Get rate limit statistics
 */
async function getRateLimitStats(days = 7) {
  try {
    const redis = require('../config/redis').getRedisClient();
    if (!redis) return {};

    const stats = {};
    const endDate = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const key = `metrics:ratelimit:${dateStr}`;
      const dayStats = await redis.hGetAll(key);
      
      if (Object.keys(dayStats).length > 0) {
        stats[dateStr] = dayStats;
      }
    }

    return stats;

  } catch (error) {
    logger.error('Get rate limit stats error:', error);
    return {};
  }
}

module.exports = {
  createRateLimiter,
  rateLimiters,
  getRateLimitStats
};