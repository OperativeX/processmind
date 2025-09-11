#!/usr/bin/env node

/**
 * Scheduler Process - Handles scheduled tasks like cleanup, statistics, etc.
 * Runs as a lightweight separate process
 */

require('dotenv').config();
const cron = require('node-cron');
const logger = require('../utils/logger');
const connectDB = require('../config/database');
const { connectRedis } = require('../config/redis');
const fs = require('fs').promises;
const path = require('path');

// Scheduled tasks registry
const scheduledTasks = new Map();

// Initialize scheduler process
async function initializeScheduler() {
  try {
    logger.info('📅 Initializing scheduler process...', {
      nodeVersion: process.version,
      pid: process.pid,
      workerType: 'scheduler'
    });
    
    // Connect to databases
    logger.info('🔗 Connecting to MongoDB...');
    await connectDB();
    
    logger.info('🔗 Connecting to Redis...');
    await connectRedis();
    
    // Register scheduled tasks
    registerScheduledTasks();
    
    logger.info('✅ Scheduler process initialized successfully', {
      pid: process.pid,
      tasksRegistered: scheduledTasks.size
    });
    
    // Send ready signal to PM2
    if (process.send) {
      process.send('ready');
    }
    
  } catch (error) {
    logger.error('❌ Failed to initialize scheduler process:', error);
    process.exit(1);
  }
}

/**
 * Register all scheduled tasks
 */
