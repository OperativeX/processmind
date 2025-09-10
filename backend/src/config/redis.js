const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let isClusterMode = false;

// In-memory cache for L1 layer (most frequently accessed items)
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 1000;
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Memory cache entry structure
class CacheEntry {
  constructor(value, ttl = MEMORY_CACHE_TTL) {
    this.value = value;
    this.expires = Date.now() + ttl;
  }

  isExpired() {
    return Date.now() > this.expires;
  }
}

// Connect to Redis (with cluster support)
const connectRedis = async () => {
  try {
    // Default to localhost for both development and production (PM2 deployment)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const useCluster = process.env.REDIS_CLUSTER === 'true';
    
    if (useCluster) {
      // Redis Cluster Configuration
      const clusterNodes = process.env.REDIS_CLUSTER_NODES ? 
        JSON.parse(process.env.REDIS_CLUSTER_NODES) : 
        [
          { host: 'redis-1', port: 6379 },
          { host: 'redis-2', port: 6379 },
          { host: 'redis-3', port: 6379 }
        ];
      
      redisClient = redis.createCluster({
        rootNodes: clusterNodes,
        defaults: {
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
          },
          password: process.env.REDIS_PASSWORD
        },
        useReplicas: true,
        maxRetriesPerRequest: 3,
        keyPrefix: 'mt:' // Multi-tenant prefix
      });
      
      isClusterMode = true;
      logger.info('Connecting to Redis Cluster...');
    } else {
      // Single Redis instance
      redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        },
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'mt:' // Multi-tenant prefix
      });
      
      logger.info(`Connecting to Redis: ${redisUrl}`);
    }

    await redisClient.connect();
    
    logger.info(`✅ Redis connected${isClusterMode ? ' (Cluster Mode)' : ''}`);

    // Handle Redis events
    redisClient.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error:', error.message);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed through app termination');
      }
    });

    // Start memory cache cleanup interval
    setInterval(cleanupMemoryCache, 60000); // Clean every minute

    return redisClient;

  } catch (error) {
    logger.error('Error connecting to Redis:', {
      message: error.message,
      url: redisUrl,
      nodeEnv: process.env.NODE_ENV,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Get Redis client instance
const getRedisClient = () => {
  if (!redisClient) {
    logger.error('Redis client not initialized. Call connectRedis() first.');
    return null;
  }
  return redisClient;
};

// Memory cache cleanup
const cleanupMemoryCache = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.isExpired()) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  
  // If cache is too large, remove oldest entries
  if (memoryCache.size > MEMORY_CACHE_MAX_SIZE) {
    const entriesToRemove = memoryCache.size - MEMORY_CACHE_MAX_SIZE;
    const keys = Array.from(memoryCache.keys());
    for (let i = 0; i < entriesToRemove; i++) {
      memoryCache.delete(keys[i]);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Memory cache cleanup: removed ${cleaned} entries`);
  }
};

// Multi-layer cache utilities
const cacheUtils = {
  // L1 Cache: Memory
  memory: {
    get(key) {
      const entry = memoryCache.get(key);
      if (entry && !entry.isExpired()) {
        return entry.value;
      }
      memoryCache.delete(key);
      return null;
    },
    
    set(key, value, ttl = MEMORY_CACHE_TTL) {
      memoryCache.set(key, new CacheEntry(value, ttl));
    },
    
    delete(key) {
      return memoryCache.delete(key);
    },
    
    clear() {
      memoryCache.clear();
    }
  },

  // L2 Cache: Redis with automatic L1 population
  async get(key, options = {}) {
    const { populateL1 = true } = options;
    
    // Check L1 first
    const memoryValue = this.memory.get(key);
    if (memoryValue !== null) {
      return memoryValue;
    }
    
    // Check L2 (Redis)
    try {
      const value = await redisClient.get(key);
      if (value && populateL1) {
        // Populate L1 cache
        this.memory.set(key, value);
      }
      return value;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key, value, ttl = 3600, options = {}) {
    const { updateL1 = true } = options;
    
    try {
      // Set in Redis
      await redisClient.setEx(key, ttl, value);
      
      // Update L1 cache
      if (updateL1) {
        this.memory.set(key, value, ttl * 1000);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  },

  async delete(key) {
    try {
      // Delete from both layers
      this.memory.delete(key);
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  },

  // Pipeline operations for performance
  async multiGet(keys, options = {}) {
    const { populateL1 = true } = options;
    const results = {};
    const missingKeys = [];
    
    // Check L1 first
    for (const key of keys) {
      const value = this.memory.get(key);
      if (value !== null) {
        results[key] = value;
      } else {
        missingKeys.push(key);
      }
    }
    
    // Get missing keys from Redis
    if (missingKeys.length > 0) {
      try {
        const values = await redisClient.mGet(missingKeys);
        missingKeys.forEach((key, index) => {
          const value = values[index];
          if (value) {
            results[key] = value;
            if (populateL1) {
              this.memory.set(key, value);
            }
          }
        });
      } catch (error) {
        logger.error('Redis mGet error:', error);
      }
    }
    
    return results;
  },

  // Create a pipeline for batch operations
  pipeline() {
    return redisClient.multi();
  }
};

// Key generators for consistent naming
const keyGenerators = {
  domainMapping: (domain) => `domain:mapping:${domain}`,
  domainMissing: (domain) => `domain:missing:${domain}`,
  tenantDomains: (tenant) => `tenant:domains:${tenant}`,
  userTenant: (emailHash) => `user:tenant:${emailHash}`,
  pendingRegistration: (token) => `pending:registration:${token}`,
  sessionTenant: (sessionId) => `session:tenant:${sessionId}`,
  rateLimit: (tenant, ip) => `rate_limit:${tenant}:${ip}`,
  verificationCode: (email) => `verify:code:${email}`,
  loginAttempts: (email) => `login:attempts:${email}`
};

module.exports = {
  connectRedis,
  getRedisClient,
  cacheUtils,
  keyGenerators,
  isClusterMode: () => isClusterMode
};