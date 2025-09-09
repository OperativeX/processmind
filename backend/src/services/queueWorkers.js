const { Worker } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const { queues, jobTypes } = require('../config/bullmq');
const logger = require('../utils/logger');

// Import service modules
const videoService = require('./videoService');
const audioService = require('./audioService');
const transcriptionService = require('./transcriptionService');
const aiService = require('./aiService');
const fileService = require('./fileService');

// Import worker classes
const S3UploadWorker = require('../workers/s3UploadWorker');
const LocalCleanupWorker = require('../workers/localCleanupWorker');

// Import models
const { Process } = require('../models');

// Worker configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const workerConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    db: parseInt(process.env.REDIS_DB) || 0
  },
  concurrency: isDevelopment ? 1 : 3, // Single job in dev, 3 in production
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 50 }
};

// Add worker lifecycle logging
logger.info('🚀 Initializing queue workers...', {
  environment: process.env.NODE_ENV,
  concurrency: workerConfig.concurrency,
  redis: `${workerConfig.connection.host}:${workerConfig.connection.port}`
});

// Video Processing Worker
const videoWorker = new Worker(
  queues.VIDEO_PROCESSING,
  async (job) => {
    const { processId, inputPath, outputPath, compressionOptions } = job.data;
    
    try {
      logger.info(`🎬 Starting video compression job ${job.id}`, { 
        processId,
        inputPath,
        targetCodec: compressionOptions?.codec || 'h265'
      });
      
      // Update job progress
      await job.updateProgress(10);
      
      // Find process to update progress
      const processDoc = await Process.findById(processId);
      
      // Set initial status - video compression started (after audio)
      if (processDoc) {
        await processDoc.updateProgress(15, 'processing_media', 'Video wird komprimiert...');
        processDoc.status = 'processing_media';
        processDoc.processingDetails = 'video_compressing';
        await processDoc.save();
      }
      
      const result = await videoService.compressVideo(
        inputPath,
        outputPath,
        compressionOptions,
        (progress) => {
          // Only update job progress, not process progress
          job.updateProgress(10 + (progress * 0.8)); // 10-90%
        }
      );
      
      await job.updateProgress(100);
      
      logger.info(`Video compression completed for job ${job.id}`, { 
        processId, 
        outputSize: result.compressedSize || result.size,
        duration: result.processingTime,
        skippedCompression: result.skippedCompression || false,
        compressionRatio: result.compressionRatio
      });
      
      return result;
      
    } catch (error) {
      logger.error(`Video compression failed for job ${job.id}:`, error);
      throw error;
    }
  },
  {
    ...workerConfig,
    concurrency: 2 // Limit video processing to 2 concurrent jobs
  }
);

// Audio Extraction Worker
const audioWorker = new Worker(
  queues.AUDIO_EXTRACTION,
  async (job) => {
    const { processId } = job.data;
    
    try {
      logger.info(`Starting audio job ${job.id}`, { processId });
      
      let result;
      
      switch (job.name) {
        case jobTypes.EXTRACT_AUDIO:
          // Update process status to processing_media
          const processDoc = await Process.findById(processId);
          if (processDoc) {
            processDoc.status = 'processing_media';
            processDoc.processingDetails = 'extracting_audio';
            // Audio extraction starts immediately (5%)
            await processDoc.updateProgress(5, 'processing_media', 'Audio-Spur wird extrahiert...');
            await processDoc.save();
          }
          
          await job.updateProgress(10);
          
          result = await audioService.extractAudio(
            job.data.videoPath,
            job.data.audioPath,
            job.data.options,
            (progress) => {
              // Map audio extraction progress to 5-20% range
              const mappedProgress = 5 + (progress * 0.15);
              job.updateProgress(10 + (progress * 0.8));
              
              // Don't update progress during extraction to keep UI clean
            }
          );
          
          await job.updateProgress(100);
          break;
          
        case jobTypes.SEGMENT_AUDIO:
          result = await audioService.segmentAudio(
            job.data.audioPath,
            job.data.outputDir,
            job.data.segmentDuration,
            (progress) => job.updateProgress(progress)
          );
          break;
          
        default:
          throw new Error(`Unknown audio job type: ${job.name}`);
      }
      
      await job.updateProgress(100);
      logger.info(`Audio job ${job.id} completed`, { processId, result });
      
      return result;
      
    } catch (error) {
      logger.error(`Audio job ${job.id} failed:`, error);
      throw error;
    }
  },
  workerConfig
);

