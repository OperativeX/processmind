const { Worker } = require('bullmq');
const { jobTypes } = require('../config/bullmq');
const s3Service = require('../services/s3Service');
const storageTrackingService = require('../services/storageTrackingService');
const { Process } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');

class S3UploadWorker {
  constructor() {
    // Parse Redis URL if provided, otherwise use defaults
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    let connectionConfig;
    
    if (redisUrl.startsWith('redis://')) {
      const url = new URL(redisUrl);
      connectionConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        db: parseInt(url.pathname.substring(1)) || 0
      };
    } else {
      connectionConfig = {
        host: process.env.REDIS_HOST || (process.env.NODE_ENV === 'production' ? 'redis' : 'localhost'),
        port: parseInt(process.env.REDIS_PORT) || 6379,
        db: parseInt(process.env.REDIS_DB) || 0
      };
    }

    this.worker = new Worker(
      's3-upload',
      this.processJob.bind(this),
      {
        connection: connectionConfig,
        concurrency: 5, // Allow 5 parallel S3 uploads
        maxStalledCount: 3,
        stalledInterval: 30000
      }
    );

    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
    this.worker.on('error', this.onWorkerError.bind(this));

    logger.info('S3 Upload Worker initialized');
  }

  async processJob(job) {
    const { processId, localVideoPath, tenantId, userId } = job.data;

    try {
      logger.info('Starting S3 upload job', {
        jobId: job.id,
        processId,
        localVideoPath
      });

      // Update job progress
      await job.updateProgress(10);

      // Update process progress - starting S3 upload
      const processDoc = await Process.findById(processId);
      if (processDoc) {
        processDoc.processingDetails = 'uploading_to_s3';
        await processDoc.updateProgress(92, 'uploading_to_s3', 'Video wird zu S3 hochgeladen...');
      }

      // Check if local video file exists
      if (!fs.existsSync(localVideoPath)) {
        throw new Error(`Local video file not found: ${localVideoPath}`);
      }

      // Get file stats for tracking
      const fileStats = await fs.promises.stat(localVideoPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);

      // Update job progress
      await job.updateProgress(20);

      // Generate S3 key for processed video
      const s3Key = s3Service.generateS3Key(tenantId, processId, 'video.mp4', 'processed');

      // Upload compressed video to S3
      const uploadResult = await s3Service.uploadFile(localVideoPath, s3Key, {
        originalName: 'video.mp4',
        userId,
        tenantId,
        processId,
        fileType: 'processed_video',
        uploadedAt: new Date().toISOString()
      });

      // Update job progress
      await job.updateProgress(80);

      // Update process progress - upload completed
      if (processDoc) {
        await processDoc.updateProgress(95, 's3_upload_complete', 'S3-Upload abgeschlossen');
      }

      // Use atomic update to avoid race conditions with other workers
      const updateResult = await Process.findByIdAndUpdate(
        processId,
        {
          $set: {
            'files.processed.path': s3Key,
            'files.processed.s3Location': uploadResult.location,
            'files.processed.size': fileStats.size,
            'files.processed.storageType': 's3',
            'files.processed.uploadedAt': new Date(),
            'files.original.storageType': 'local_temp'
          }
        },
        { 
          new: true, // Return updated document
          runValidators: true // Run schema validation
        }
      );

      if (updateResult) {
        logger.info('Process updated with S3 video location (atomic)', {
          processId,
          s3Key,
          s3Location: uploadResult.location,
          storageType: updateResult.files.processed.storageType,
          atomicUpdate: true
        });
      } else {
        logger.error('Atomic S3 update failed - process not found', { processId });
        throw new Error('Failed to update process with S3 information');
      }

      // Track storage usage (only now, after successful S3 upload)
      await storageTrackingService.trackFileUpload(userId, tenantId, fileSizeMB, 'video');

      // Update legacy user storage for Free accounts
      const { User } = require('../models');
      const user = await User.findById(userId);
      if (user && user.accountType === 'free') {
        await user.addStorageUsage(fileSizeMB);
        logger.info('Updated Free account storage usage after S3 upload', {
          userId,
          addedMB: fileSizeMB,
          totalMB: user.usage.storageUsedMB
        });
      }

      // Update job progress
      await job.updateProgress(100);

      // Trigger cleanup job after successful S3 upload
      const { Queue } = require('bullmq');
      const cleanupQueue = new Queue('cleanup', {
        connection: connectionConfig
      });
      
      // Build paths to clean up comprehensively
      const path = require('path');
      const processedDir = path.dirname(localVideoPath);
      
      // Clean up ALL files: processed directory AND original temp file
      const filesToCleanup = [processedDir];
      
      // CRITICAL: Also clean up the original temp file (especially for skipped compression)
      if (updateResult.files?.original?.path) {
        const originalTempPath = updateResult.files.original.path;
        // Convert to absolute path if relative
        const absoluteTempPath = path.isAbsolute(originalTempPath) 
          ? originalTempPath 
          : path.resolve(process.cwd(), originalTempPath);
        filesToCleanup.push(absoluteTempPath);
      }
      
      logger.info('S3 upload successful, scheduling comprehensive cleanup', {
        processId,
        processedDir,
        originalTempPath: updateResult.files?.original?.path,
        totalCleanupPaths: filesToCleanup.length,
        s3Location: uploadResult.location
      });
      
      // Add cleanup job with delay to ensure S3 upload is fully committed
      const cleanupJob = await cleanupQueue.add('local-cleanup', {
        processId,
        filePaths: filesToCleanup
      }, {
        delay: 2000, // 2 second delay
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      logger.info('S3 upload job completed successfully, cleanup job queued', {
        jobId: job.id,
        processId,
        s3Key,
        sizeMB: fileSizeMB,
        cleanupJobId: cleanupJob.id
      });

      // Mark process as fully completed after S3 upload
      const finalProcess = await Process.findById(processId);
      if (finalProcess && finalProcess.status !== 'failed') {
        finalProcess.status = 'completed';
        await finalProcess.updateProgress(100, 'completed', 'Verarbeitung vollständig abgeschlossen');
        await finalProcess.save();
        
        logger.info('Process marked as completed after S3 upload', {
          processId,
          status: finalProcess.status
        });
      }

      return {
        success: true,
        processId,
        s3Key,
        s3Location: uploadResult.location,
        sizeMB: fileSizeMB,
        cleanupJobId: cleanupJob.id
      };

    } catch (error) {
      logger.error('S3 upload job failed', {
        jobId: job.id,
        processId,
        error: error.message,
        stack: error.stack
      });

      // Mark process as failed if S3 upload fails
      try {
        const process = await Process.findById(processId);
        if (process) {
          await process.addError('s3_upload', error.message, {
            localVideoPath,
            stack: error.stack
          });
        }
      } catch (dbError) {
        logger.error('Failed to update process with S3 upload error', dbError);
      }

      throw error;
    }
  }

  async onJobCompleted(job, result) {
    logger.info('S3 upload job completed', {
      jobId: job.id,
      processId: result.processId,
      s3Key: result.s3Key,
      sizeMB: result.sizeMB
    });
  }

  async onJobFailed(job, err) {
    logger.error('S3 upload job failed', {
      jobId: job.id,
      processId: job.data.processId,
      localVideoPath: job.data.localVideoPath,
      error: err.message,
      errorType: err.name,
      stack: err.stack,
      tenantId: job.data.tenantId,
      failedAttempts: job.attemptsMade,
      maxAttempts: job.opts?.attempts || 3,
      s3Endpoint: process.env.S3_ENDPOINT || 'NOT_SET',
      s3Bucket: process.env.S3_BUCKET || 'NOT_SET',
      hasS3AccessKey: !!process.env.S3_ACCESS_KEY,
      hasS3SecretKey: !!process.env.S3_SECRET_KEY
    });
  }

  async onWorkerError(err) {
    logger.error('S3 Upload Worker error:', err);
  }

  async close() {
    await this.worker.close();
    logger.info('S3 Upload Worker closed');
  }
}

module.exports = S3UploadWorker;