function registerScheduledTasks() {
  // Cleanup temporary files every hour
  scheduledTasks.set('temp-cleanup', {
    schedule: '0 * * * *', // Every hour
    task: cron.schedule('0 * * * *', cleanupTempFiles, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Clean up temporary upload files older than 24 hours'
  });
  
  // Database statistics update every 30 minutes
  scheduledTasks.set('stats-update', {
    schedule: '*/30 * * * *', // Every 30 minutes
    task: cron.schedule('*/30 * * * *', updateTenantStatistics, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Update tenant usage statistics'
  });
  
  // Orphaned files cleanup daily at 3 AM
  scheduledTasks.set('orphaned-cleanup', {
    schedule: '0 3 * * *', // Daily at 3 AM
    task: cron.schedule('0 3 * * *', cleanupOrphanedFiles, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Clean up orphaned video files'
  });
  
  // Failed process cleanup daily at 4 AM
  scheduledTasks.set('failed-cleanup', {
    schedule: '0 4 * * *', // Daily at 4 AM
    task: cron.schedule('0 4 * * *', cleanupFailedProcesses, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Clean up failed processes older than 7 days'
  });
  
  // Redis memory optimization daily at 2 AM
  scheduledTasks.set('redis-optimization', {
    schedule: '0 2 * * *', // Daily at 2 AM
    task: cron.schedule('0 2 * * *', optimizeRedisMemory, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Optimize Redis memory usage'
  });
  
  // Deep cleanup at midnight - aggressive cleanup of all temporary files
  scheduledTasks.set('midnight-deep-cleanup', {
    schedule: '0 0 * * *', // Daily at midnight
    task: cron.schedule('0 0 * * *', deepCleanupAtMidnight, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Deep cleanup of all temporary and orphaned files at midnight'
  });
  
  // Check for stuck processes every 30 minutes
  scheduledTasks.set('stuck-process-check', {
    schedule: '*/30 * * * *', // Every 30 minutes
    task: cron.schedule('*/30 * * * *', checkStuckProcesses, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    }),
    description: 'Check and fix processes stuck in processing state'
  });
  
  logger.info('Scheduled tasks registered:', {
    tasks: Array.from(scheduledTasks.entries()).map(([name, task]) => ({
      name,
      schedule: task.schedule,
      description: task.description
    }))
  });
}

/**
 * Clean up temporary upload files older than 24 hours
 */
async function cleanupTempFiles() {
  const taskStart = Date.now();
  logger.info('Starting temporary files cleanup...');
  
  try {
    const { Process } = require('../models');
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let filesDeleted = 0;
    let totalSize = 0;
    
    // Scan temp directory
    const tenantDirs = await fs.readdir(tempDir).catch(() => []);
    
    for (const tenantId of tenantDirs) {
      const tenantPath = path.join(tempDir, tenantId);
      const stat = await fs.stat(tenantPath).catch(() => null);
      
      if (!stat || !stat.isDirectory()) continue;
      
      const processDirs = await fs.readdir(tenantPath).catch(() => []);
      
      for (const processId of processDirs) {
        const processPath = path.join(tenantPath, processId);
        const processStat = await fs.stat(processPath).catch(() => null);
        
        if (!processStat || !processStat.isDirectory()) continue;
        
        // Check if directory is old enough
        if (Date.now() - processStat.mtimeMs > maxAge) {
          // Verify process is not active
          const process = await Process.findById(processId).catch(() => null);
          
          if (!process || process.status === 'failed' || process.status === 'completed') {
            // Safe to delete
            const files = await fs.readdir(processPath).catch(() => []);
            
            for (const file of files) {
              const filePath = path.join(processPath, file);
              const fileStat = await fs.stat(filePath).catch(() => null);
              if (fileStat) {
                totalSize += fileStat.size;
                filesDeleted++;
              }
              await fs.unlink(filePath).catch(() => {});
            }
            
            await fs.rmdir(processPath).catch(() => {});
          }
        }
      }
      
      // Try to remove empty tenant directory
      await fs.rmdir(tenantPath).catch(() => {});
    }
    
    logger.info('Temporary files cleanup completed', {
      filesDeleted,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error during temporary files cleanup:', error);
  }
}

/**
 * Update tenant usage statistics
 */
async function updateTenantStatistics() {
  const taskStart = Date.now();
  logger.info('Starting tenant statistics update...');
  
  try {
    const { Tenant, Process, User } = require('../models');
    
    const tenants = await Tenant.find({ isActive: true }).lean();
    let updatedCount = 0;
    
    for (const tenant of tenants) {
      try {
        // Calculate storage usage
        const processes = await Process.find({ 
          tenantId: tenant._id, 
          isDeleted: false 
        }).select('files.processed.size files.processed.storageType').lean();
        
        const storageUsage = processes.reduce((total, process) => {
          if (process.files?.processed?.size) {
            return total + process.files.processed.size;
          }
          return total;
        }, 0);
        
        // Count users
        const userCount = await User.countDocuments({ 
          tenantId: tenant._id,
          isDeleted: false 
        });
        
        // Update tenant statistics
        await Tenant.findByIdAndUpdate(tenant._id, {
          'usage.storage': storageUsage,
          'usage.processes': processes.length,
          'usage.users': userCount,
          'usage.lastUpdated': new Date()
        });
        
        updatedCount++;
      } catch (error) {
        logger.error(`Failed to update statistics for tenant ${tenant._id}:`, error);
      }
    }
    
    logger.info('Tenant statistics update completed', {
      tenantsUpdated: updatedCount,
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error during tenant statistics update:', error);
  }
}

/**
 * Clean up orphaned video files
 */
async function cleanupOrphanedFiles() {
  const taskStart = Date.now();
  logger.info('Starting orphaned files cleanup...');
  
  try {
    const { Process } = require('../models');
    const processedDir = path.join(process.cwd(), 'uploads', 'processed');
    
    let orphanedFiles = 0;
    let totalSize = 0;
    
    // Get all valid process IDs
    const validProcessIds = await Process.find({ isDeleted: false })
      .select('_id')
      .lean()
      .then(processes => new Set(processes.map(p => p._id.toString())));
    
    // Scan processed directory
    const files = await fs.readdir(processedDir).catch(() => []);
    
    for (const file of files) {
      const filePath = path.join(processedDir, file);
      const stat = await fs.stat(filePath).catch(() => null);
      
      if (!stat || !stat.isFile()) continue;
      
      // Extract process ID from filename (assuming format: processId_timestamp_uuid.ext)
      const processIdMatch = file.match(/^([a-f0-9]{24})_/);
      
      if (processIdMatch) {
        const processId = processIdMatch[1];
        
        if (!validProcessIds.has(processId)) {
          // Orphaned file - delete it
          totalSize += stat.size;
          orphanedFiles++;
          await fs.unlink(filePath).catch(err => {
            logger.error(`Failed to delete orphaned file ${file}:`, err);
          });
        }
      }
    }
    
    logger.info('Orphaned files cleanup completed', {
      orphanedFiles,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error during orphaned files cleanup:', error);
  }
}

/**
 * Clean up failed processes older than 7 days
 */
async function cleanupFailedProcesses() {
  const taskStart = Date.now();
  logger.info('Starting failed processes cleanup...');
  
  try {
    const { Process } = require('../models');
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const result = await Process.updateMany(
      {
        status: 'failed',
        createdAt: { $lt: cutoffDate },
        isDeleted: false
      },
      {
        isDeleted: true,
        deletedAt: new Date()
      }
    );
    
    logger.info('Failed processes cleanup completed', {
      processesMarkedDeleted: result.modifiedCount,
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error during failed processes cleanup:', error);
  }
}

/**
 * Optimize Redis memory usage
 */
async function optimizeRedisMemory() {
  const taskStart = Date.now();
  logger.info('Starting Redis memory optimization...');
  
  try {
    const { getRedisClient } = require('../config/redis');
    const redis = getRedisClient();
    
    if (!redis) {
      logger.warn('Redis client not available for optimization');
      return;
    }
    
    // Get memory info before optimization
    const infoBefore = await redis.info('memory');
    const usedMemoryBefore = parseInt(infoBefore.match(/used_memory:(\d+)/)[1]);
    
    // Clear expired similarity cache entries
    const similarityKeys = await redis.keys('similarity:*');
    let expiredKeys = 0;
    
    for (const key of similarityKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) { // No expiration set
        // Set expiration to 7 days
        await redis.expire(key, 7 * 24 * 60 * 60);
        expiredKeys++;
      }
    }
    
    // Run memory defragmentation if available
    try {
      await redis.call('MEMORY', 'PURGE');
    } catch (err) {
      // Memory purge might not be available in all Redis versions
    }
    
    // Get memory info after optimization
    const infoAfter = await redis.info('memory');
    const usedMemoryAfter = parseInt(infoAfter.match(/used_memory:(\d+)/)[1]);
    
    const memorySaved = usedMemoryBefore - usedMemoryAfter;
    
    logger.info('Redis memory optimization completed', {
      memorySavedMB: (memorySaved / 1024 / 1024).toFixed(2),
      expiredKeysFixed: expiredKeys,
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error during Redis memory optimization:', error);
  }
}

/**
 * Deep cleanup at midnight - aggressive cleanup of temporary and orphaned files
 */
async function deepCleanupAtMidnight() {
  const taskStart = Date.now();
  logger.info('🌙 Starting midnight deep cleanup...');
  
  // Configuration
  const maxAgeHours = parseInt(process.env.DEEP_CLEANUP_MAX_AGE_HOURS) || 12;
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  
  const stats = {
    tempFilesDeleted: 0,
    tempSizeFreed: 0,
    processedFilesDeleted: 0,
    processedSizeFreed: 0,
    directoriesRemoved: 0,
    errors: []
  };
  
  try {
    const { Process } = require('../models');
    
    // 1. Clean up temp directory (more aggressive - 12 hours)
    logger.info(`Cleaning temp files older than ${maxAgeHours} hours...`);
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    await cleanupDirectory(tempDir, maxAge, Process, stats, 'temp');
    
    // 2. Clean up processed directory (orphaned files)
    logger.info('Cleaning orphaned processed files...');
    const processedDir = path.join(process.cwd(), 'uploads', 'processed');
    await cleanupDirectory(processedDir, maxAge, Process, stats, 'processed');
    
    // 3. Clean up stalled processes
    logger.info('Cleaning stalled processes...');
    await cleanupStalledProcesses(maxAge, stats);
    
    // 4. Remove empty directories recursively
    logger.info('Removing empty directories...');
    await removeEmptyDirectories(tempDir, stats);
    await removeEmptyDirectories(processedDir, stats);
    
    // Report results
    const totalFilesDeleted = stats.tempFilesDeleted + stats.processedFilesDeleted;
    const totalSizeFreed = stats.tempSizeFreed + stats.processedSizeFreed;
    
    logger.info('🌙 Midnight deep cleanup completed', {
      totalFilesDeleted,
      totalSizeFreedMB: (totalSizeFreed / 1024 / 1024).toFixed(2),
      tempFilesDeleted: stats.tempFilesDeleted,
      tempSizeFreedMB: (stats.tempSizeFreed / 1024 / 1024).toFixed(2),
      processedFilesDeleted: stats.processedFilesDeleted,
      processedSizeFreedMB: (stats.processedSizeFreed / 1024 / 1024).toFixed(2),
      directoriesRemoved: stats.directoriesRemoved,
      errors: stats.errors.length,
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Fatal error during midnight deep cleanup:', error);
  }
}

/**
 * Helper function to clean up a directory
 */
async function cleanupDirectory(dirPath, maxAge, Process, stats, type) {
  try {
    const tenantDirs = await fs.readdir(dirPath).catch(() => []);
    
    for (const tenantId of tenantDirs) {
      const tenantPath = path.join(dirPath, tenantId);
      const stat = await fs.stat(tenantPath).catch(() => null);
      
      if (!stat || !stat.isDirectory()) continue;
      
      const processDirs = await fs.readdir(tenantPath).catch(() => []);
      
      for (const processId of processDirs) {
        const processPath = path.join(tenantPath, processId);
        const processStat = await fs.stat(processPath).catch(() => null);
        
        if (!processStat || !processStat.isDirectory()) continue;
        
        try {
          // Check if directory is old enough
          const age = Date.now() - processStat.mtimeMs;
          if (age > maxAge) {
            // Verify process status in database
            const process = await Process.findById(processId).catch(() => null);
            
            // Safe to delete if:
            // - No process found in DB
            // - Process is failed or completed
            // - Process is stuck in processing for too long
            const canDelete = !process || 
                            process.status === 'failed' || 
                            process.status === 'completed' ||
                            (process.status === 'processing_media' && age > maxAge * 2); // Double age for stuck processes
            
            if (canDelete) {
              // Calculate size and delete files
              const { filesDeleted, totalSize } = await deleteDirectoryContents(processPath);
              
              if (type === 'temp') {
                stats.tempFilesDeleted += filesDeleted;
                stats.tempSizeFreed += totalSize;
              } else {
                stats.processedFilesDeleted += filesDeleted;
                stats.processedSizeFreed += totalSize;
              }
              
              // Remove the directory itself
              await fs.rmdir(processPath).catch(() => {});
              stats.directoriesRemoved++;
              
              logger.debug(`Cleaned up ${type} directory`, {
                processId,
                age: Math.round(age / 1000 / 60 / 60) + 'h',
                filesDeleted,
                sizeMB: (totalSize / 1024 / 1024).toFixed(2)
              });
            }
          }
        } catch (err) {
          stats.errors.push({ path: processPath, error: err.message });
        }
      }
    }
  } catch (error) {
    logger.error(`Error cleaning ${type} directory:`, error);
    stats.errors.push({ path: dirPath, error: error.message });
  }
}

/**
 * Delete directory contents and return stats
 */
async function deleteDirectoryContents(dirPath) {
  let filesDeleted = 0;
  let totalSize = 0;
  
  const items = await fs.readdir(dirPath).catch(() => []);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = await fs.stat(itemPath).catch(() => null);
    
    if (stat) {
      if (stat.isDirectory()) {
        // Recursively delete subdirectory
        const subStats = await deleteDirectoryContents(itemPath);
        filesDeleted += subStats.filesDeleted;
        totalSize += subStats.totalSize;
        await fs.rmdir(itemPath).catch(() => {});
      } else {
        // Delete file
        totalSize += stat.size;
        filesDeleted++;
        await fs.unlink(itemPath).catch(() => {});
      }
    }
  }
  
  return { filesDeleted, totalSize };
}

/**
 * Clean up stalled processes
 */
async function cleanupStalledProcesses(maxAge, stats) {
  try {
    const { Process } = require('../models');
    
    // Find stalled processes
    const stalledProcesses = await Process.find({
      status: { $in: ['processing_media', 'transcribing', 'analyzing'] },
      updatedAt: { $lt: new Date(Date.now() - maxAge) }
    }).lean();
    
    logger.info(`Found ${stalledProcesses.length} potentially stalled processes`);
    
    for (const process of stalledProcesses) {
      // Mark as failed
      await Process.findByIdAndUpdate(process._id, {
        status: 'failed',
        errors: [
          ...process.errors || [],
          {
            stage: 'midnight_cleanup',
            error: 'Process stalled for too long',
            timestamp: new Date()
          }
        ]
      });
      
      logger.info(`Marked stalled process as failed`, {
        processId: process._id,
        lastUpdate: process.updatedAt,
        status: process.status
      });
    }
  } catch (error) {
    logger.error('Error cleaning stalled processes:', error);
    stats.errors.push({ type: 'stalled_processes', error: error.message });
  }
}

/**
 * Check for stuck processes and mark them as failed
 */
async function checkStuckProcesses() {
  const taskStart = Date.now();
  logger.info('Checking for stuck processes...');
  
  try {
    const { Process } = require('../models');
    const maxProcessingTime = parseInt(process.env.MAX_PROCESSING_TIME_MINUTES) || 30; // Default 30 minutes
    const cutoffTime = new Date(Date.now() - maxProcessingTime * 60 * 1000);
    
    // Find processes that have been stuck for too long
    const stuckProcesses = await Process.find({
      status: { $in: ['uploading', 'processing_media', 'transcribing', 'analyzing', 'finalizing'] },
      updatedAt: { $lt: cutoffTime },
      isDeleted: false
    });
    
    logger.info(`Found ${stuckProcesses.length} stuck processes`);
    
    for (const process of stuckProcesses) {
      // Calculate how long it's been stuck
      const stuckMinutes = Math.round((Date.now() - process.updatedAt.getTime()) / 1000 / 60);
      
      // Add error to processing errors
      process.processingErrors.push({
        step: process.progress?.currentStep || 'unknown',
        message: `Process stuck for ${stuckMinutes} minutes - marking as failed`,
        details: {
          lastStatus: process.status,
          lastProgress: process.progress?.percentage,
          lastStep: process.progress?.currentStep,
          stuckDuration: `${stuckMinutes} minutes`
        },
        timestamp: new Date()
      });
      
      // Mark as failed
      process.status = 'failed';
      process.progress = {
        percentage: process.progress?.percentage || 0,
        currentStep: 'failed',
        stepDetails: `Process timed out after ${stuckMinutes} minutes`,
        estimatedTimeRemaining: 0
      };
      
      await process.save();
      
      logger.warn(`Marked stuck process as failed`, {
        processId: process._id,
        tenantId: process.tenantId,
        originalStatus: process.status,
        stuckMinutes,
        lastUpdate: process.updatedAt
      });
    }
    
    logger.info('Stuck process check completed', {
      processesChecked: stuckProcesses.length,
      duration: Date.now() - taskStart
    });
    
  } catch (error) {
    logger.error('Error checking stuck processes:', error);
  }
}

/**
 * Remove empty directories recursively
 */
async function removeEmptyDirectories(dirPath, stats) {
  try {
    const items = await fs.readdir(dirPath).catch(() => []);
    
    if (items.length === 0) {
      // Directory is empty, remove it
      await fs.rmdir(dirPath).catch(() => {});
      stats.directoriesRemoved++;
      return true;
    }
    
    // Check subdirectories
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath).catch(() => null);
      
      if (stat && stat.isDirectory()) {
        await removeEmptyDirectories(itemPath, stats);
      }
    }
    
    // Check again if directory is now empty
    const remainingItems = await fs.readdir(dirPath).catch(() => []);
    if (remainingItems.length === 0) {
      await fs.rmdir(dirPath).catch(() => {});
      stats.directoriesRemoved++;
    }
  } catch (error) {
    // Ignore errors for this operation
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down scheduler...`);
  
  try {
    // Stop all scheduled tasks
    for (const [name, task] of scheduledTasks.entries()) {
      task.task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    
    logger.info('Scheduler shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during scheduler shutdown:', error);
    process.exit(1);
  }
}

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in scheduler:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the scheduler
initializeScheduler();

// Export functions for testing
module.exports = {
  initializeScheduler,
  deepCleanupAtMidnight,
  cleanupTempFiles,
  cleanupOrphanedFiles,
  cleanupFailedProcesses
};