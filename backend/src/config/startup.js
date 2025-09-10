const logger = require('../utils/logger');

// Startup configuration and environment validation
const validateEnvironment = () => {
  logger.info('=== Starting ProcessMind Backend ===');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Port: ${process.env.PORT || 5000}`);
  
  // Log Redis configuration
  logger.info('Redis Configuration:', {
    REDIS_URL: process.env.REDIS_URL || 'NOT SET',
    REDIS_HOST: process.env.REDIS_HOST || 'NOT SET',
    REDIS_PORT: process.env.REDIS_PORT || 'NOT SET'
  });
  
  // Log MongoDB configuration
  logger.info('MongoDB Configuration:', {
    MONGODB_URI: process.env.MONGODB_URI ? '***HIDDEN***' : 'NOT SET'
  });
  
  // Check critical environment variables for production
  if (process.env.NODE_ENV === 'production') {
    const required = [
      'MONGODB_URI',
      'JWT_SECRET',
      'OPENAI_API_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      logger.error('Missing required environment variables:', missing);
      logger.error('Please set all required environment variables for production.');
      process.exit(1);
    }
  }
  
  // Force Redis URL in production if not set correctly
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set in production, using default docker network URL');
    process.env.REDIS_URL = 'redis://redis:6379';
  }
  
  logger.info('Environment validation completed successfully');
};

module.exports = { validateEnvironment };