// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const { validateEnvironment } = require('./config/startup');
const errorHandler = require('./middleware/errorHandler');
const tenantMiddleware = require('./middleware/tenantMiddleware');
const performanceMiddleware = require('./middleware/performanceMiddleware');

const authRoutes = require('./routes/auth');
const processRoutes = require('./routes/processes');
const favoriteListRoutes = require('./routes/favoriteLists');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const publicRoutes = require('./routes/public');
const videoRoutes = require('./routes/video');
const teamRoutes = require('./routes/team');
const billingRoutes = require('./routes/billing');
const limitsRoutes = require('./routes/limits');
const webhookRoutes = require('./routes/webhooks');
const superAdminRoutes = require('./routes/superAdminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

// Rate limiting with development-friendly settings
const isDevelopment = process.env.NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100), // Higher limit in dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for status endpoints in development
    if (isDevelopment && req.path.includes('/status')) {
      return true;
    }
    return false;
  }
});

app.use('/api', limiter);

// Body parsing middleware with reasonable limits for non-file requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 1000 }));

// Compression middleware
app.use(compression());

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3001',
  'http://localhost:3000', // React dev server default
  'http://localhost:5001', // Configured frontend port
  'http://localhost:8080', // Alternative dev port
];

app.use(cors({
  origin: function (origin, callback) {
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Performance monitoring middleware
app.use(performanceMiddleware({
  slowRequestThreshold: 1000,
  logSlowRequests: true,
  excludePaths: ['/health', '/metrics']
}));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Performance metrics endpoint
app.get('/metrics', performanceMiddleware.metricsHandler);

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/video', videoRoutes); // Video routes with token-based auth
app.use('/api/v1/webhooks', webhookRoutes); // Webhooks (raw body, no auth)
app.use('/api/v1/super-admin', superAdminRoutes); // Super admin routes
app.use('/api/v1/billing', billingRoutes); // General billing routes (pricing config)
app.use('/api/v1/limits', limitsRoutes); // General limits routes

// Protected routes with tenant middleware
app.use('/api/v1/tenants/:tenantId', tenantMiddleware);
app.use('/api/v1/tenants/:tenantId/processes', processRoutes);
app.use('/api/v1/tenants/:tenantId/favorite-lists', favoriteListRoutes);
app.use('/api/v1/tenants/:tenantId/users', userRoutes);
app.use('/api/v1/tenants/:tenantId/notifications', notificationRoutes);
app.use('/api/v1/tenants/:tenantId/team', teamRoutes);
app.use('/api/v1/tenants/:tenantId/billing', billingRoutes);
app.use('/api/v1/tenants/:tenantId/limits', limitsRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Shutting down gracefully...');
  process.exit(0);
});

// Connect to databases and start server
const startServer = async () => {
  try {
    // Validate environment first
    validateEnvironment();
    
    logger.info('🔄 Starting server initialization...');
    
    logger.info('🔗 Connecting to MongoDB...');
    await connectDB();
    
    logger.info('🔗 Connecting to Redis...');
    await connectRedis();
    
    // Initialize email service (with timeout to prevent hanging)
    const emailService = require('./services/emailService');
    try {
      const emailInitPromise = emailService.initialize();
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Email service initialization timeout')), 5000);
      });
      
      await Promise.race([emailInitPromise, timeoutPromise]);
      logger.info('📧 Email service initialized');
    } catch (error) {
      logger.warn('⚠️  Email service initialization failed or timed out:', error.message);
      logger.warn('⚠️  Server will continue without email functionality');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 ProcessLink Backend server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
      
      // Configure timeout for large file uploads (20 minutes)
      server.timeout = 20 * 60 * 1000; // 1200 seconds
      server.headersTimeout = 21 * 60 * 1000; // 1260 seconds  
      server.requestTimeout = 20 * 60 * 1000; // 1200 seconds
      server.keepAliveTimeout = 20 * 60 * 1000; // 1200 seconds
      
      logger.info(`⏱️ Server timeouts configured for large uploads: ${server.timeout / 1000}s`);
      
      // Workers now run in separate processes via PM2
      if (process.env.DISABLE_WORKERS === 'true') {
        logger.info('⚠️  Queue workers disabled by DISABLE_WORKERS flag');
        logger.info('💡 Workers should be running in separate processes via PM2');
      } else {
        logger.info('📦 Queue workers are managed by PM2 in separate processes');
        logger.info('💡 Use PM2 to start/stop/monitor worker processes');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();