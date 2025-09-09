const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class SimilarityCacheService {
  constructor() {
    this.cacheTTL = 3600; // 1 hour cache
    this.cachePrefix = 'similarity:';
  }

  /**
   * Get cache key for similarity between two processes
   */
  getCacheKey(processId1, processId2) {
    // Sort IDs to ensure consistent key regardless of order
    const [id1, id2] = [processId1, processId2].sort();
    return `${this.cachePrefix}${id1}:${id2}`;
  }

  /**
   * Get cached similarity score
   */
  async getCachedSimilarity(processId1, processId2) {
    try {
      const redis = getRedisClient();
      if (!redis) return null;

      const key = this.getCacheKey(processId1, processId2);
      const cached = await redis.get(key);
      
      if (cached) {
        logger.debug(`Cache hit for similarity ${processId1} <-> ${processId2}`);
        return parseFloat(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting cached similarity:', error);
      return null;
    }
  }

  /**
   * Set cached similarity score
   */
  async setCachedSimilarity(processId1, processId2, similarity) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const key = this.getCacheKey(processId1, processId2);
      await redis.set(key, similarity.toString(), { EX: this.cacheTTL });
      
      logger.debug(`Cached similarity ${processId1} <-> ${processId2}: ${similarity}`);
    } catch (error) {
      logger.error('Error setting cached similarity:', error);
    }
  }

  /**
   * Get similarity matrix for multiple processes
   */
  async getSimilarityMatrix(processIds) {
    try {
      const redis = getRedisClient();
      if (!redis) return {};

      const matrix = {};
      const pipeline = redis.multi();
      const keys = [];

      // Build pipeline for batch get
      for (let i = 0; i < processIds.length - 1; i++) {
        for (let j = i + 1; j < processIds.length; j++) {
          const key = this.getCacheKey(processIds[i], processIds[j]);
          keys.push({ key, i, j });
          pipeline.get(key);
        }
      }

      const results = await pipeline.exec();

      // Process results
      keys.forEach((keyInfo, index) => {
        if (results[index] && results[index][1]) {
          const similarity = parseFloat(results[index][1]);
          if (!matrix[processIds[keyInfo.i]]) {
            matrix[processIds[keyInfo.i]] = {};
          }
          if (!matrix[processIds[keyInfo.j]]) {
            matrix[processIds[keyInfo.j]] = {};
          }
          matrix[processIds[keyInfo.i]][processIds[keyInfo.j]] = similarity;
          matrix[processIds[keyInfo.j]][processIds[keyInfo.i]] = similarity;
        }
      });

      return matrix;
    } catch (error) {
      logger.error('Error getting similarity matrix:', error);
      return {};
    }
  }

  /**
   * Cache similarity matrix for multiple processes
   */
  async cacheSimilarityMatrix(similarityPairs) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const pipeline = redis.multi();

      for (const { processId1, processId2, similarity } of similarityPairs) {
        const key = this.getCacheKey(processId1, processId2);
        pipeline.set(key, similarity.toString(), { EX: this.cacheTTL });
      }

      await pipeline.exec();
      
      logger.info(`Cached ${similarityPairs.length} similarity pairs`);
    } catch (error) {
      logger.error('Error caching similarity matrix:', error);
    }
  }

  /**
   * Invalidate cache for a specific process
   */
  async invalidateProcessCache(processId) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      // Find all keys containing this processId
      const pattern = `${this.cachePrefix}*${processId}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache entries for process ${processId}`);
      }
    } catch (error) {
      logger.error('Error invalidating process cache:', error);
    }
  }

  /**
   * Clear entire similarity cache
   */
  async clearCache() {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const pattern = `${this.cachePrefix}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cleared ${keys.length} similarity cache entries`);
      }
    } catch (error) {
      logger.error('Error clearing similarity cache:', error);
    }
  }
}

module.exports = new SimilarityCacheService();