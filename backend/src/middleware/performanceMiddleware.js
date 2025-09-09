const logger = require('../utils/logger');
const { performance } = require('perf_hooks');

// In-memory storage for performance metrics
const performanceMetrics = {
  requests: new Map(),
  slowQueries: [],
  memorySnapshots: [],
  routeStats: new Map()
};

// Cleanup old metrics every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  
  // Clean up old requests
  for (const [id, data] of performanceMetrics.requests.entries()) {
    if (data.timestamp < oneHourAgo) {
      performanceMetrics.requests.delete(id);
    }
  }
  
  // Keep only last 100 slow queries
  if (performanceMetrics.slowQueries.length > 100) {
    performanceMetrics.slowQueries = performanceMetrics.slowQueries.slice(-100);
  }
  
  // Keep only last 60 memory snapshots
  if (performanceMetrics.memorySnapshots.length > 60) {
    performanceMetrics.memorySnapshots = performanceMetrics.memorySnapshots.slice(-60);
  }
}, 3600000);

// Capture memory snapshot every minute
setInterval(() => {
  const memUsage = process.memoryUsage();
  performanceMetrics.memorySnapshots.push({
    timestamp: Date.now(),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rss: memUsage.rss,
    external: memUsage.external
  });
}, 60000);

/**
 * Performance monitoring middleware
 */
const performanceMiddleware = (options = {}) => {
  const {
    slowRequestThreshold = 1000, // 1 second
    logSlowRequests = true,
    includeMemoryStats = true,
    excludePaths = ['/health', '/metrics']
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.includes(req.path)) {
      return next();
    }

    const startTime = performance.now();
    const startMemory = includeMemoryStats ? process.memoryUsage() : null;
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store request start data
    performanceMetrics.requests.set(requestId, {
      timestamp: Date.now(),
      method: req.method,
      path: req.path,
      startTime,
      startMemory
    });

    // Override res.end to capture response timing
    const originalEnd = res.end;
    res.end = function(...args) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = includeMemoryStats ? process.memoryUsage() : null;

      // Update route statistics
      const routeKey = `${req.method} ${req.route?.path || req.path}`;
      if (!performanceMetrics.routeStats.has(routeKey)) {
        performanceMetrics.routeStats.set(routeKey, {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          errors: 0
        });
      }

      const routeStat = performanceMetrics.routeStats.get(routeKey);
      routeStat.count++;
      routeStat.totalDuration += duration;
      routeStat.avgDuration = routeStat.totalDuration / routeStat.count;
      routeStat.minDuration = Math.min(routeStat.minDuration, duration);
      routeStat.maxDuration = Math.max(routeStat.maxDuration, duration);

      if (res.statusCode >= 400) {
        routeStat.errors++;
      }

      // Log slow requests
      if (duration > slowRequestThreshold && logSlowRequests) {
        const slowRequestData = {
          method: req.method,
          path: req.path,
          params: req.params,
          query: req.query,
          duration: Math.round(duration),
          statusCode: res.statusCode,
          userAgent: req.get('user-agent'),
          ip: req.ip
        };

        if (includeMemoryStats && startMemory && endMemory) {
          slowRequestData.memoryDelta = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            rss: endMemory.rss - startMemory.rss
          };
        }

        logger.warn('Slow request detected', slowRequestData);
        performanceMetrics.slowQueries.push({
          ...slowRequestData,
          timestamp: Date.now()
        });
      }

      // Add performance headers
      res.set('X-Response-Time', `${Math.round(duration)}ms`);
      
      // Clean up request data
      performanceMetrics.requests.delete(requestId);

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
};

/**
 * Performance metrics endpoint handler
 */
performanceMiddleware.getMetrics = () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  // Calculate route statistics summary
  const routeStatsSummary = Array.from(performanceMetrics.routeStats.entries())
    .map(([route, stats]) => ({
      route,
      ...stats,
      avgDuration: Math.round(stats.avgDuration),
      minDuration: Math.round(stats.minDuration),
      maxDuration: Math.round(stats.maxDuration),
      errorRate: stats.count > 0 ? (stats.errors / stats.count * 100).toFixed(2) + '%' : '0%'
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 20); // Top 20 slowest routes

  return {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version
    },
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    activeRequests: performanceMetrics.requests.size,
    slowQueries: performanceMetrics.slowQueries.slice(-10), // Last 10 slow queries
    routeStats: routeStatsSummary,
    memoryTrend: performanceMetrics.memorySnapshots.slice(-10).map(snapshot => ({
      timestamp: new Date(snapshot.timestamp).toISOString(),
      heapUsedMB: Math.round(snapshot.heapUsed / 1024 / 1024)
    }))
  };
};

/**
 * Express route handler for metrics endpoint
 */
performanceMiddleware.metricsHandler = (req, res) => {
  const metrics = performanceMiddleware.getMetrics();
  res.json(metrics);
};

module.exports = performanceMiddleware;