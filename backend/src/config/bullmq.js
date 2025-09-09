const { Queue, Worker } = require('bullmq');
const { getRedisClient } = require('./redis');
const logger = require('../utils/logger');

// Queue configuration
const defaultJobOptions = {
  removeOnComplete: 10,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  }
};

// BullMQ connection configuration - uses ioredis format
const queueConnection = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    db: parseInt(process.env.REDIS_DB) || 0,
  }
};

// Define queues
const queues = {
  VIDEO_PROCESSING: 'video-processing',
  AUDIO_EXTRACTION: 'audio-extraction',
  TRANSCRIPTION: 'transcription',
  AI_ANALYSIS: 'ai-analysis',
  S3_UPLOAD: 's3-upload',
  CLEANUP: 'cleanup'
};

// Create queue instances
const videoProcessingQueue = new Queue(queues.VIDEO_PROCESSING, queueConnection);
const audioExtractionQueue = new Queue(queues.AUDIO_EXTRACTION, queueConnection);
const transcriptionQueue = new Queue(queues.TRANSCRIPTION, queueConnection);
const aiAnalysisQueue = new Queue(queues.AI_ANALYSIS, queueConnection);
const s3UploadQueue = new Queue(queues.S3_UPLOAD, queueConnection);
const cleanupQueue = new Queue(queues.CLEANUP, queueConnection);

// Note: QueueScheduler is no longer needed in BullMQ v2+
// The queue workers handle delayed and repeated jobs automatically

// Job types
const jobTypes = {
  COMPRESS_VIDEO: 'compress-video',
  EXTRACT_AUDIO: 'extract-audio',
  SEGMENT_AUDIO: 'segment-audio',
  TRANSCRIBE_SEGMENT: 'transcribe-segment',
  MERGE_TRANSCRIPTS: 'merge-transcripts',
  GENERATE_TAGS: 'generate-tags',
  GENERATE_TODO: 'generate-todo',
  GENERATE_TITLE: 'generate-title',
  GENERATE_EMBEDDING: 'generate-embedding',
  S3_UPLOAD_VIDEO: 's3-upload-video',
  LOCAL_CLEANUP: 'local-cleanup',
  CLEANUP_FILES: 'cleanup-files'
};

