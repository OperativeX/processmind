#!/usr/bin/env node

/**
 * Queue Worker Process - Runs in separate process from main server
 * Handles all background job processing with proper resource isolation
 */

require('dotenv').config();
const logger = require('../utils/logger');
const connectDB = require('../config/database');
const { connectRedis } = require('../config/redis');

// Graceful shutdown handling
let isShuttingDown = false;
const activeWorkers = new Set();

// Performance monitoring
const performanceStats = {
  startTime: Date.now(),
  jobsProcessed: 0,
  jobsFailed: 0,
  memoryPeaks: []
};

// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  performanceStats.memoryPeaks.push({
    timestamp: Date.now(),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rss: memUsage.rss,
    external: memUsage.external
  });
  
  // Keep only last 100 measurements
  if (performanceStats.memoryPeaks.length > 100) {
    performanceStats.memoryPeaks.shift();
  }
  
  // Log memory usage every 5 minutes
  if (performanceStats.memoryPeaks.length % 60 === 0) {
    logger.info('Worker process memory usage', {
      current: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024)
      },
      jobsProcessed: performanceStats.jobsProcessed,
      jobsFailed: performanceStats.jobsFailed,
      uptime: Math.round((Date.now() - performanceStats.startTime) / 1000 / 60) + ' minutes'
    });
  }
  
  // Force garbage collection if heap usage is high
  if (global.gc && memUsage.heapUsed > memUsage.heapTotal * 0.8) {
    global.gc();
    logger.info('Forced garbage collection due to high heap usage');
  }
}, 5000); // Check every 5 seconds

// Initialize worker process
async function initializeWorkerProcess() {
  try {
    logger.info('🚀 Initializing queue worker process...', {
      nodeVersion: process.version,
      pid: process.pid,
      workerType: process.env.WORKER_TYPE || 'queue'
    });
    
    // Connect to databases
    logger.info('🔗 Connecting to MongoDB...');
    await connectDB();
    
    logger.info('🔗 Connecting to Redis...');
    await connectRedis();
    
    // Load and start queue workers
    logger.info('📦 Loading queue workers...');
    const queueWorkers = require('../services/queueWorkers');
    
    // Register workers for shutdown
    if (queueWorkers.videoWorker) activeWorkers.add(queueWorkers.videoWorker);
    if (queueWorkers.audioWorker) activeWorkers.add(queueWorkers.audioWorker);
    if (queueWorkers.transcriptionWorker) activeWorkers.add(queueWorkers.transcriptionWorker);
    if (queueWorkers.aiWorker) activeWorkers.add(queueWorkers.aiWorker);
    if (queueWorkers.cleanupWorker) activeWorkers.add(queueWorkers.cleanupWorker);
    if (queueWorkers.s3UploadWorker) activeWorkers.add(queueWorkers.s3UploadWorker);
    if (queueWorkers.localCleanupWorker) activeWorkers.add(queueWorkers.localCleanupWorker);
    
    logger.info('✅ Queue worker process initialized successfully', {
      workers: activeWorkers.size,
      pid: process.pid
    });
    
    // Send ready signal to PM2
    if (process.send) {
      process.send('ready');
    }
    
    // Monitor job completion
    // monitorJobCompletion(); // Temporarily disabled due to compatibility issues
    
  } catch (error) {
    logger.error('❌ Failed to initialize worker process:', error);
    process.exit(1);
  }
}

// Monitor job completion and update stats
function monitorJobCompletion() {
  activeWorkers.forEach(worker => {
    if (worker && typeof worker.on === 'function') {
      worker.on('completed', (job) => {
        performanceStats.jobsProcessed++;
        logger.debug(`Job completed: ${job.name} (${job.id})`);
      });
      
      worker.on('failed', (job, error) => {
        performanceStats.jobsFailed++;
        logger.error(`Job failed: ${job.name} (${job.id})`, { error: error.message });
      });
    }
  });
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.info('Already shutting down...');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`, {
    jobsProcessed: performanceStats.jobsProcessed,
    jobsFailed: performanceStats.jobsFailed
  });
  
  try {
    // Stop accepting new jobs
    const closePromises = [];
    activeWorkers.forEach(worker => {
      if (worker && typeof worker.close === 'function') {
        closePromises.push(worker.close());
      }
    });
    
    // Wait for all workers to close with timeout
    await Promise.race([
      Promise.all(closePromises),
      new Promise((resolve) => setTimeout(resolve, 30000)) // 30 second timeout
    ]);
    
    logger.info('All workers closed successfully');
    
    // Log final statistics
    logger.info('Worker process final statistics', {
      totalJobsProcessed: performanceStats.jobsProcessed,
      totalJobsFailed: performanceStats.jobsFailed,
      uptimeMinutes: Math.round((Date.now() - performanceStats.startTime) / 1000 / 60),
      peakMemoryMB: Math.max(...performanceStats.memoryPeaks.map(p => p.rss)) / 1024 / 1024
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker process:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in worker process:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// PM2 graceful reload support
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    gracefulShutdown('PM2_SHUTDOWN');
  }
});

// Health check endpoint for monitoring
if (process.env.WORKER_HEALTH_CHECK_PORT) {
  const http = require('http');
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      const health = {
        status: isShuttingDown ? 'shutting_down' : 'healthy',
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        stats: {
          jobsProcessed: performanceStats.jobsProcessed,
          jobsFailed: performanceStats.jobsFailed,
          activeWorkers: activeWorkers.size
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  healthServer.listen(process.env.WORKER_HEALTH_CHECK_PORT, () => {
    logger.info(`Worker health check available on port ${process.env.WORKER_HEALTH_CHECK_PORT}`);
  });
}

// Start the worker process
initializeWorkerProcess();