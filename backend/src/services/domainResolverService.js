const crypto = require('crypto');
const { EmailDomain } = require('../models');
const { cacheUtils, keyGenerators } = require('../config/redis');
const logger = require('../utils/logger');

class DomainResolverService {
  constructor() {
    this.performanceMetrics = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      totalRequests: 0
    };
    
    // Reset metrics every hour
    setInterval(() => {
      logger.info('Domain resolver performance metrics:', this.performanceMetrics);
      this.performanceMetrics = {
        l1Hits: 0,
        l2Hits: 0,
        l3Hits: 0,
        totalRequests: 0
      };
    }, 3600000);
  }

  /**
   * Resolve tenant from domain with multi-layer caching
   * @param {string} domain - Domain to resolve
   * @returns {Promise<{tenantId: string, tenantName: string} | null>}
   */
  async resolveTenant(domain) {
    if (!domain) return null;
    
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    const domainLower = domain.toLowerCase();
    const cacheKey = keyGenerators.domainMapping(domainLower);
    
    try {
      // L1: Memory Cache (fastest)
      const memoryResult = cacheUtils.memory.get(cacheKey);
      if (memoryResult) {
        this.performanceMetrics.l1Hits++;
        this.trackPerformance(domainLower, 'L1', Date.now() - startTime);
        return JSON.parse(memoryResult);
      }
      
      // Check negative cache
      const negativeCacheKey = keyGenerators.domainMissing(domainLower);
      const isNegativelyCached = cacheUtils.memory.get(negativeCacheKey);
      if (isNegativelyCached) {
        this.trackPerformance(domainLower, 'L1_negative', Date.now() - startTime);
        return null;
      }
      
      // L2: Redis Cache
      const redisResult = await cacheUtils.get(cacheKey, { populateL1: false });
      if (redisResult) {
        this.performanceMetrics.l2Hits++;
        const tenant = JSON.parse(redisResult);
        
        // Populate L1 cache
        cacheUtils.memory.set(cacheKey, redisResult, 5 * 60 * 1000); // 5 min
        
        this.trackPerformance(domainLower, 'L2', Date.now() - startTime);
        return tenant;
      }
      
      // Check Redis negative cache
      const redisNegative = await cacheUtils.get(negativeCacheKey, { populateL1: false });
      if (redisNegative) {
        cacheUtils.memory.set(negativeCacheKey, 'NOT_FOUND', 5 * 60 * 1000);
        this.trackPerformance(domainLower, 'L2_negative', Date.now() - startTime);
        return null;
      }
      
      // L3: Database lookup
      this.performanceMetrics.l3Hits++;
      const tenant = await this.dbLookup(domainLower);
      
      if (tenant) {
        // Cache positive result
        const tenantData = JSON.stringify({
          tenantId: tenant.tenantId.toString(),
          tenantName: tenant.tenantName
        });
        
        await cacheUtils.set(cacheKey, tenantData, 3600); // 1 hour in Redis
        cacheUtils.memory.set(cacheKey, tenantData, 5 * 60 * 1000); // 5 min in memory
        
        // Update domain access stats
        this.updateDomainStats(domainLower);
        
        this.trackPerformance(domainLower, 'L3', Date.now() - startTime);
        return JSON.parse(tenantData);
      } else {
        // Cache negative result
        await cacheUtils.set(negativeCacheKey, 'NOT_FOUND', 300); // 5 min in Redis
        cacheUtils.memory.set(negativeCacheKey, 'NOT_FOUND', 5 * 60 * 1000);
        
        this.trackPerformance(domainLower, 'L3_negative', Date.now() - startTime);
        return null;
      }
      
    } catch (error) {
      logger.error('Domain resolver error:', error);
      // Fallback to database on error
      try {
        return await this.dbLookup(domainLower);
      } catch (dbError) {
        logger.error('Database fallback failed:', dbError);
        return null;
      }
    }
  }

  /**
   * Database lookup for domain
   * @private
   */
  async dbLookup(domain) {
    try {
      const emailDomain = await EmailDomain.findByDomain(domain);
      
      if (emailDomain && emailDomain.tenantId) {
        return {
          tenantId: emailDomain.tenantId._id.toString(),
          tenantName: emailDomain.tenantName
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Database lookup error:', error);
      return null;
    }
  }

  /**
   * Resolve tenant by email address
   * @param {string} email - Email address
   * @returns {Promise<{tenantId: string, tenantName: string} | null>}
   */
  async resolveTenantByEmail(email) {
    if (!email) return null;
    
    const emailLower = email.toLowerCase();
    const emailHash = this.hashEmail(emailLower);
    const cacheKey = keyGenerators.userTenant(emailHash);
    
    try {
      // Check cache first
      const cached = await cacheUtils.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Extract domain and try domain resolution
      const domain = emailLower.split('@')[1];
      if (domain) {
        const domainTenant = await this.resolveTenant(domain);
        if (domainTenant) {
          // Cache the result
          await cacheUtils.set(cacheKey, JSON.stringify(domainTenant), 1800); // 30 min
          return domainTenant;
        }
      }
      
      // Check for user-specific mapping (for public domains)
      const emailDomain = await EmailDomain.findByEmail(emailLower);
      if (emailDomain && emailDomain.tenantId) {
        const tenant = {
          tenantId: emailDomain.tenantId._id.toString(),
          tenantName: emailDomain.tenantId.name || emailDomain.tenantName
        };
        
        // Cache the result
        await cacheUtils.set(cacheKey, JSON.stringify(tenant), 1800);
        return tenant;
      }
      
      return null;
    } catch (error) {
      logger.error('Email tenant resolution error:', error);
      return null;
    }
  }

  /**
   * Add or update domain mapping
   * @param {string} domain - Domain name
   * @param {string} tenantId - Tenant ID
   * @param {string} tenantName - Tenant name
   */
  async addDomainMapping(domain, tenantId, tenantName) {
    const domainLower = domain.toLowerCase();
    
    try {
      // Update database
      await EmailDomain.findOneAndUpdate(
        { domain: domainLower },
        {
          domain: domainLower,
          tenantId,
          tenantName,
          isActive: true,
          verificationStatus: 'verified'
        },
        { upsert: true, new: true }
      );
      
      // Update cache
      const tenantData = JSON.stringify({ tenantId, tenantName });
      const cacheKey = keyGenerators.domainMapping(domainLower);
      await cacheUtils.set(cacheKey, tenantData, 3600);
      
      // Remove from negative cache if exists
      const negativeCacheKey = keyGenerators.domainMissing(domainLower);
      await cacheUtils.delete(negativeCacheKey);
      
      logger.info(`Domain mapping added: ${domainLower} -> ${tenantName}`);
      return true;
    } catch (error) {
      logger.error('Add domain mapping error:', error);
      return false;
    }
  }

  /**
   * Remove domain mapping
   * @param {string} domain - Domain to remove
   */
  async removeDomainMapping(domain) {
    const domainLower = domain.toLowerCase();
    
    try {
      // Update database
      await EmailDomain.findOneAndUpdate(
        { domain: domainLower },
        { isActive: false },
        { new: true }
      );
      
      // Clear cache
      const cacheKey = keyGenerators.domainMapping(domainLower);
      await cacheUtils.delete(cacheKey);
      
      logger.info(`Domain mapping removed: ${domainLower}`);
      return true;
    } catch (error) {
      logger.error('Remove domain mapping error:', error);
      return false;
    }
  }

  /**
   * Get domains for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>}
   */
  async getTenantDomains(tenantId) {
    const cacheKey = keyGenerators.tenantDomains(tenantId);
    
    try {
      // Check cache
      const cached = await cacheUtils.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Database lookup
      const domains = await EmailDomain.findByTenant(tenantId);
      const domainList = domains.map(d => ({
        domain: d.domain,
        isPrimary: d.isPrimary,
        verificationStatus: d.verificationStatus,
        stats: d.stats
      }));
      
      // Cache result
      await cacheUtils.set(cacheKey, JSON.stringify(domainList), 600); // 10 min
      
      return domainList;
    } catch (error) {
      logger.error('Get tenant domains error:', error);
      return [];
    }
  }

  /**
   * Warm cache with frequently accessed domains
   */
  async warmCache() {
    try {
      logger.info('Starting domain cache warming...');
      
      const topDomains = await EmailDomain.getMostAccessedDomains(1000);
      const pipeline = cacheUtils.pipeline();
      
      for (const domain of topDomains) {
        if (domain.tenantId) {
          const tenantData = JSON.stringify({
            tenantId: domain.tenantId.toString(),
            tenantName: domain.tenantName
          });
          
          const cacheKey = keyGenerators.domainMapping(domain.domain);
          pipeline.setEx(cacheKey, 3600, tenantData);
          
          // Also populate L1 cache for top 100
          if (topDomains.indexOf(domain) < 100) {
            cacheUtils.memory.set(cacheKey, tenantData, 5 * 60 * 1000);
          }
        }
      }
      
      await pipeline.exec();
      logger.info(`Cache warmed with ${topDomains.length} domains`);
      
    } catch (error) {
      logger.error('Cache warming error:', error);
    }
  }

  /**
   * Update domain access statistics
   * @private
   */
  async updateDomainStats(domain) {
    try {
      await EmailDomain.findOneAndUpdate(
        { domain, isActive: true },
        {
          $inc: { 'stats.accessCount': 1 },
          $set: { 'stats.lastAccessed': new Date() }
        }
      );
    } catch (error) {
      logger.error('Update domain stats error:', error);
    }
  }

  /**
   * Track performance metrics
   * @private
   */
  trackPerformance(domain, cacheLevel, resolutionTime) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Domain resolution: ${domain} - ${cacheLevel} - ${resolutionTime}ms`);
    }
    
    // Could send to monitoring service
    if (resolutionTime > 50 && cacheLevel === 'L3') {
      logger.warn(`Slow domain resolution: ${domain} took ${resolutionTime}ms`);
    }
  }

  /**
   * Hash email for caching
   * @private
   */
  hashEmail(email) {
    return crypto.createHash('sha256').update(email).digest('hex');
  }
}

// Export singleton instance
module.exports = new DomainResolverService();