// Queue methods
const queueMethods = {
  // Video processing jobs
  async addVideoCompressionJob(processId, inputPath, outputPath, options = {}) {
    const jobData = {
      processId,
      inputPath,
      outputPath,
      compressionOptions: {
        codec: 'libx264',
        crf: 23,
        preset: 'fast',
        ...options
      }
    };

    const job = await videoProcessingQueue.add(
      jobTypes.COMPRESS_VIDEO,
      jobData,
      {
        ...defaultJobOptions,
        priority: 1,
        delay: 0
      }
    );

    logger.info(`Video compression job added: ${job.id}`, { processId });
    return job;
  },

  // Audio extraction jobs
  async addAudioExtractionJob(processId, videoPath, audioPath) {
    const jobData = {
      processId,
      videoPath,
      audioPath,
      options: {
        codec: 'pcm_s16le',
        sampleRate: 16000,
        channels: 1
      }
    };

    const job = await audioExtractionQueue.add(
      jobTypes.EXTRACT_AUDIO,
      jobData,
      {
        ...defaultJobOptions,
        priority: 2
      }
    );

    logger.info(`Audio extraction job added: ${job.id}`, { processId });
    return job;
  },

  async addAudioSegmentationJob(processId, audioPath, outputDir, segmentDuration = 600) {
    const jobData = {
      processId,
      audioPath,
      outputDir,
      segmentDuration // 10 minutes in seconds
    };

    const job = await audioExtractionQueue.add(
      jobTypes.SEGMENT_AUDIO,
      jobData,
      {
        ...defaultJobOptions,
        priority: 3
      }
    );

    logger.info(`Audio segmentation job added: ${job.id}`, { processId });
    return job;
  },

  // Transcription jobs
  async addTranscriptionJob(processId, audioPath, segmentIndex, startTime) {
    const jobData = {
      processId,
      audioPath,
      segmentIndex,
      startTime,
      options: {
        model: 'whisper-1',
        responseFormat: 'verbose_json',
        timestampGranularities: ['segment']
      }
    };

    const job = await transcriptionQueue.add(
      jobTypes.TRANSCRIBE_SEGMENT,
      jobData,
      {
        ...defaultJobOptions,
        priority: 4,
        delay: segmentIndex * 1000 // Stagger jobs to avoid rate limits
      }
    );

    logger.info(`Transcription job added: ${job.id}`, { processId, segmentIndex });
    return job;
  },

  async addTranscriptMergeJob(processId, transcriptSegments) {
    const jobData = {
      processId,
      transcriptSegments
    };

    const job = await transcriptionQueue.add(
      jobTypes.MERGE_TRANSCRIPTS,
      jobData,
      {
        ...defaultJobOptions,
        priority: 5
      }
    );

    logger.info(`Transcript merge job added: ${job.id}`, { processId });
    return job;
  },

  // AI analysis jobs
  async addTagGenerationJob(processId, transcript) {
    const jobData = {
      processId,
      transcript,
      options: {
        model: 'gpt-3.5-turbo',
        maxTags: 10
      }
    };

    const job = await aiAnalysisQueue.add(
      jobTypes.GENERATE_TAGS,
      jobData,
      {
        ...defaultJobOptions,
        priority: 6
      }
    );

    logger.info(`Tag generation job added: ${job.id}`, { processId });
    return job;
  },

  async addTodoGenerationJob(processId, transcript) {
    const jobData = {
      processId,
      transcript,
      options: {
        model: 'gpt-3.5-turbo',
        maxItems: 20
      }
    };

    const job = await aiAnalysisQueue.add(
      jobTypes.GENERATE_TODO,
      jobData,
      {
        ...defaultJobOptions,
        priority: 7
      }
    );

    logger.info(`Todo generation job added: ${job.id}`, { processId });
    return job;
  },

  async addTitleGenerationJob(processId, transcript) {
    const jobData = {
      processId,
      transcript,
      options: {
        model: 'gpt-3.5-turbo',
        maxLength: 100
      }
    };

    const job = await aiAnalysisQueue.add(
      jobTypes.GENERATE_TITLE,
      jobData,
      {
        ...defaultJobOptions,
        priority: 8
      }
    );

    logger.info(`Title generation job added: ${job.id}`, { processId });
    return job;
  },

  async addEmbeddingGenerationJob(processId, transcript, additionalData = {}) {
    const jobData = {
      processId,
      transcript,
      // Include title and tags if provided
      title: additionalData.title || null,
      tags: additionalData.tags || null,
      options: {
        model: 'text-embedding-ada-002'
      }
    };

    const job = await aiAnalysisQueue.add(
      jobTypes.GENERATE_EMBEDDING,
      jobData,
      {
        ...defaultJobOptions,
        priority: 8
      }
    );

    logger.info(`Embedding generation job added: ${job.id}`, { 
      processId,
      hasTitle: !!additionalData.title,
      tagsCount: additionalData.tags?.length || 0
    });
    return job;
  },

  // S3 Upload jobs
  async addS3UploadJob(processId, localVideoPath, tenantId, userId) {
    const jobData = {
      processId,
      localVideoPath,
      tenantId,
      userId
    };

    const job = await s3UploadQueue.add(
      jobTypes.S3_UPLOAD_VIDEO,
      jobData,
      {
        ...defaultJobOptions,
        priority: 5 // After video compression
      }
    );

    logger.info(`S3 upload job added: ${job.id}`, { processId });
    return job;
  },

  // Local cleanup jobs
  async addLocalCleanupJob(processId, filePaths, delay = 30000) {
    const jobData = {
      processId,
      filePaths: Array.isArray(filePaths) ? filePaths : [filePaths]
    };

    const job = await cleanupQueue.add(
      jobTypes.LOCAL_CLEANUP,
      jobData,
      {
        ...defaultJobOptions,
        delay, // Wait for S3 upload to complete
        priority: 10
      }
    );

    logger.info(`Local cleanup job added: ${job.id}`, { processId, delay });
    return job;
  },

  // Legacy cleanup jobs
  async addCleanupJob(processId, filePaths, delay = 60000) {
    const jobData = {
      processId,
      filePaths: Array.isArray(filePaths) ? filePaths : [filePaths]
    };

    const job = await cleanupQueue.add(
      jobTypes.CLEANUP_FILES,
      jobData,
      {
        ...defaultJobOptions,
        delay, // Delay cleanup to ensure all processing is complete
        priority: 10
      }
    );

    logger.info(`Cleanup job added: ${job.id}`, { processId, delay });
    return job;
  },

  // Helper methods
  async getJobStatus(jobId, queueName) {
    let queue;
    switch (queueName) {
      case queues.VIDEO_PROCESSING:
        queue = videoProcessingQueue;
        break;
      case queues.AUDIO_EXTRACTION:
        queue = audioExtractionQueue;
        break;
      case queues.TRANSCRIPTION:
        queue = transcriptionQueue;
        break;
      case queues.AI_ANALYSIS:
        queue = aiAnalysisQueue;
        break;
      case queues.CLEANUP:
        queue = cleanupQueue;
        break;
      case queues.S3_UPLOAD:
        queue = s3UploadQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp
    };
  },

  async removeJob(jobId, queueName) {
    const job = await this.getJobStatus(jobId, queueName);
    if (job) {
      await job.remove();
      logger.info(`Job removed: ${jobId} from ${queueName}`);
    }
  },

  // Get queue statistics
  async getQueueStats() {
    const stats = {};
    const queueInstances = [
      { name: queues.VIDEO_PROCESSING, instance: videoProcessingQueue },
      { name: queues.AUDIO_EXTRACTION, instance: audioExtractionQueue },
      { name: queues.TRANSCRIPTION, instance: transcriptionQueue },
      { name: queues.AI_ANALYSIS, instance: aiAnalysisQueue },
      { name: queues.S3_UPLOAD, instance: s3UploadQueue },
      { name: queues.CLEANUP, instance: cleanupQueue }
    ];

    for (const { name, instance } of queueInstances) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          instance.getWaiting(),
          instance.getActive(),
          instance.getCompleted(),
          instance.getFailed(),
          instance.getDelayed()
        ]);

        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length
        };
      } catch (error) {
        logger.error(`Error getting stats for queue ${name}:`, error);
        stats[name] = { error: error.message };
      }
    }

    return stats;
  }
};

// Export everything
module.exports = {
  queues,
  jobTypes,
  queueMethods,
  videoProcessingQueue,
  audioExtractionQueue,
  transcriptionQueue,
  aiAnalysisQueue,
  s3UploadQueue,
  cleanupQueue,
  
  // Queue instances for worker setup
  queueInstances: {
    [queues.VIDEO_PROCESSING]: videoProcessingQueue,
    [queues.AUDIO_EXTRACTION]: audioExtractionQueue,
    [queues.TRANSCRIPTION]: transcriptionQueue,
    [queues.AI_ANALYSIS]: aiAnalysisQueue,
    [queues.S3_UPLOAD]: s3UploadQueue,
    [queues.CLEANUP]: cleanupQueue
  }
};