const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Connection pool configuration for optimal performance
const getConnectionOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    // Connection Pool Settings
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || (isProduction ? 50 : 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || (isProduction ? 10 : 2),
    maxIdleTimeMS: 60000, // Close idle connections after 1 minute
    waitQueueTimeoutMS: 30000, // Max time to wait for a connection from pool
    
    // Performance Optimizations
    serverSelectionTimeoutMS: 10000, // Increased for better reliability
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip IPv6 for faster connections
    
    // Write Concern for better performance
    writeConcern: {
      w: isProduction ? 'majority' : 1,
      j: isProduction, // Journal writes in production only
      wtimeout: 5000
    },
    
    // Read Preference
    readPreference: process.env.MONGODB_READ_PREFERENCE || 'primaryPreferred',
    readConcern: { level: 'majority' },
    
    // Compression disabled to avoid dependency issues
    // compressors: [],
    
    // Monitoring
    monitorCommands: isDevelopment,
    
    // Connection Settings
    retryWrites: true,
    retryReads: true,
    maxConnecting: 5, // Limit concurrent connection attempts
    directConnection: false,
    
    // Keep Alive
    heartbeatFrequencyMS: 30000,
    minHeartbeatFrequencyMS: 1000
  };
};

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind';
  
  try {
    const options = getConnectionOptions();
    
    logger.info('Connecting to MongoDB with optimized settings...', {
      mongoURI,
      maxPoolSize: options.maxPoolSize,
      minPoolSize: options.minPoolSize,
      readPreference: options.readPreference
    });
    
    await mongoose.connect(mongoURI, options);

    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);
    
    // Monitor connection pool
    const db = mongoose.connection.db;
    if (db) {
      const adminDb = db.admin();
      setInterval(async () => {
        try {
          const serverStatus = await adminDb.serverStatus();
          const connPoolStats = serverStatus.connections || {};
          
          if (process.env.LOG_CONNECTION_STATS === 'true') {
            logger.info('MongoDB connection pool stats', {
              current: connPoolStats.current,
              available: connPoolStats.available,
              totalCreated: connPoolStats.totalCreated
            });
          }
        } catch (error) {
          // Ignore stats collection errors
        }
      }, 60000); // Check every minute
    }

    // Handle connection events
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      
      // Implement reconnection logic
      if (error.name === 'MongoNetworkError') {
        setTimeout(() => {
          logger.info('Attempting to reconnect to MongoDB...');
          mongoose.connect(mongoURI, getConnectionOptions()).catch(err => {
            logger.error('Reconnection failed:', err);
          });
        }, 5000);
      }
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    // Monitor slow queries (disabled for now due to compatibility issues)
    // mongoose.set('debug', true); // Simple debug mode for development

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error connecting to MongoDB:', error.message);
    logger.error('MongoDB URI:', mongoURI);
    logger.error('Full error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;