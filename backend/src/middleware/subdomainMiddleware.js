const logger = require('../utils/logger');
const domainResolver = require('../services/domainResolverService');

/**
 * Middleware to extract and validate subdomain from request
 * Sets req.subdomain and optionally resolves tenant
 */
const subdomainMiddleware = (options = {}) => {
  const {
    resolveTenant = true,
    requireSubdomain = false,
    excludedSubdomains = ['www', 'api', 'app', 'admin', 'static', 'assets']
  } = options;

  return async (req, res, next) => {
    try {
      const host = req.get('host');
      const subdomain = extractSubdomain(host, excludedSubdomains);
      
      // Store subdomain in request
      req.subdomain = subdomain;
      
      if (!subdomain) {
        if (requireSubdomain) {
          return res.status(400).json({
            success: false,
            message: 'Subdomain required'
          });
        }
        return next();
      }
      
      // Optionally resolve tenant from subdomain
      if (resolveTenant && subdomain) {
        try {
          const tenant = await domainResolver.resolveTenant(subdomain);
          
          if (tenant) {
            req.resolvedTenant = tenant;
            req.tenantId = req.tenantId || tenant.tenantId;
            
            logger.debug('Tenant resolved from subdomain:', {
              subdomain,
              tenantId: tenant.tenantId,
              tenantName: tenant.tenantName
            });
          } else if (requireSubdomain) {
            return res.status(404).json({
              success: false,
              message: 'Invalid subdomain or tenant not found'
            });
          }
        } catch (error) {
          logger.error('Subdomain tenant resolution error:', error);
          
          if (requireSubdomain) {
            return res.status(500).json({
              success: false,
              message: 'Error resolving tenant from subdomain'
            });
          }
        }
      }
      
      next();
      
    } catch (error) {
      logger.error('Subdomain middleware error:', error);
      
      if (requireSubdomain) {
        return res.status(500).json({
          success: false,
          message: 'Subdomain processing error'
        });
      }
      
      next();
    }
  };
};

/**
 * Extract subdomain from host
 * @param {string} host - Host header value
 * @param {Array<string>} excludedSubdomains - Subdomains to exclude
 * @returns {string|null} - Subdomain or null
 */
function extractSubdomain(host, excludedSubdomains = []) {
  if (!host) return null;
  
  // Remove port if present
  const hostname = host.split(':')[0].toLowerCase();
  
  // Handle localhost and IP addresses
  if (hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return null;
  }
  
  // Split by dots
  const parts = hostname.split('.');
  
  // Need at least 3 parts for a subdomain (subdomain.domain.tld)
  if (parts.length < 3) {
    return null;
  }
  
  // Extract potential subdomain
  const subdomain = parts[0];
  
  // Check if it's an excluded subdomain
  if (excludedSubdomains.includes(subdomain)) {
    // Check if there's another subdomain before the excluded one
    if (parts.length > 3) {
      return parts[0]; // Return the first part if there are multiple subdomains
    }
    return null;
  }
  
  return subdomain;
}

/**
 * Validate subdomain format
 * @param {string} subdomain - Subdomain to validate
 * @returns {boolean} - Whether subdomain is valid
 */
function isValidSubdomain(subdomain) {
  if (!subdomain) return false;
  
  // Subdomain rules:
  // - 1-63 characters
  // - Alphanumeric and hyphens only
  // - Cannot start or end with hyphen
  // - Cannot contain consecutive hyphens
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  
  return subdomainRegex.test(subdomain);
}

/**
 * Create subdomain URL
 * @param {string} subdomain - Subdomain
 * @param {string} baseDomain - Base domain
 * @param {string} protocol - Protocol (http/https)
 * @returns {string} - Full URL with subdomain
 */
function createSubdomainUrl(subdomain, baseDomain, protocol = 'https') {
  if (!isValidSubdomain(subdomain)) {
    throw new Error('Invalid subdomain format');
  }
  
  // Remove any existing protocol from baseDomain
  baseDomain = baseDomain.replace(/^https?:\/\//, '');
  
  // Remove any existing subdomain from baseDomain
  const parts = baseDomain.split('.');
  if (parts.length > 2) {
    baseDomain = parts.slice(-2).join('.');
  }
  
  return `${protocol}://${subdomain}.${baseDomain}`;
}

// Export middleware and utilities
module.exports = subdomainMiddleware;
module.exports.extractSubdomain = extractSubdomain;
module.exports.isValidSubdomain = isValidSubdomain;
module.exports.createSubdomainUrl = createSubdomainUrl;