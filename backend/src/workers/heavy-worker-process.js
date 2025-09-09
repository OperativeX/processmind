#!/usr/bin/env node

/**
 * Heavy Worker Process - Handles CPU-intensive video/audio processing
 * Runs in separate process with worker threads for maximum performance
 */

require('dotenv').config();
const { Worker } = require('worker_threads');
const { Worker: BullWorker } = require('bullmq');
const { queues, jobTypes } = require('../config/bullmq');
const logger = require('../utils/logger');
const connectDB = require('../config/database');
const { connectRedis, getRedisClient } = require('../config/redis');
const path = require('path');

// Worker pool for CPU-intensive tasks
class WorkerPool {
  constructor(workerScript, poolSize = 4) {
    this.workers = [];
    this.freeWorkers = [];
    this.queue = [];
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    
    this.init();
  }
  
  init() {
    for (let i = 0; i < this.poolSize; i++) {
      this.addNewWorker();
    }
  }
  
  addNewWorker() {
    const worker = new Worker(path.join(__dirname, this.workerScript), {
      workerData: { workerId: this.workers.length }
    });
    
    worker.on('message', (result) => {
      worker._currentResolve(result);
      worker._currentResolve = null;
      worker._currentReject = null;
      
      this.freeWorkers.push(worker);
      this.process();
    });
    
    worker.on('error', (error) => {
      if (worker._currentReject) {
        worker._currentReject(error);
      }
      logger.error('Worker thread error:', error);
    });
    
    worker.on('exit', (code) => {
      logger.warn(`Worker thread exited with code ${code}`);
      this.workers = this.workers.filter(w => w !== worker);
      this.freeWorkers = this.freeWorkers.filter(w => w !== worker);
      
      // Replace dead worker
      if (!this.isShuttingDown) {
        this.addNewWorker();
      }
    });
    
    this.workers.push(worker);
    this.freeWorkers.push(worker);
  }
  
  async run(data) {
    return new Promise((resolve, reject) => {
      const worker = this.freeWorkers.pop();
      
      if (worker) {
        worker._currentResolve = resolve;
        worker._currentReject = reject;
        worker.postMessage(data);
      } else {
        this.queue.push({ resolve, reject, data });
      }
    });
  }
  
  process() {
    if (this.queue.length === 0) return;
    
    const worker = this.freeWorkers.pop();
    if (!worker) return;
    
    const { resolve, reject, data } = this.queue.shift();
    worker._currentResolve = resolve;
    worker._currentReject = reject;
    worker.postMessage(data);
  }
  
  async terminate() {
    this.isShuttingDown = true;
    await Promise.all(this.workers.map(worker => worker.terminate()));
  }
}

// Video processing worker pool
let videoWorkerPool;
let embeddingWorkerPool;

// Heavy video processing worker
const heavyVideoWorker = new BullWorker(
  queues.VIDEO_PROCESSING,
  async (job) => {
    if (job.name !== jobTypes.COMPRESS_VIDEO) {
      throw new Error(`Unknown job type: ${job.name}`);
    }
    
    const { processId, inputPath, outputPath, compressionOptions } = job.data;
    
    try {
      logger.info(`🎬 Heavy worker processing video ${job.id}`, { 
        processId,
        workerPid: process.pid
      });
      
      // Delegate to worker thread
      const result = await videoWorkerPool.run({
        type: 'compress',
        inputPath,
        outputPath,
        compressionOptions,
        jobId: job.id
      });
      
      // Update job progress
      await job.updateProgress(100);
      processedJobCount++; // Increment job counter
      
      return result;
      
    } catch (error) {
      logger.error(`Heavy worker video compression failed for job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      db: parseInt(process.env.REDIS_DB) || 0
    },
    concurrency: parseInt(process.env.VIDEO_WORKER_CONCURRENCY) || 2,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 }
  }
);

// Import AI service for processing other AI jobs
const aiService = require('../services/aiService');

// AI Analysis Worker (handles all AI jobs including embeddings)
const aiAnalysisWorker = new BullWorker(
  queues.AI_ANALYSIS,
  async (job) => {
    // Handle embedding jobs with worker threads
    if (job.name === jobTypes.GENERATE_EMBEDDING) {
      const { processId, transcript, title, tags } = job.data;
      
      try {
        logger.info(`🧮 Heavy worker processing embedding ${job.id}`, { 
          processId,
          workerPid: process.pid
        });
        
        // Process in worker thread for better performance
        const result = await embeddingWorkerPool.run({
          type: 'embedding',
          processId,
          transcript,
          title,
          tags,
          options: job.data.options
        });
        
        await job.updateProgress(100);
        processedJobCount++; // Increment job counter
        
        return result;
        
      } catch (error) {
        logger.error(`Heavy worker embedding generation failed for job ${job.id}:`, error);
        throw error;
      }
    }
    
    // Handle other AI jobs (Tags, Title, Todo)
    const { processId, transcript } = job.data;
    
    try {
      logger.info(`🤖 Heavy worker processing AI job ${job.name} ${job.id}`, { 
        processId,
        jobType: job.name,
        workerPid: process.pid
      });
      
      let result;
      
      switch (job.name) {
        case jobTypes.GENERATE_TAGS:
          await job.updateProgress(20);
          result = await aiService.generateTags(transcript, job.data.options);
          break;
          
        case jobTypes.GENERATE_TODO:
          await job.updateProgress(20);
          result = await aiService.generateTodoList(job.data.transcript || transcript, job.data.options);
          break;
          
        case jobTypes.GENERATE_TITLE:
          await job.updateProgress(20);
          result = await aiService.generateTitle(transcript, job.data.options);
          break;
          
        default:
          throw new Error(`Unknown AI analysis job type: ${job.name}`);
      }
      
      await job.updateProgress(100);
      logger.info(`AI analysis job ${job.id} completed`, { processId, jobType: job.name });
      processedJobCount++; // Increment job counter
      
      return result;
      
    } catch (error) {
      logger.error(`Heavy worker AI job ${job.name} failed for job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      db: parseInt(process.env.REDIS_DB) || 0
    },
    concurrency: parseInt(process.env.AI_WORKER_CONCURRENCY) || 3, // Handle all AI jobs
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 }
  }
);

