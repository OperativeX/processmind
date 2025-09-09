const { Worker } = require('bullmq');
const { queueConnection } = require('../config/redis');
const { jobTypes } = require('../config/bullmq');
const fileService = require('../services/fileService');
const { Process } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class LocalCleanupWorker {
  constructor() {
    this.worker = new Worker(
      'cleanup',
      this.processJob.bind(this),
      {
        ...queueConnection,
        concurrency: 10, // Allow multiple cleanup jobs
        maxStalledCount: 3,
        stalledInterval: 30000
      }
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
    this.worker.on('error', this.onWorkerError.bind(this));

    logger.info('Local Cleanup Worker initialized');
  }

  async processJob(job) {
    // Job name is the type directly in BullMQ
    const jobName = job.name;
    
    logger.info('Processing cleanup job', {
      jobId: job.id,
      jobName: jobName,
      processId: job.data.processId
    });
    
    if (jobName === 'local-cleanup') {
      return this.processLocalCleanupJob(job);
    } else if (jobName === 'cleanup-files') {
      return this.processLegacyCleanupJob(job);
    }
    
    throw new Error(`Unknown cleanup job type: ${jobName}`);
  }

  async processLocalCleanupJob(job) {
    const { processId, filePaths } = job.data;

    try {
      logger.info('Starting local cleanup job', {
        jobId: job.id,
        processId,
        filePaths
      });

      // Update job progress
      await job.updateProgress(10);

      // Update process progress - starting cleanup
      const process = await Process.findById(processId);
      if (!process) {
        throw new Error(`Process not found: ${processId}`);
      }
      
      process.processingDetails = 'cleaning_local_files';
      await process.updateProgress(96, 'cleaning_local_files', 'Lokale Dateien werden gelöscht...');

      // Verify that S3 upload was successful before cleaning up

      // Check if processed video is in S3
      if (process.files?.processed?.storageType !== 's3' || !process.files?.processed?.path) {
        logger.warn('S3 upload not confirmed, skipping cleanup', {
          processId,
          hasProcessedFile: !!process.files?.processed,
          storageType: process.files?.processed?.storageType,
          s3Location: process.files?.processed?.s3Location,
          hasS3Location: !!process.files?.processed?.s3Location
        });
        return { success: false, reason: 's3_upload_not_confirmed' };
      }
      
      logger.info('S3 upload confirmed, proceeding with cleanup', {
        processId,
        storageType: process.files.processed.storageType,
        s3Location: process.files.processed.s3Location
      });

      await job.updateProgress(30);

      // Clean up local files
      const cleanupResults = {
        deleted: [],
        errors: [],
        totalFiles: 0
      };

      logger.info('Starting local cleanup with file paths', {
        processId,
        filePaths,
        filePathCount: filePaths.length
      });

      // Get allowed base paths for validation
      const allowedBasePaths = [
        process.env.UPLOAD_DIR || './uploads/temp',
        process.env.PROCESSED_DIR || './uploads/processed'
      ].map(p => path.resolve(p));

      for (const filePath of filePaths) {
        try {
          if (!filePath) {
            logger.warn('Empty file path in cleanup list', { processId });
            continue;
          }

          // Validate path is safe to delete
          const resolvedPath = path.resolve(filePath);
          const isInAllowedPath = allowedBasePaths.some(basePath => {
            const relative = path.relative(basePath, resolvedPath);
            return !relative.startsWith('..') && !path.isAbsolute(relative);
          });

          if (!isInAllowedPath) {
            logger.error('Attempted to delete file outside allowed directories', {
              path: filePath,
              processId,
              allowedPaths: allowedBasePaths
            });
            cleanupResults.errors.push({
              path: filePath,
              error: 'Path outside allowed directories'
            });
            continue;
          }

          if (fs.existsSync(filePath)) {
            const stats = await fs.promises.stat(filePath);
            
            if (stats.isDirectory()) {
              // Additional validation for directories
              // Only delete if it's a process-specific directory
              const dirName = path.basename(filePath);
              const parentDir = path.basename(path.dirname(filePath));
              
              // Check if this looks like a process directory (UUID format)
              const isProcessDir = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dirName) ||
                                   /^[0-9a-f]{24}$/i.test(dirName) || // MongoDB ObjectId
                                   dirName === 'segments'; // Audio segments directory
              
              if (!isProcessDir && dirName !== processId) {
                logger.warn('Skipping non-process directory', {
                  path: filePath,
                  processId,
                  dirName,
                  parentDir
                });
                cleanupResults.errors.push({
                  path: filePath,
                  error: 'Not a process-specific directory'
                });
                continue;
              }
              
              // Remove directory and all contents recursively
              await fs.promises.rm(filePath, { recursive: true, force: true });
              cleanupResults.deleted.push({ path: filePath, type: 'directory' });
              logger.info('Deleted local directory recursively', { path: filePath, processId });
            } else if (stats.isFile()) {
              // Remove single file
              await fs.promises.unlink(filePath);
              cleanupResults.deleted.push({ path: filePath, type: 'file', size: stats.size });
              logger.info('Deleted local file', { path: filePath, processId, size: stats.size });
            }
            
            cleanupResults.totalFiles++;
          } else {
            logger.warn('File not found during cleanup', { path: filePath, processId });
          }
        } catch (error) {
          logger.error('Error cleaning up local file', {
            path: filePath,
            processId,
            error: error.message
          });
          cleanupResults.errors.push({
            path: filePath,
            error: error.message
          });
        }
      }

      await job.updateProgress(80);

      // Try to clean up empty parent directories
      try {
        const dirsToCheck = new Set();
        cleanupResults.deleted.forEach(item => {
          if (item.path) {
            dirsToCheck.add(path.dirname(item.path));
          }
        });

        for (const dir of dirsToCheck) {
          try {
            // Only try to remove if it's a process-specific directory
            if (dir.includes(processId) || path.basename(dir) === 'segments') {
              const files = await fs.promises.readdir(dir).catch(() => []);
              if (files.length === 0) {
                await fs.promises.rmdir(dir);
                logger.debug('Removed empty directory after cleanup', { dir, processId });
              }
            }
          } catch (err) {
            // Ignore errors when removing directories
          }
        }
      } catch (err) {
        logger.debug('Error cleaning empty directories', { error: err.message });
      }

      // Update process progress - cleanup almost done
      await process.updateProgress(98, 'cleanup_finalizing', 'Aufräumen wird abgeschlossen...');

      // Update process status to mark local files as cleaned up
      if (process) {
        process.files.original.storageType = 'deleted';
        process.metadata.localCleanup = {
          completedAt: new Date(),
          deletedFiles: cleanupResults.deleted.length,
          errors: cleanupResults.errors.length
        };
        await process.save();
      }

      await job.updateProgress(100);

      logger.info('Local cleanup job completed', {
        jobId: job.id,
        processId,
        deletedFiles: cleanupResults.deleted.length,
        errors: cleanupResults.errors.length
      });

      return {
        success: true,
        processId,
        cleaned: cleanupResults.deleted.length,
        errors: cleanupResults.errors.length,
        results: cleanupResults
      };

    } catch (error) {
      logger.error('Local cleanup job failed', {
        jobId: job.id,
        processId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async processLegacyCleanupJob(job) {
    const { processId, filePaths } = job.data;

    try {
      logger.info('Starting legacy cleanup job', {
        jobId: job.id,
        processId,
        filePaths
      });

      const cleanupResult = await fileService.cleanupFiles(filePaths);

      logger.info('Legacy cleanup job completed', {
        jobId: job.id,
        processId,
        ...cleanupResult
      });

      return cleanupResult;

    } catch (error) {
      logger.error('Legacy cleanup job failed', {
        jobId: job.id,
        processId,
        error: error.message
      });
      throw error;
    }
  }

  async onJobCompleted(job, result) {
    logger.info('Cleanup job completed', {
      jobId: job.id,
      jobType: job.name,
      processId: result.processId,
      success: result.success
    });
  }

  async onJobFailed(job, err) {
    logger.error('Cleanup job failed', {
      jobId: job.id,
      jobType: job.name,
      processId: job.data.processId,
      error: err.message,
      attempts: job.attemptsMade
    });
  }

  async onWorkerError(err) {
    logger.error('Local Cleanup Worker error:', err);
  }

  async close() {
    await this.worker.close();
    logger.info('Local Cleanup Worker closed');
  }
}

module.exports = LocalCleanupWorker;