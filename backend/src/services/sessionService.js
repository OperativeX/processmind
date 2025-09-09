const { v4: uuidv4 } = require('uuid');
const { cacheUtils, keyGenerators } = require('../config/redis');
const logger = require('../utils/logger');

class SessionService {
  /**
   * Create a new session for user with tenant context
   * @param {Object} sessionData - Session data
   * @returns {Promise<string>} - Session ID
   */
  async createSession(sessionData) {
    try {
      const {
        userId,
        tenantId,
        currentTenant,
        availableTenants = [],
        userAgent,
        ipAddress,
        metadata = {}
      } = sessionData;

      const sessionId = uuidv4();
      const sessionKey = keyGenerators.sessionTenant(sessionId);
      
      const session = {
        sessionId,
        userId,
        tenantId,
        currentTenant: currentTenant || tenantId,
        availableTenants: availableTenants.length > 0 ? availableTenants : [tenantId],
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        lastSwitched: null,
        userAgent,
        ipAddress,
        metadata
      };

      // Store session in Redis with 24 hour TTL
      await cacheUtils.set(sessionKey, JSON.stringify(session), 86400);
      
      // Track active session for user
      await this.addUserSession(userId, sessionId);
      
      logger.info('Session created', {
        sessionId,
        userId,
        tenantId: currentTenant || tenantId
      });

      return sessionId;

    } catch (error) {
      logger.error('Create session error:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} - Session data
   */
  async getSession(sessionId) {
    try {
      const sessionKey = keyGenerators.sessionTenant(sessionId);
      const sessionData = await cacheUtils.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData);
      
      // Update last accessed time
      session.lastAccessed = Date.now();
      await cacheUtils.set(sessionKey, JSON.stringify(session), 86400);
      
      return session;

    } catch (error) {
      logger.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Switch tenant in session
   * @param {string} sessionId - Session ID
   * @param {string} newTenantId - New tenant ID
   * @returns {Promise<boolean>} - Success status
   */
  async switchTenant(sessionId, newTenantId) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }
      
      // Check if user has access to the tenant
      if (!session.availableTenants.includes(newTenantId)) {
        logger.warn('Tenant switch denied - no access', {
          sessionId,
          userId: session.userId,
          requestedTenant: newTenantId,
          availableTenants: session.availableTenants
        });
        return false;
      }
      
      // Update current tenant
      session.currentTenant = newTenantId;
      session.lastSwitched = Date.now();
      
      const sessionKey = keyGenerators.sessionTenant(sessionId);
      await cacheUtils.set(sessionKey, JSON.stringify(session), 86400);
      
      logger.info('Tenant switched in session', {
        sessionId,
        userId: session.userId,
        fromTenant: session.tenantId,
        toTenant: newTenantId
      });
      
      return true;

    } catch (error) {
      logger.error('Switch tenant error:', error);
      return false;
    }
  }

  /**
   * Update session metadata
   * @param {string} sessionId - Session ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateSessionMetadata(sessionId, metadata) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }
      
      session.metadata = { ...session.metadata, ...metadata };
      session.lastAccessed = Date.now();
      
      const sessionKey = keyGenerators.sessionTenant(sessionId);
      await cacheUtils.set(sessionKey, JSON.stringify(session), 86400);
      
      return true;

    } catch (error) {
      logger.error('Update session metadata error:', error);
      return false;
    }
  }

  /**
   * Add available tenant to session
   * @param {string} sessionId - Session ID
   * @param {string} tenantId - Tenant ID to add
   * @returns {Promise<boolean>} - Success status
   */
  async addAvailableTenant(sessionId, tenantId) {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }
      
      if (!session.availableTenants.includes(tenantId)) {
        session.availableTenants.push(tenantId);
        
        const sessionKey = keyGenerators.sessionTenant(sessionId);
        await cacheUtils.set(sessionKey, JSON.stringify(session), 86400);
        
        logger.info('Tenant added to session', {
          sessionId,
          userId: session.userId,
          tenantId
        });
      }
      
      return true;

    } catch (error) {
      logger.error('Add available tenant error:', error);
      return false;
    }
  }

  /**
   * Remove session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  async removeSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      
      if (session) {
        // Remove from user's active sessions
        await this.removeUserSession(session.userId, sessionId);
      }
      
      const sessionKey = keyGenerators.sessionTenant(sessionId);
      await cacheUtils.delete(sessionKey);
      
      logger.info('Session removed', { sessionId });
      
      return true;

    } catch (error) {
      logger.error('Remove session error:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Active sessions
   */
  async getUserSessions(userId) {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) return [];
      
      const userSessionsKey = `user:${userId}:sessions`;
      const sessionIds = await redis.sMembers(userSessionsKey);
      
      const sessions = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        } else {
          // Clean up invalid session reference
          await redis.sRem(userSessionsKey, sessionId);
        }
      }
      
      return sessions.sort((a, b) => b.lastAccessed - a.lastAccessed);

    } catch (error) {
      logger.error('Get user sessions error:', error);
      return [];
    }
  }

  /**
   * Invalidate all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of sessions invalidated
   */
  async invalidateUserSessions(userId) {
    try {
      const sessions = await this.getUserSessions(userId);
      let count = 0;
      
      for (const session of sessions) {
        if (await this.removeSession(session.sessionId)) {
          count++;
        }
      }
      
      logger.info('User sessions invalidated', { userId, count });
      return count;

    } catch (error) {
      logger.error('Invalidate user sessions error:', error);
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} - Number of sessions cleaned
   */
  async cleanupExpiredSessions() {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) return 0;
      
      // Redis automatically expires keys, but we can clean up user session references
      const pattern = 'user:*:sessions';
      const userKeys = await redis.keys(pattern);
      
      let cleaned = 0;
      for (const userKey of userKeys) {
        const sessionIds = await redis.sMembers(userKey);
        
        for (const sessionId of sessionIds) {
          const session = await this.getSession(sessionId);
          if (!session) {
            await redis.sRem(userKey, sessionId);
            cleaned++;
          }
        }
      }
      
      logger.info(`Cleaned up ${cleaned} expired session references`);
      return cleaned;

    } catch (error) {
      logger.error('Cleanup expired sessions error:', error);
      return 0;
    }
  }

  /**
   * Track session for user
   * @private
   */
  async addUserSession(userId, sessionId) {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) return;
      
      const userSessionsKey = `user:${userId}:sessions`;
      await redis.sAdd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, 7 * 24 * 60 * 60); // 7 days

    } catch (error) {
      logger.error('Add user session error:', error);
    }
  }

  /**
   * Remove session from user tracking
   * @private
   */
  async removeUserSession(userId, sessionId) {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) return;
      
      const userSessionsKey = `user:${userId}:sessions`;
      await redis.sRem(userSessionsKey, sessionId);

    } catch (error) {
      logger.error('Remove user session error:', error);
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} - Session statistics
   */
  async getSessionStats() {
    try {
      const redis = require('../config/redis').getRedisClient();
      if (!redis) return {};
      
      const sessionKeys = await redis.keys('mt:session:tenant:*');
      const userKeys = await redis.keys('user:*:sessions');
      
      const stats = {
        totalSessions: sessionKeys.length,
        totalUsersWithSessions: userKeys.length,
        timestamp: new Date().toISOString()
      };
      
      return stats;

    } catch (error) {
      logger.error('Get session stats error:', error);
      return {};
    }
  }
}

// Export singleton instance
module.exports = new SessionService();