// Import handleJobCompletion
const { handleJobCompletion } = require('../services/queueWorkers');

// Add event handlers for AI Analysis Worker
aiAnalysisWorker.on('completed', async (job, result) => {
  logger.info(`AI Analysis job completed:`, {
    jobId: job.id,
    jobName: job.name,
    processId: job.data.processId,
    duration: job.finishedOn - job.processedOn
  });
  
  try {
    await handleJobCompletion(job, result);
  } catch (error) {
    logger.error(`Error handling AI job completion for ${job.id}:`, error);
  }
});

aiAnalysisWorker.on('failed', (job, error) => {
  logger.error(`AI Analysis job failed:`, {
    jobId: job.id,
    jobName: job.name,
    processId: job.data.processId,
    error: error.message,
    stack: error.stack
  });
});

// Add event handlers for Heavy Video Worker
heavyVideoWorker.on('completed', async (job, result) => {
  logger.info(`Video compression job completed:`, {
    jobId: job.id,
    jobName: job.name,
    processId: job.data.processId,
    duration: job.finishedOn - job.processedOn
  });
  
  try {
    await handleJobCompletion(job, result);
  } catch (error) {
    logger.error(`Error handling video job completion for ${job.id}:`, error);
  }
});

heavyVideoWorker.on('failed', (job, error) => {
  logger.error(`Video compression job failed:`, {
    jobId: job.id,
    jobName: job.name,
    processId: job.data.processId,
    error: error.message,
    stack: error.stack
  });
});

// Initialize heavy worker process
async function initializeHeavyWorker() {
  try {
    logger.info('🏋️ Initializing heavy worker process...', {
      nodeVersion: process.version,
      pid: process.pid,
      workerType: 'heavy',
      threadPoolSize: process.env.UV_THREADPOOL_SIZE || 4
    });
    
    // Connect to databases
    logger.info('🔗 Connecting to MongoDB...');
    await connectDB();
    
    logger.info('🔗 Connecting to Redis...');
    await connectRedis();
    
    // Initialize worker pools
    logger.info('🔧 Creating worker thread pools...');
    videoWorkerPool = new WorkerPool('video-thread-worker.js', 
      parseInt(process.env.VIDEO_THREAD_POOL_SIZE) || 2);
    
    embeddingWorkerPool = new WorkerPool('embedding-thread-worker.js',
      parseInt(process.env.EMBEDDING_THREAD_POOL_SIZE) || 4);
    
    logger.info('✅ Heavy worker process initialized successfully', {
      pid: process.pid,
      videoThreads: videoWorkerPool.poolSize,
      embeddingThreads: embeddingWorkerPool.poolSize
    });
    
    // Send ready signal to PM2
    if (process.send) {
      process.send('ready');
    }
    
  } catch (error) {
    logger.error('❌ Failed to initialize heavy worker process:', error);
    process.exit(1);
  }
}

// Job counter for periodic GC
let processedJobCount = 0;

// Performance monitoring
const performanceMonitor = setInterval(() => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  logger.info('Heavy worker performance metrics', {
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    threads: {
      videoPool: videoWorkerPool ? videoWorkerPool.freeWorkers.length : 0,
      embeddingPool: embeddingWorkerPool ? embeddingWorkerPool.freeWorkers.length : 0
    },
    jobsProcessed: processedJobCount
  });
  
  // Force GC if available and memory is high or after every 10 jobs
  if (global.gc && (memUsage.heapUsed > memUsage.heapTotal * 0.7 || processedJobCount % 10 === 0)) {
    global.gc();
    logger.info('Forced garbage collection in heavy worker', {
      reason: memUsage.heapUsed > memUsage.heapTotal * 0.7 ? 'high_memory' : 'job_count',
      jobsProcessed: processedJobCount
    });
  }
}, 60000); // Every 60 seconds (reduced frequency)

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down heavy worker...`);
  
  clearInterval(performanceMonitor);
  
  try {
    // Close workers
    await Promise.all([
      heavyVideoWorker.close(),
      aiAnalysisWorker.close()
    ]);
    
    // Terminate worker pools
    if (videoWorkerPool) await videoWorkerPool.terminate();
    if (embeddingWorkerPool) await embeddingWorkerPool.terminate();
    
    logger.info('Heavy worker shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during heavy worker shutdown:', error);
    process.exit(1);
  }
}

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in heavy worker:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in heavy worker:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the heavy worker
initializeHeavyWorker();