// Transcription Worker
const transcriptionWorker = new Worker(
  queues.TRANSCRIPTION,
  async (job) => {
    const { processId } = job.data;
    
    try {
      logger.info(`Starting transcription job ${job.id}`, { processId });
      
      let result;
      
      switch (job.name) {
        case jobTypes.TRANSCRIBE_SEGMENT:
          await job.updateProgress(10);
          
          result = await transcriptionService.transcribeAudioSegment(
            job.data.audioPath,
            job.data.segmentIndex,
            job.data.startTime,
            job.data.options
          );
          
          break;
          
        case jobTypes.MERGE_TRANSCRIPTS:
          await job.updateProgress(20);
          
          result = await transcriptionService.mergeTranscriptSegments(
            job.data.transcriptSegments
          );
          
          break;
          
        default:
          throw new Error(`Unknown transcription job type: ${job.name}`);
      }
      
      await job.updateProgress(100);
      logger.info(`Transcription job ${job.id} completed`, { processId });
      
      return result;
      
    } catch (error) {
      logger.error(`Transcription job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    ...workerConfig,
    concurrency: 5 // Allow more concurrent transcription jobs
  }
);

// AI Analysis Worker
const aiWorker = new Worker(
  queues.AI_ANALYSIS,
  async (job) => {
    const { processId, transcript } = job.data;
    
    try {
      logger.info(`Starting AI analysis job ${job.id}`, { processId });
      
      let result;
      
      switch (job.name) {
        case jobTypes.GENERATE_TAGS:
          await job.updateProgress(20);
          
          // Update processing details
          const tagProcess = await Process.findById(processId);
          if (tagProcess) {
            tagProcess.processingDetails = 'generating_tags';
            await tagProcess.save();
          }
          
          try {
            result = await aiService.generateTags(transcript, job.data.options);
          } catch (aiError) {
            logger.warn(`AI tag generation failed, using fallback: ${aiError.message}`);
            // Fallback: Generate basic tags with weights
            result = { 
              tags: [
                { name: 'video', weight: 0.5 },
                { name: 'uploaded', weight: 0.5 },
                { name: 'content', weight: 0.5 }
              ]
            };
          }
          break;
          
        case jobTypes.GENERATE_TODO:
          await job.updateProgress(20);
          
          // Update processing details
          const todoProcess = await Process.findById(processId);
          if (todoProcess) {
            todoProcess.processingDetails = 'generating_todos';
            await todoProcess.save();
          }
          
          try {
            // Get process document to get video duration
            const process = await Process.findById(processId);
            const videoDuration = process?.files?.original?.duration || null;
            
            result = await aiService.generateTodoList(transcript, {
              ...job.data.options,
              videoDuration
            });
          } catch (aiError) {
            logger.warn(`AI todo generation failed, using fallback: ${aiError.message}`);
            // Fallback: Generate basic todos
            result = { 
              todoList: [
                { task: 'Review video content', timestamp: 0, completed: false },
                { task: 'Add detailed description', timestamp: 30, completed: false }
              ]
            };
          }
          break;
          
        case jobTypes.GENERATE_TITLE:
          await job.updateProgress(20);
          
          // Update processing details
          const titleProcess = await Process.findById(processId);
          if (titleProcess) {
            titleProcess.processingDetails = 'generating_title';
            await titleProcess.save();
          }
          
          try {
            result = await aiService.generateTitle(transcript, job.data.options);
          } catch (aiError) {
            logger.warn(`AI title generation failed, using fallback: ${aiError.message}`);
            // Fallback: Generate simple title from filename or content
            const process = await require('../models/Process').findById(processId);
            const filename = process?.originalFilename || 'Video';
            const baseName = filename.replace(/\.[^/.]+$/, '');
            result = { title: `Video: ${baseName}` };
          }
          break;
          
        case jobTypes.GENERATE_EMBEDDING:
          await job.updateProgress(20);
          
          // Update process status to show embedding generation
          const embeddingProcess = await Process.findById(processId);
          if (embeddingProcess) {
            embeddingProcess.processingDetails = 'generating_embeddings';
            await embeddingProcess.save();
          }
          
          try {
            // Check if we have title and tags data
            if (job.data.title && job.data.tags) {
              // New method: Generate from title and tags
              result = await aiService.generateEmbeddingFromTitleAndTags(
                job.data.title,
                job.data.tags,
                job.data.options
              );
            } else {
              // Fallback to transcript-based generation
              logger.info('Using transcript-based embedding generation (fallback)');
              result = await aiService.generateEmbedding(transcript, job.data.options);
            }
          } catch (aiError) {
            logger.warn(`Embedding generation failed: ${aiError.message}`);
            // No fallback for embeddings - just return empty result
            result = { embedding: null };
          }
          break;
          
        default:
          throw new Error(`Unknown AI analysis job type: ${job.name}`);
      }
      
      await job.updateProgress(100);
      logger.info(`AI analysis job ${job.id} completed`, { processId, jobType: job.name });
      
      return result;
      
    } catch (error) {
      logger.error(`AI analysis job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    ...workerConfig,
    concurrency: 3 // Limit concurrent AI jobs to prevent overload
  }
);

// Cleanup Worker
const cleanupWorker = new Worker(
  queues.CLEANUP,
  async (job) => {
    const { processId, filePaths } = job.data;
    
    try {
      logger.info(`Starting cleanup job ${job.id}`, { processId, fileCount: filePaths.length });
      
      const result = await fileService.cleanupFiles(filePaths);
      
      await job.updateProgress(100);
      logger.info(`Cleanup job ${job.id} completed`, { 
        processId, 
        deletedCount: result.deleted.length,
        errors: result.errors.length 
      });
      
      return result;
      
    } catch (error) {
      logger.error(`Cleanup job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    ...workerConfig,
    concurrency: 10 // Allow many concurrent cleanup jobs
  }
);

// Import necessary modules for pipeline progression
const { queueMethods } = require('../config/bullmq');
// Process already imported above from '../models'
const path = require('path');

// Pipeline progression handler
async function handleJobCompletion(job, result) {
  const { processId } = job.data;
  
  try {
    // Find the process document
    const processDoc = await Process.findById(processId);
    if (!processDoc) {
      logger.warn(`Process not found: ${processId}`);
      return;
    }

    logger.info(`📍 Handling job completion`, {
      jobName: job.name,
      jobId: job.id,
      processId,
      timestamp: new Date().toISOString(),
      processingTime: job.finishedOn - job.processedOn
    });

    switch (job.name) {
      case jobTypes.COMPRESS_VIDEO:
        // Video compression completed - store result and start S3 upload
        await storeVideoCompressionResult(processDoc, result);
        await handleVideoCompressionComplete(processDoc, result);
        break;
        
      case jobTypes.EXTRACT_AUDIO:
        // Audio extraction completed - log completion
        await handleAudioExtractionComplete(processDoc, result);
        break;
        
      case jobTypes.SEGMENT_AUDIO:
        // Audio segmentation completed - start transcription jobs
        await handleAudioSegmentationComplete(processDoc, result);
        break;
        
      case jobTypes.TRANSCRIBE_SEGMENT:
        // Check if all transcription segments are done
        await handleTranscriptionSegmentComplete(processDoc, job, result);
        break;
        
      case jobTypes.MERGE_TRANSCRIPTS:
        // Transcription merge completed - start AI analysis
        await handleTranscriptionComplete(processDoc, result);
        break;
        
      case jobTypes.GENERATE_TAGS:
      case jobTypes.GENERATE_TODO:
      case jobTypes.GENERATE_TITLE:
      case jobTypes.GENERATE_EMBEDDING:
        // AI analysis job completed
        await handleAIAnalysisComplete(processDoc, job, result);
        break;
        
      case jobTypes.S3_UPLOAD_VIDEO:
        // S3 upload completed - start local cleanup
        await handleS3UploadComplete(processDoc, result);
        break;

      case jobTypes.LOCAL_CLEANUP:
        // Local cleanup is now re-enabled
        logger.info('Starting local cleanup after S3 upload', {
          processId: processDoc._id.toString(),
          filesToClean: job.data.filePaths
        });
        
        // Perform the actual cleanup
        await handleLocalCleanupComplete(processDoc, result);
        break;

      case jobTypes.CLEANUP_FILES:
        // Legacy cleanup completed - mark process as fully complete
        await handleCleanupComplete(processDoc, result);
        break;
    }
    
  } catch (error) {
    logger.error(`Error in handleJobCompletion for job ${job.id}: ${error.message}`, {
      error: error.message,
      code: error.code,
      stack: error.stack,
      jobName: job.name,
      jobId: job.id,
      processId
    });
    
    // Add error to process document
    if (processId) {
      try {
        const processDoc = await Process.findById(processId);
        if (processDoc) {
          // Mark process as failed if critical pipeline step fails
          const criticalJobs = ['extract-audio', 'segment-audio', 'compress-video'];
          if (criticalJobs.includes(job.name)) {
            processDoc.status = 'failed';
            processDoc.failedAt = new Date();
            processDoc.processingDetails = `${job.name} failed: ${error.message}`;
          }
          
          await processDoc.addError('pipeline_progression', error.message, {
            jobId: job.id,
            jobName: job.name,
            errorType: error.name || 'UnknownError',
            stack: error.stack
          });
        }
      } catch (dbError) {
        logger.error('Failed to add error to process document:', dbError);
      }
    }
  }
}

// Store video compression result for later validation
async function storeVideoCompressionResult(processDoc, result) {
  logger.info(`Storing video compression result for process ${processDoc._id}`);
  
  // Store the result in a temporary field for later processing
  processDoc.pendingVideoResult = {
    outputPath: result.outputPath,
    compressedSize: result.compressedSize,
    compressionRatio: result.compressionRatio,
    duration: result.duration,
    format: result.format,
    codec: result.codec,
    completedAt: new Date()
  };
  
  await processDoc.save();
  
  // Verify the save was successful
  const savedDoc = await Process.findById(processDoc._id);
  if (!savedDoc.pendingVideoResult) {
    logger.error(`Failed to persist pendingVideoResult for process ${processDoc._id}`);
    // Try alternative approach - save video result immediately
    await handleVideoCompressionComplete(processDoc, result);
  } else {
    logger.info(`Video compression result stored for later validation`, {
      processId: processDoc._id,
      outputPath: result.outputPath,
      hasPendingResult: !!savedDoc.pendingVideoResult
    });
  }
}

// Handle video compression completion - save processed file info
async function handleVideoCompressionComplete(processDoc, result) {
  logger.info(`Video compression completed for process ${processDoc._id}`);
  
  // Additional validation before saving to database
  const fs = require('fs').promises;
  
  try {
    // Verify file exists and is accessible
    await fs.access(result.outputPath);
    const stats = await fs.stat(result.outputPath);
    
    // Verify file size matches what FFmpeg reported
    if (Math.abs(stats.size - result.compressedSize) > 1024) { // Allow 1KB difference
      logger.warn(`File size mismatch: reported ${result.compressedSize}, actual ${stats.size}`);
      result.compressedSize = stats.size;
    }
    
    // Update process with compressed video file information
    processDoc.files.processed = {
      ...processDoc.files.processed,
      path: result.outputPath,
      size: result.compressedSize || 0,
      codec: result.codec || 'h264',
      format: result.format || 'mp4',
      resolution: {
        width: 1920,
        height: 1080
      },
      skippedCompression: result.skippedCompression || false,
      compressionRatio: result.compressionRatio || 0,
      validatedAt: new Date()
    };
    
    // Don't update progress here - will be done after AI analysis
    
    await processDoc.save();
    
    logger.info(`Video file validated and saved for process ${processDoc._id}`, {
      path: result.outputPath,
      size: result.compressedSize,
      validated: true,
      skippedCompression: result.skippedCompression || false,
      compressionRatio: result.compressionRatio
    });

    // Start S3 upload job now that video compression is complete
    const { queueMethods } = require('../config/bullmq');
    const s3UploadJob = await queueMethods.addS3UploadJob(
      processDoc._id.toString(),
      result.outputPath, // Local compressed video path
      processDoc.tenantId.toString(),
      processDoc.userId.toString()
    );

    // Update process with S3 upload job ID
    processDoc.jobs = processDoc.jobs || {};
    processDoc.jobs.s3Upload = s3UploadJob.id;
    await processDoc.save();

    logger.info(`S3 upload job started for process ${processDoc._id}`, {
      jobId: s3UploadJob.id,
      localVideoPath: result.outputPath
    });
    
  } catch (error) {
    logger.error(`Failed to validate compressed video file for process ${processDoc._id}:`, error);
    
    // Update process with error status
    processDoc.status = 'failed';
    processDoc.errors = processDoc.errors || [];
    processDoc.errors.push({
      stage: 'video_compression_validation',
      error: error.message,
      timestamp: new Date()
    });
    
    await processDoc.save();
    
    throw new Error(`Video file validation failed: ${error.message}`);
  }
}

// Handle audio extraction completion
async function handleAudioExtractionComplete(processDoc, result) {
  logger.info(`Audio extraction completed for process ${processDoc._id}`);
  
  // AudioService returns 'audioPath', not 'outputPath'
  const audioPath = result.audioPath || result.outputPath;
  
  if (!audioPath) {
    throw new Error('Audio extraction result is missing audioPath');
  }
  
  // Update process with audio file information
  processDoc.files.audio = {
    path: audioPath,
    size: result.audioSize || result.size || 0,
    duration: result.duration,
    format: result.format || 'wav',
    extractedAt: new Date()
  };
  
  // Audio extraction complete at 20%
  await processDoc.updateProgress(20, 'audio_extracted', 'Audio-Extraktion abgeschlossen');
  
  await processDoc.save();
  
  logger.info(`Audio file info saved for process ${processDoc._id}`, {
    path: audioPath,
    duration: result.duration
  });
  
  // IMPORTANT: Start audio segmentation immediately after extraction
  // This enables parallel video compression and transcription pipeline
  logger.info(`Starting audio segmentation for transcription pipeline`, {
    processId: processDoc._id,
    audioPath: audioPath
  });
  
  // Get audio segments directory
  const path = require('path');
  const processedDir = path.dirname(audioPath);
  const audioSegmentsDir = path.join(processedDir, 'segments');
  
  // Start audio segmentation job
  const segmentJob = await queueMethods.addAudioSegmentationJob(
    processDoc._id.toString(),
    audioPath,
    audioSegmentsDir
  );
  
  logger.info(`Audio segmentation job started`, {
    processId: processDoc._id,
    jobId: segmentJob.id,
    segmentsDir: audioSegmentsDir
  });
}

// Handle audio segmentation completion - start transcription
async function handleAudioSegmentationComplete(processDoc, result) {
  logger.info(`Starting transcription for process ${processDoc._id}`);
  
  if (!result.segments || result.segments.length === 0) {
    throw new Error('No audio segments found in result');
  }

  // Update process status - segmentation complete at 25%
  await processDoc.updateProgress(25, 'transcription', 'Transkription wird gestartet...');

  // Add transcription jobs for each segment
  const transcriptionJobs = [];
  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];
    const job = await queueMethods.addTranscriptionJob(
      processDoc._id.toString(),
      segment.path,
      i,
      segment.startTime
    );
    transcriptionJobs.push(job.id);
  }

  // Store transcription job IDs for tracking
  processDoc.jobs.transcription = transcriptionJobs;
  processDoc.status = 'transcribing';
  await processDoc.save();
}

// Handle individual transcription segment completion
async function handleTranscriptionSegmentComplete(processDoc, job, result) {
  // Store the transcription result
  if (!processDoc.transcriptSegments) {
    processDoc.transcriptSegments = [];
  }
  
  processDoc.transcriptSegments.push({
    segmentIndex: job.data.segmentIndex,
    startTime: job.data.startTime,
    text: result.text,
    confidence: result.confidence,
    segments: result.segments
  });
  
  await processDoc.save();
  
  // Check if all transcription jobs are complete
  const totalSegments = processDoc.jobs.transcription ? processDoc.jobs.transcription.length : 1;
  const completedSegments = processDoc.transcriptSegments.length;
  
  logger.info(`Transcription progress: ${completedSegments}/${totalSegments} segments completed`);
  
  if (completedSegments >= totalSegments) {
    // All segments transcribed - merge transcripts
    logger.info(`All transcription segments completed for process ${processDoc._id}`);
    
    await processDoc.updateProgress(60, 'merging_transcripts', 'Merging transcript segments');
    
    // Sort segments by index before merging
    const sortedSegments = processDoc.transcriptSegments.sort((a, b) => a.segmentIndex - b.segmentIndex);
    
    await queueMethods.addTranscriptMergeJob(
      processDoc._id.toString(),
      sortedSegments
    );
  }
}

// Handle transcription completion - start AI analysis
async function handleTranscriptionComplete(processDoc, result) {
  logger.info(`Starting AI analysis for process ${processDoc._id}`);
  
  // Update process with final transcript
  processDoc.transcript = {
    text: result.text,
    confidence: result.confidence,
    segments: result.segments
  };
  
  await processDoc.updateProgress(70, 'ai_analysis', 'KI-Analyse wird durchgeführt...');
  
  // Start AI analysis jobs in PARALLEL - NOTE: Embedding will be generated after title and tags are ready
  logger.info('Starting parallel AI analysis jobs', {
    processId: processDoc._id.toString(),
    transcriptLength: result.text.length
  });
  
  const [tagsJob, todoJob, titleJob] = await Promise.all([
    queueMethods.addTagGenerationJob(processDoc._id.toString(), result.text),
    queueMethods.addTodoGenerationJob(processDoc._id.toString(), result),
    queueMethods.addTitleGenerationJob(processDoc._id.toString(), result.text)
  ]);
  
  logger.info('AI jobs created in parallel (embedding will be added after tags/title)', {
    processId: processDoc._id.toString(),
    jobIds: {
      tags: tagsJob.id,
      todo: todoJob.id,
      title: titleJob.id
    },
    createdAt: new Date().toISOString()
  });
  
  // Store AI job IDs (excluding embedding for now)
  processDoc.jobs.aiAnalysis = {
    tags: tagsJob.id,
    todo: todoJob.id,
    title: titleJob.id
    // Embedding job ID will be added later
  };
  
  processDoc.status = 'analyzing';
  await processDoc.save();
  
  logger.info('Process document saved with AI job IDs', {
    processId: processDoc._id.toString(),
    savedJobIds: processDoc.jobs.aiAnalysis
  });
}

// Handle AI analysis job completion
async function handleAIAnalysisComplete(processDoc, job, result) {
  logger.info(`AI analysis job ${job.name} completed for process ${processDoc._id}`, {
    jobName: job.name,
    jobId: job.id,
    processId: processDoc._id.toString(),
    resultKeys: result ? Object.keys(result) : []
  });
  
  // Update process document with AI results
  switch (job.name) {
    case jobTypes.GENERATE_TAGS:
      logger.info('Setting tags on process', {
        processId: processDoc._id.toString(),
        resultTags: result.tags,
        tagsType: typeof result.tags,
        tagsIsArray: Array.isArray(result.tags),
        firstTag: result.tags?.[0]
      });
      processDoc.tags = result.tags || [];
      break;
      
    case jobTypes.GENERATE_TODO:
      logger.info('Setting todoList on process', {
        processId: processDoc._id.toString(),
        todoCount: result.todoList?.length || 0
      });
      processDoc.todoList = result.todoList || [];
      break;
      
    case jobTypes.GENERATE_TITLE:
      logger.info('Setting title on process', {
        processId: processDoc._id.toString(),
        title: result.title
      });
      processDoc.title = result.title || '';
      break;
      
    case jobTypes.GENERATE_EMBEDDING:
      // Neues detailliertes Logging
      logger.info('Raw embedding result received', {
        processId: processDoc._id.toString(),
        jobId: job.id,
        resultKeys: result ? Object.keys(result) : [],
        resultStringified: JSON.stringify(result).substring(0, 500)
      });
      
      logger.info('Processing embedding result', {
        processId: processDoc._id.toString(),
        jobId: job.id,
        resultExists: !!result,
        embeddingExists: !!result.embedding,
        isArray: Array.isArray(result.embedding),
        length: result.embedding ? result.embedding.length : 0,
        method: result.method || 'unknown'
      });
      
      if (result.embedding && Array.isArray(result.embedding) && result.embedding.length === 1536) {
        processDoc.embedding = result.embedding;
        
        // Save embedding metadata
        processDoc.embeddingMetadata = {
          method: result.method || 'transcript',
          generatedAt: new Date(),
          model: result.model || 'text-embedding-ada-002'
        };
        
        logger.info('Embedding saved successfully', {
          processId: processDoc._id.toString(),
          embeddingLength: result.embedding.length,
          method: processDoc.embeddingMetadata.method
        });
      } else {
        logger.warn('Invalid embedding result', {
          processId: processDoc._id.toString(),
          embeddingExists: !!result.embedding,
          isArray: Array.isArray(result.embedding),
          length: result.embedding ? result.embedding.length : 0,
          result: JSON.stringify(result).substring(0, 200)
        });
        
        // Try to extract embedding from result if it exists in a different structure
        if (result && result.embedding) {
          logger.info('Attempting to save embedding despite validation failure', {
            processId: processDoc._id.toString(),
            embeddingLength: result.embedding.length
          });
          
          // Force save the embedding
          processDoc.embedding = Array.from(result.embedding);
          processDoc.embeddingMetadata = {
            method: result.method || 'transcript',
            generatedAt: new Date(),
            model: result.model || 'text-embedding-ada-002'
          };
        } else {
          // Keep existing embedding or empty array
          processDoc.embedding = processDoc.embedding || [];
        }
      }
      break;
  }
  
  await processDoc.save();
  
  // Debug logging nach dem Speichern
  logger.info('Process saved after AI analysis', {
    processId: processDoc._id.toString(),
    jobName: job.name,
    tags: processDoc.tags,
    title: processDoc.title,
    todoCount: processDoc.todoList?.length || 0
  });
  
  // Neues Logging nach dem Speichern
  logger.info('Process document saved after AI analysis', {
    processId: processDoc._id.toString(),
    jobType: job.name,
    embeddingLength: processDoc.embedding ? processDoc.embedding.length : 0
  });
  
  // Check if all AI analysis jobs are complete
  const aiJobs = processDoc.jobs.aiAnalysis || {};
  const completedJobs = [];
  
  if (processDoc.tags && processDoc.tags.length > 0) completedJobs.push('tags');
  if (processDoc.todoList && processDoc.todoList.length > 0) completedJobs.push('todo');
  if (processDoc.title && processDoc.title.length > 0) completedJobs.push('title');
  if (processDoc.embedding && processDoc.embedding.length === 1536) completedJobs.push('embedding');
  
  // Check if we need to generate embedding after title and tags are ready
  const hasTags = processDoc.tags && processDoc.tags.length > 0;
  const hasTitle = processDoc.title && processDoc.title.length > 0;
  const needsEmbedding = !processDoc.embedding || processDoc.embedding.length !== 1536;
  const embeddingJobNotStarted = !processDoc.jobs.aiAnalysis.embedding;
  
  // Only start embedding generation when BOTH tags AND title are complete
  if (hasTags && hasTitle && needsEmbedding && embeddingJobNotStarted) {
    logger.info('Title and tags both ready, generating embedding from them', {
      processId: processDoc._id.toString(),
      hasTitle,
      hasTags,
      tagCount: processDoc.tags.length,
      titleLength: processDoc.title.length
    });
    
    // Add embedding job with title and tags
    const embeddingJob = await queueMethods.addEmbeddingGenerationJob(
      processDoc._id.toString(),
      processDoc.transcript.text, // Still pass transcript as fallback
      {
        title: processDoc.title,
        tags: processDoc.tags
      }
    );
    
    // Update AI job IDs with embedding job
    processDoc.jobs.aiAnalysis.embedding = embeddingJob.id;
    await processDoc.save();
    
    logger.info('Embedding job added and saved', {
      processId: processDoc._id.toString(),
      embeddingJobId: embeddingJob.id
    });
  } else {
    logger.debug('Embedding generation not ready yet', {
      processId: processDoc._id.toString(),
      hasTags,
      hasTitle,
      needsEmbedding,
      embeddingJobNotStarted,
      currentJobName: job.name
    });
  }
  
  logger.info(`AI analysis progress: ${completedJobs.length}/4 jobs completed`, { completedJobs });
  
  if (completedJobs.length >= 4) {
    // All AI analysis complete - check if video compression is done
    await checkAndFinalizeVideoCompression(processDoc);
  }
}

// Check if video compression is complete and finalize it
async function checkAndFinalizeVideoCompression(processDoc) {
  logger.info(`Checking video compression status for process ${processDoc._id}`);
  
  // Check if we have a pending video result
  if (processDoc.pendingVideoResult) {
    logger.info('Video compression result found, validating now...');
    
    // Update progress to show video validation
    await processDoc.updateProgress(85, 'video_validating', 'Video wird validiert...');
    
    try {
      // Process the stored video result
      await handleVideoCompressionComplete(processDoc, processDoc.pendingVideoResult);
      
      // Clear the pending result
      processDoc.pendingVideoResult = undefined;
      await processDoc.save();
      
      // Update progress - video compression fully complete
      await processDoc.updateProgress(90, 'video_completed', 'Video-Komprimierung abgeschlossen');
      
    } catch (error) {
      logger.error('Video validation failed:', error);
      // Continue with finalization even if video validation fails
    }
  } else {
    logger.warn('No pending video result found, checking if video is still processing...');
    
    // Re-fetch the document to ensure we have the latest data
    const latestDoc = await Process.findById(processDoc._id);
    
    if (latestDoc && latestDoc.pendingVideoResult) {
      // Found the video result after re-fetch
      logger.info('Video result found after re-fetch, processing now...');
      await checkAndFinalizeVideoCompression(latestDoc);
      return;
    } else if (!latestDoc.files?.processed?.path) {
      // No video result and no processed file - wait and try again
      logger.info('Video compression might still be in progress, waiting 5 seconds...');
      setTimeout(async () => {
        const updatedDoc = await Process.findById(processDoc._id);
        if (updatedDoc) {
          await checkAndFinalizeVideoCompression(updatedDoc);
        }
      }, 5000);
      return;
    }
  }
  
  // Continue with finalization
  await finalizeProcessing(processDoc);
}

// Finalize processing - cleanup and mark as complete
async function finalizeProcessing(processDoc) {
  logger.info(`Finalizing processing for process ${processDoc._id}`);
  
  // Check if we have an S3 upload job
  const hasS3UploadJob = processDoc.jobs?.s3Upload;
  
  if (hasS3UploadJob) {
    // Check if S3 upload is still running
    const { Queue } = require('bullmq');
    const { queueConnection } = require('../config/redis');
    const s3UploadQueue = new Queue('s3-upload', queueConnection);
    
    try {
      const s3Job = await s3UploadQueue.getJob(processDoc.jobs.s3Upload);
      
      if (s3Job) {
        const jobState = await s3Job.getState();
        logger.info(`S3 upload job state for process ${processDoc._id}: ${jobState}`);
        
        if (jobState === 'waiting' || jobState === 'active' || jobState === 'delayed') {
          // S3 upload still in progress - don't mark as completed yet
          logger.info(`S3 upload still in progress for process ${processDoc._id}, waiting for completion`);
          
          // Update status to show S3 upload is happening
          processDoc.processingDetails = 'uploading_to_s3';
          await processDoc.updateProgress(91, 'uploading_to_s3', 'Video wird zu S3 hochgeladen...');
          await processDoc.save();
          
          // The S3 worker will handle final completion
          return;
        }
      }
    } catch (error) {
      logger.warn(`Could not check S3 job status: ${error.message}`);
    }
  }
  
  
  // For local-only processes, use legacy cleanup
  await processDoc.updateProgress(95, 'cleanup', 'Temporäre Dateien werden aufgeräumt...');
  
  // Add cleanup job for temporary files (local processes only)
  const tempFilePaths = [
    processDoc.files.original.path,
    ...processDoc.transcriptSegments?.map(s => s.audioPath) || []
  ];
  
  await queueMethods.addCleanupJob(
    processDoc._id.toString(),
    tempFilePaths,
    5000 // 5 second delay
  );
  
  // Don't mark as completed here - wait for cleanup to finish
  processDoc.status = 'finalizing';
  await processDoc.save();
  
  logger.info(`Local process ${processDoc._id} cleanup job added, waiting for completion`);
}

// Handle cleanup completion - final step
async function handleCleanupComplete(processDoc, result) {
  logger.info(`Cleanup completed for process ${processDoc._id}`);
  
  // Log cleanup results
  if (result.errors && result.errors.length > 0) {
    logger.warn(`Cleanup had ${result.errors.length} errors:`, result.errors);
  }
  
  // NOW mark the process as truly completed
  processDoc.status = 'completed';
  await processDoc.updateProgress(100, 'completed', 'Verarbeitung abgeschlossen');
  
  await processDoc.save();
  
  logger.info(`Process ${processDoc._id} fully completed!`, {
    deletedFiles: result.deleted?.length || 0,
    errors: result.errors?.length || 0
  });
}

// Worker event handlers with pipeline progression logic
const setupWorkerEvents = (worker, workerName) => {
  worker.on('completed', async (job, result) => {
    logger.info(`${workerName} job completed:`, {
      jobId: job.id,
      jobName: job.name,
      processId: job.data.processId,
      duration: job.finishedOn - job.processedOn,
      result: typeof result === 'object' ? Object.keys(result) : 'success'
    });

    // Handle pipeline progression based on job type
    try {
      await handleJobCompletion(job, result);
    } catch (error) {
      logger.error(`Error handling job completion for ${job.id}:`, error);
    }
  });

  worker.on('failed', (job, error) => {
    logger.error(`${workerName} job failed:`, {
      jobId: job.id,
      jobName: job.name,
      processId: job.data.processId,
      error: error.message,
      attemptsMade: job.attemptsMade,
      stackTrace: error.stack
    });
  });

  worker.on('progress', (job, progress) => {
    logger.debug(`${workerName} job progress:`, {
      jobId: job.id,
      processId: job.data.processId,
      progress: `${progress}%`
    });
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`${workerName} job stalled:`, { jobId });
  });

  worker.on('error', (error) => {
    logger.error(`${workerName} worker error:`, error);
  });
};

// Setup event handlers for all workers
// Initialize S3 and Cleanup workers
const s3UploadWorker = new S3UploadWorker();
const localCleanupWorker = new LocalCleanupWorker();

setupWorkerEvents(videoWorker, 'VideoWorker');
setupWorkerEvents(audioWorker, 'AudioWorker');
setupWorkerEvents(transcriptionWorker, 'TranscriptionWorker');
setupWorkerEvents(aiWorker, 'AIWorker');
setupWorkerEvents(cleanupWorker, 'CleanupWorker');

// Note: S3UploadWorker and LocalCleanupWorker handle their own event logging

// Handle S3 upload completion
async function handleS3UploadComplete(processDoc, result) {
  logger.info(`S3 upload completed for process ${processDoc._id}`, {
    s3Key: result.s3Key,
    sizeMB: result.sizeMB
  });

  // Start local cleanup job now that S3 upload is complete
  const { queueMethods } = require('../config/bullmq');
  
  // Collect all local files to cleanup
  const filesToCleanup = [
    processDoc.files.original?.path, // Original uploaded file
    processDoc.files.processed?.path, // Local compressed video
    processDoc.files.audio?.path // Audio file
  ].filter(path => path && !path.startsWith('tenants/')); // Only local paths

  // Add audio segments directory
  const processedDir = processDoc.files.processed?.path;
  if (processedDir) {
    const path = require('path');
    const audioSegmentsDir = path.join(path.dirname(processedDir), 'segments');
    filesToCleanup.push(audioSegmentsDir);
  }

  if (filesToCleanup.length > 0) {
    const cleanupJob = await queueMethods.addLocalCleanupJob(
      processDoc._id.toString(),
      filesToCleanup,
      5000 // 5 second delay to ensure S3 upload is fully complete
    );

    // Update process with cleanup job ID
    processDoc.jobs = processDoc.jobs || {};
    processDoc.jobs.localCleanup = cleanupJob.id;
    await processDoc.save();

    logger.info(`Local cleanup job started for process ${processDoc._id}`, {
      jobId: cleanupJob.id,
      filesToCleanup: filesToCleanup.length
    });
  } else {
    logger.info(`No local files to cleanup for process ${processDoc._id}`);
  }
}

// Handle local cleanup completion
async function handleLocalCleanupComplete(processDoc, result) {
  logger.info(`Local cleanup completed for process ${processDoc._id}`, {
    deletedFiles: result.cleaned,
    errors: result.errors
  });

  // Mark process as fully complete
  if (processDoc.status !== 'failed') {
    processDoc.status = 'completed';
    await processDoc.updateProgress(100, 'completed', 'Verarbeitung vollständig abgeschlossen');
  }

  // Store cleanup metadata
  processDoc.metadata = processDoc.metadata || {};
  processDoc.metadata.storageCleanup = {
    completedAt: new Date(),
    deletedFiles: result.cleaned,
    errors: result.errors
  };

  await processDoc.save();

  logger.info(`Process ${processDoc._id} fully completed with S3 storage and local cleanup`);
}

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logger.info('Shutting down queue workers...');
  
  const workers = [videoWorker, audioWorker, transcriptionWorker, aiWorker, cleanupWorker, s3UploadWorker, localCleanupWorker];
  
  try {
    await Promise.all(workers.map(worker => worker.close()));
    logger.info('All workers shut down successfully');
  } catch (error) {
    logger.error('Error during worker shutdown:', error);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export workers for potential external control
module.exports = {
  videoWorker,
  audioWorker,
  transcriptionWorker,
  aiWorker,
  cleanupWorker,
  s3UploadWorker,
  localCleanupWorker,
  gracefulShutdown,
  handleJobCompletion
};