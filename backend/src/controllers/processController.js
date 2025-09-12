const { Process } = require('../models');
const { queueMethods } = require('../config/bullmq');
const videoService = require('../services/videoService');
const videoTokenService = require('../services/videoTokenService');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const similarityCache = require('../services/similarityCacheService');
// Lazy load s3Service to prevent startup errors
const getS3Service = () => require('../services/s3Service').getInstance();
const storageTrackingService = require('../services/storageTrackingService');

class ProcessController {
  /**
   * Get all processes for tenant
   * @route GET /api/v1/tenants/:tenantId/processes
   * @access Private
   */
  async getProcesses(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { 
        page = 1, 
        limit = 20, 
        status, 
        tags, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        userId,
        search 
      } = req.query;

      // Build filter options
      const options = {
        userId: userId || undefined,
        status: status || undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        search: search || undefined,
        limit: Math.min(parseInt(limit), 100), // Max 100 items per page
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
        populate: true
      };

      // Get processes and total count
      const [processes, totalCount] = await Promise.all([
        Process.findByTenant(tenantId, options),
        Process.countDocuments({ 
          tenantId, 
          isDeleted: false,
          ...(options.userId && { userId: options.userId }),
          ...(options.status && { status: options.status }),
          ...(options.tags && { 'tags.name': { $in: options.tags } }),
          ...(options.search && {
            $or: [
              { 'tags.name': { $regex: options.search, $options: 'i' } },
              { title: { $regex: options.search, $options: 'i' } }
            ]
          })
        })
      ]);

      const totalPages = Math.ceil(totalCount / options.limit);

      res.json({
        success: true,
        data: {
          processes,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get processes error:', error);
      next(error);
    }
  }

  /**
   * Create new process (upload video)
   * @route POST /api/v1/tenants/:tenantId/processes
   * @access Private
   */
  async createProcess(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { id: userId } = req.user;

      // Chunk finalization is now handled by a separate endpoint
      // if (req.body && req.body.uploadId && !req.file) {
      //   return this.finalizeChunkedUpload(req, res, next);
      // }

      logger.info('CreateProcess called', {
        hasFile: !!req.file,
        fileDetails: req.file ? {
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: req.file.path
        } : null,
        uploadStats: req.uploadStats,
        processId: req.processId
      });

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Video file is required'
        });
      }

      // Check user upload limits using storage tracking service
      const { User } = require('../models');
      const user = await User.findById(userId);
      const fileSizeMB = req.file.size / (1024 * 1024);
      
      // Validate upload limits
      const uploadValidation = await storageTrackingService.validateUserUpload(
        userId, 
        tenantId, 
        fileSizeMB, 
        user.accountType
      );
      
      if (!uploadValidation.allowed) {
        if (req.cleanupUploadedFile) {
          await req.cleanupUploadedFile();
        }
        
        let errorResponse = {
          success: false,
          code: uploadValidation.reason.toUpperCase()
        };
        
        if (uploadValidation.reason === 'monthly_limit_exceeded') {
          errorResponse.message = 'Monthly upload limit reached (10 processes). Upgrade to Pro for unlimited uploads.';
          errorResponse.limit = {
            current: uploadValidation.current,
            max: uploadValidation.limit,
            upgradeRequired: true
          };
        } else if (uploadValidation.reason === 'storage_limit_exceeded') {
          const fileSizeGB = fileSizeMB / 1024;
          const currentGB = uploadValidation.currentMB / 1024;
          errorResponse.message = `Storage limit exceeded. This file (${fileSizeGB.toFixed(2)}GB) would exceed your 20GB limit.`;
          errorResponse.storage = {
            used: Math.round(currentGB * 100) / 100,
            fileSize: Math.round(fileSizeGB * 100) / 100,
            limit: 20,
            upgradeRequired: true
          };
        }
        
        return res.status(403).json(errorResponse);
      }

      // Validate video file
      const validation = await videoService.validateVideo(req.file.path);
      if (!validation.isValid) {
        // Clean up uploaded file
        if (req.cleanupUploadedFile) {
          await req.cleanupUploadedFile();
        }

        return res.status(400).json({
          success: false,
          message: 'Invalid video file',
          errors: validation.errors
        });
      }


      // Create process record with tenant isolation
      const processId = req.processId || require('mongoose').Types.ObjectId().toString();
      
      // Debug: Log all request data
      logger.info('Process creation debug:', {
        reqProcessId: req.processId,
        reqUploadDir: req.uploadDir,
        reqBodyKeys: Object.keys(req.body || {}),
        reqBody: req.body
      });
      
      // Clean req.body to avoid any unwanted fields being passed to MongoDB
      delete req.body._id;
      delete req.body.processId;
      
      // Create process data object explicitly to avoid any contamination
      const processData = {
        tenantId,
        userId,
        originalFilename: req.originalFilename || req.file.originalname,
        status: 'uploaded',
        files: {
          original: {
            path: req.file.path, // Local path for processing
            size: req.file.size,
            duration: validation.metadata.duration,
            format: validation.metadata.format,
            resolution: validation.metadata.video ? {
              width: validation.metadata.video.width,
              height: validation.metadata.video.height
            } : null,
            storageType: 'local' // Will change to 's3' after processing
          }
        },
        transcript: {
          language: 'en', // Set explicit language for MongoDB compatibility
          segments: []
        },
        metadata: {
          uploadDir: req.uploadDir,
          tenantDir: tenantId,
          uploadedFrom: {
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        }
      };
      
      // Log the exact data being used
      logger.info('Creating process with data:', {
        dataKeys: Object.keys(processData),
        hasId: '_id' in processData,
        hasProcessId: 'processId' in processData
      });
      
      const process = new Process(processData);

      await process.save();

      // Update usage tracking for Free accounts (temporary, will be updated after S3 upload)
      if (user.accountType === 'free') {
        await user.incrementProcessUsage();
        // Note: Storage usage will be tracked when final compressed video goes to S3
        logger.info('Updated Free account process usage', {
          userId,
          processCount: user.usage.processesThisMonth
        });
      }

      logger.info('Process created', {
        processId: process._id,
        tenantId,
        userId,
        filename: req.file.originalname,
        size: req.file.size,
        accountType: user.accountType
      });

      // Start local video processing pipeline
      await this.startProcessingPipeline(process);

      res.status(201).json({
        success: true,
        message: 'Video uploaded successfully. Processing started.',
        data: {
          process: process.toJSON()
        }
      });

    } catch (error) {
      logger.error('Create process error:', {
        error: error.message,
        stack: error.stack,
        tenantId,
        userId,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        processId: req.processId
      });
      
      // Clean up uploaded file on error
      if (req.cleanupUploadedFile) {
        await req.cleanupUploadedFile();
      }
      
      // Send proper error response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to create process',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
      
      next(error);
    }
  }

  /**
   * Start the video processing pipeline
   * @param {Object} processDocument - Process document
   */
  async startProcessingPipeline(processDocument) {
    try {
      const processId = processDocument._id.toString();
      const inputPath = processDocument.files.original.path; // Local path for processing
      
      // Define local output paths with tenant isolation
      const tenantId = processDocument.tenantId?.toString() || 'default';
      const processedDir = path.join(
        process.env.PROCESSED_DIR || './uploads/processed',
        tenantId,
        processId
      );
      
      const videoOutputPath = path.join(processedDir, 'video.mp4');
      const audioOutputPath = path.join(processedDir, 'audio.wav');
      const audioSegmentsDir = path.join(processedDir, 'segments');

      // Ensure directories exist
      await fs.mkdir(processedDir, { recursive: true });
      await fs.mkdir(audioSegmentsDir, { recursive: true });

      // Update process status
      await processDocument.updateProgress(5, 'starting', 'Verarbeitung wird vorbereitet...');

      // PIPELINE OPTIMIZATION: Start audio extraction first, then video compression in parallel
      logger.info('🚀 Starting optimized pipeline', {
        processId,
        pipeline: 'audio-first-parallel',
        timestamp: new Date().toISOString()
      });

      // Step 1: Add audio extraction job (starts immediately)
      const audioJob = await queueMethods.addAudioExtractionJob(
        processId,
        inputPath, // Use original local file for audio extraction
        audioOutputPath
      );

      logger.info('📊 Audio extraction job created', {
        processId,
        jobId: audioJob.id,
        priority: audioJob.opts.priority,
        timestamp: new Date().toISOString()
      });

      // Step 2: Add video compression job (runs in parallel with audio pipeline)
      const videoJob = await queueMethods.addVideoCompressionJob(
        processId,
        inputPath,
        videoOutputPath
      );

      logger.info('📊 Video compression job created', {
        processId,
        jobId: videoJob.id,
        priority: videoJob.opts.priority,
        timestamp: new Date().toISOString(),
        parallel: 'Running parallel to audio pipeline'
      });

      // Note: Audio segmentation will be triggered after audio extraction completes
      // This enables the transcription pipeline to run in parallel with video compression
      
      logger.info('📊 Pipeline structure initialized', {
        processId,
        structure: {
          immediate: ['audio-extraction', 'video-compression'],
          afterAudio: ['audio-segmentation -> transcription -> AI'],
          afterVideo: ['s3-upload -> cleanup']
        },
        timestamp: new Date().toISOString()
      });

      // Store job IDs for tracking
      processDocument.jobs = {
        videoProcessing: videoJob.id,
        audioExtraction: audioJob.id
        // audioSegmentation job ID will be added after audio extraction
        // s3Upload and localCleanup job IDs will be added later
      };

      processDocument.status = 'processing_media';
      await processDocument.save();

      logger.info('✅ Pipeline started successfully', {
        processId,
        jobs: processDocument.jobs,
        expectedParallelism: 'video-compression || (audio -> transcription -> AI)'
      });

    } catch (error) {
      logger.error('Error starting processing pipeline:', error);
      
      await processDocument.addError('pipeline_start', error.message, {
        stack: error.stack
      });
      
      processDocument.status = 'failed';
      await processDocument.save();
    }
  }

  /**
   * Get single process
   * @route GET /api/v1/tenants/:tenantId/processes/:id
   * @access Private
   */
  async getProcess(req, res, next) {
    try {
      const { tenantId, id } = req.params;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      }).populate('userId', 'firstName lastName email');

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      res.json({
        success: true,
        data: {
          process: process.toJSON()
        }
      });

    } catch (error) {
      logger.error('Get process error:', error);
      next(error);
    }
  }

  /**
   * Update process (edit transcript, tags, todo list, title)
   * @route PUT /api/v1/tenants/:tenantId/processes/:id
   * @access Private
   */
  async updateProcess(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const { title, transcript, tags, todoList } = req.body;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      // Update allowed fields
      if (title !== undefined) process.title = title;
      if (transcript !== undefined) process.transcript = { ...process.transcript, ...transcript };
      
      // Handle tags update - only new format
      if (tags !== undefined) {
        // Validate and normalize tags
        if (Array.isArray(tags)) {
          process.tags = tags
            .filter(tag => tag && typeof tag === 'object' && tag.name)
            .map(tag => ({
              name: tag.name.toLowerCase().trim(),
              weight: Math.max(0, Math.min(1, tag.weight || 0.5))
            }));
        } else {
          process.tags = [];
        }
      }
      
      if (todoList !== undefined) process.todoList = todoList;

      await process.save();

      logger.info('Process updated', {
        processId: id,
        tenantId,
        userId: req.user.id,
        updatedFields: Object.keys(req.body)
      });

      res.json({
        success: true,
        message: 'Process updated successfully',
        data: {
          process: process.toJSON()
        }
      });

    } catch (error) {
      logger.error('Update process error:', error);
      next(error);
    }
  }

  /**
   * Delete process
   * @route DELETE /api/v1/tenants/:tenantId/processes/:id
   * @access Private
   */
  async deleteProcess(req, res, next) {
    try {
      const { tenantId, id } = req.params;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      // Track storage deletion and update usage
      if (process.files.original?.size) {
        const fileSizeMB = process.files.original.size / (1024 * 1024);
        
        // Update storage tracking service
        await storageTrackingService.trackFileDeletion(
          process.userId,
          process.tenantId,
          fileSizeMB,
          'video'
        );

        // Update legacy user usage for Free accounts
        const { User } = require('../models');
        const user = await User.findById(process.userId);
        if (user && user.accountType === 'free') {
          await user.removeStorageUsage(fileSizeMB);
          logger.info('Reclaimed Free account storage', {
            userId: process.userId,
            reclaimedMB: fileSizeMB,
            remainingMB: user.usage.storageUsedMB
          });
        }
      }

      // Soft delete
      await process.softDelete();

      // Remove process from all favorite lists
      const FavoriteList = require('../models/FavoriteList');
      const affectedLists = await FavoriteList.findListsContainingProcess(tenantId, id);
      
      if (affectedLists.length > 0) {
        logger.info('Removing process from favorite lists', {
          processId: id,
          listsCount: affectedLists.length
        });
        
        // Update each affected list
        for (const list of affectedLists) {
          await list.removeProcess(id);
        }
      }

      // Delete ALL S3 files for this process
      try {
        const s3DeleteResult = await getS3Service().deleteProcessFiles(tenantId, id);
        
        if (s3DeleteResult.success) {
          logger.info('All S3 files deleted successfully', {
            processId: id,
            deletedCount: s3DeleteResult.deletedCount
          });
        } else {
          logger.warn('S3 files partially deleted', {
            processId: id,
            deletedCount: s3DeleteResult.deletedCount,
            errorCount: s3DeleteResult.errorCount,
            errors: s3DeleteResult.errors
          });
        }
      } catch (s3Error) {
        // Log S3 error but don't fail the process deletion
        logger.error('S3 deletion failed completely', {
          processId: id,
          tenantId,
          error: s3Error.message
        });
      }

      logger.info('Process deleted', {
        processId: id,
        tenantId,
        userId: req.user.id,
        removedFromLists: affectedLists.length
      });

      res.json({
        success: true,
        message: 'Process deleted successfully'
      });

    } catch (error) {
      logger.error('Delete process error:', error);
      next(error);
    }
  }

  /**
   * Generate share link
   * @route POST /api/v1/tenants/:tenantId/processes/:id/share
   * @access Private
   */
  async generateShareLink(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const { expiresAt } = req.body;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false,
        status: 'completed'
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found or not completed'
        });
      }

      const expirationDate = expiresAt ? new Date(expiresAt) : null;
      await process.enableSharing(expirationDate);

      // Use frontend URL for share links (use global process.env)
      const frontendUrl = global.process.env.FRONTEND_URL || 'http://localhost:5001';
      const shareUrl = `${frontendUrl}/shared/${process.shareId}`;

      logger.info('Share link generated', {
        processId: id,
        tenantId,
        shareId: process.shareId,
        expiresAt: expirationDate
      });

      res.json({
        success: true,
        message: 'Share link generated successfully',
        data: {
          shareId: process.shareId,
          shareUrl,
          expiresAt: expirationDate
        }
      });

    } catch (error) {
      logger.error('Generate share link error:', error);
      next(error);
    }
  }

  /**
   * Disable sharing
   * @route DELETE /api/v1/tenants/:tenantId/processes/:id/share
   * @access Private
   */
  async disableSharing(req, res, next) {
    try {
      const { tenantId, id } = req.params;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      await process.disableSharing();

      logger.info('Sharing disabled', {
        processId: id,
        tenantId
      });

      res.json({
        success: true,
        message: 'Sharing disabled successfully'
      });

    } catch (error) {
      logger.error('Disable sharing error:', error);
      next(error);
    }
  }

  /**
   * Get processing status
   * @route GET /api/v1/tenants/:tenantId/processes/:id/status
   * @access Private
   */
  async getProcessStatus(req, res, next) {
    try {
      const { tenantId, id } = req.params;

      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      res.json({
        success: true,
        data: {
          process: process
        }
      });

    } catch (error) {
      logger.error('Get process status error:', error);
      next(error);
    }
  }

  /**
   * Search processes
   * @route GET /api/v1/tenants/:tenantId/processes/search
   * @access Private
   */
  async searchProcesses(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { q, limit = 50 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      const processes = await Process.searchByText(tenantId, q.trim(), {
        limit: Math.min(parseInt(limit), 100)
      });

      res.json({
        success: true,
        data: {
          processes,
          query: q.trim(),
          count: processes.length
        }
      });

    } catch (error) {
      logger.error('Search processes error:', error);
      next(error);
    }
  }

  /**
   * Get unique tags
   * @route GET /api/v1/tenants/:tenantId/processes/tags
   * @access Private
   */
  async getTags(req, res, next) {
    try {
      const { tenantId } = req.params;

      const tags = await Process.getUniqueTagsForTenant(tenantId);

      res.json({
        success: true,
        data: {
          tags
        }
      });

    } catch (error) {
      logger.error('Get tags error:', error);
      next(error);
    }
  }

  /**
   * Get graph data for visualization
   * @route GET /api/v1/tenants/:tenantId/processes/graph-data
   * @access Private
   */
  async getGraphData(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { mode = 'tags', threshold = 0.7 } = req.query;
      
      // Convert threshold to number to ensure consistent comparison
      const numericThreshold = parseFloat(threshold) || 0.7;

      logger.info('Graph data request', { 
        tenantId, 
        mode, 
        threshold: numericThreshold,
        originalThreshold: threshold,
        thresholdType: typeof threshold,
        parsedCorrectly: !isNaN(parseFloat(threshold))
      });

      // Get processes based on mode
      let query = {
        tenantId,
        isDeleted: false
      };

      // For tag mode, need tags; for semantic/hybrid, need embeddings
      if (mode === 'tags') {
        query.tags = { $exists: true, $not: { $size: 0 } };
      } else if (mode === 'semantic') {
        query.embedding = { $exists: true, $ne: [] };
      } else if (mode === 'hybrid') {
        // For hybrid, we want processes with either tags or embeddings
        query.$or = [
          { tags: { $exists: true, $not: { $size: 0 } } },
          { embedding: { $exists: true, $ne: [] } }
        ];
      }

      const processes = await Process.find(query)
        .select('title tags tagWeights embedding createdAt status originalFilename')
        .lean(); // Use lean for better performance and to ensure all fields are loaded

      logger.info('Found processes for graph', { 
        count: processes.length, 
        firstProcess: processes[0] ? {
          id: processes[0]._id,
          hasTags: !!processes[0].tags,
          hasTagWeights: !!processes[0].tagWeights,
          tagCount: processes[0].tags?.length || 0,
          tagWeightCount: processes[0].tagWeights?.length || 0,
          hasEmbedding: !!processes[0].embedding,
          embeddingLength: processes[0].embedding?.length || 0,
          embeddingType: Array.isArray(processes[0].embedding) ? 'array' : typeof processes[0].embedding
        } : null
      });

      // Debug: Check all processes for embeddings
      const embeddingStats = processes.map(p => ({
        id: p._id,
        hasEmbedding: !!p.embedding,
        embeddingLength: p.embedding?.length || 0,
        firstValue: p.embedding?.[0],
        lastValue: p.embedding?.[p.embedding?.length - 1],
        firstValueType: typeof p.embedding?.[0],
        sampleValues: p.embedding ? [p.embedding[0], p.embedding[100], p.embedding[500], p.embedding[1000], p.embedding[1535]] : [],
        // Check if values are all zeros
        allZeros: p.embedding ? p.embedding.every(v => v === 0) : null,
        // Calculate norm to check if embedding is normalized
        norm: p.embedding ? Math.sqrt(p.embedding.reduce((sum, v) => sum + v * v, 0)) : null
      }));
      logger.info('Detailed embedding stats for all processes:', embeddingStats);

      // Build nodes and links for graph visualization
      const nodes = [];
      const links = [];
      const tagMap = new Map();
      let validProcesses = processes; // Default to all processes, will be filtered for semantic mode

      // Create process nodes
      processes.forEach(process => {
        nodes.push({
          id: process._id.toString(),
          type: 'process',
          title: process.title || process.originalFilename,
          tags: process.tags,
          status: process.status,
          createdAt: process.createdAt
        });

        // Extract tag names from new structure
        const tagNames = (process.tags || []).map(tag => tag.name);
        
        tagNames.forEach(tagName => {
          if (!tagMap.has(tagName)) {
            tagMap.set(tagName, []);
          }
          tagMap.get(tagName).push(process._id.toString());
        });
      });

      // Create tag nodes and links
      tagMap.forEach((processIds, tag) => {
        const tagNodeId = `tag-${tag}`;
        
        nodes.push({
          id: tagNodeId,
          type: 'tag',
          name: tag,
          count: processIds.length
        });

        // Create links between tag and processes
        processIds.forEach(processId => {
          links.push({
            source: tagNodeId,
            target: processId,
            type: 'tag-process'
          });
        });

        // Create links between processes sharing the same tag
        for (let i = 0; i < processIds.length - 1; i++) {
          for (let j = i + 1; j < processIds.length; j++) {
            const existingLink = links.find(link =>
              (link.source === processIds[i] && link.target === processIds[j]) ||
              (link.source === processIds[j] && link.target === processIds[i])
            );

            if (!existingLink) {
              links.push({
                source: processIds[i],
                target: processIds[j],
                type: 'process-process',
                sharedTags: [tag]
              });
            } else if (existingLink.type === 'process-process') {
              existingLink.sharedTags = [...(existingLink.sharedTags || []), tag];
            }
          }
        }
      });

      // Add semantic links if mode is 'semantic' or 'hybrid'
      if (mode === 'semantic' || mode === 'hybrid') {
        // Filter out processes with invalid embeddings
        validProcesses = processes.filter(p => {
          if (!p.embedding || p.embedding.length !== 1536) return false;
          
          // Calculate norm to check if embedding is valid
          const norm = Math.sqrt(p.embedding.reduce((sum, v) => sum + v * v, 0));
          
          // Check if embedding is normalized (should be close to 1.0)
          if (Math.abs(norm - 1.0) > 0.1 && Math.abs(norm - 3.919) < 0.01) {
            logger.warn('Skipping process with invalid embedding (all values 0.1)', {
              processId: p._id,
              norm: norm.toFixed(3),
              sampleValues: [p.embedding[0], p.embedding[1], p.embedding[2]]
            });
            return false;
          }
          
          // Check if norm is too far from 1.0
          if (Math.abs(norm - 1.0) > 0.5) {
            logger.warn('Skipping process with non-normalized embedding', {
              processId: p._id,
              norm: norm.toFixed(3)
            });
            return false;
          }
          
          return true;
        });
        
        logger.info('Valid processes for semantic similarity', {
          totalProcesses: processes.length,
          validProcesses: validProcesses.length,
          skippedProcesses: processes.length - validProcesses.length
        });

        // Get cached similarity matrix
        const processIds = validProcesses.map(p => p._id.toString());
        const cachedMatrix = await similarityCache.getSimilarityMatrix(processIds);
        const newSimilarities = [];
        
        logger.debug('Cache matrix retrieved', {
          processIds: processIds,
          cacheKeys: Object.keys(cachedMatrix),
          cacheSize: Object.keys(cachedMatrix).length
        });

        // Calculate semantic similarities between processes
        const allSimilarities = []; // Collect all similarities for debugging
        let calculationAttempts = 0;
        let skippedCalculations = 0;
        
        logger.info('Starting similarity calculations', {
          validProcessCount: validProcesses.length,
          expectedCalculations: (validProcesses.length * (validProcesses.length - 1)) / 2
        });
        
        for (let i = 0; i < validProcesses.length - 1; i++) {
          for (let j = i + 1; j < validProcesses.length; j++) {
            calculationAttempts++;
            const proc1 = validProcesses[i];
            const proc2 = validProcesses[j];
            const id1 = proc1._id.toString();
            const id2 = proc2._id.toString();

            logger.debug(`Calculation attempt ${calculationAttempts}`, {
              proc1Id: id1,
              proc2Id: id2,
              proc1Embedding: proc1.embedding ? 'exists' : 'missing',
              proc2Embedding: proc2.embedding ? 'exists' : 'missing',
              proc1EmbeddingType: Array.isArray(proc1.embedding) ? 'array' : typeof proc1.embedding,
              proc2EmbeddingType: Array.isArray(proc2.embedding) ? 'array' : typeof proc2.embedding
            });

            // Skip if no embeddings
            if (!proc1.embedding || !proc2.embedding) {
              skippedCalculations++;
              logger.warn(`Skipping similarity calculation - missing embeddings`, {
                calculationNumber: calculationAttempts,
                proc1Id: id1,
                proc1HasEmbedding: !!proc1.embedding,
                proc1EmbeddingLength: proc1.embedding?.length || 0,
                proc2Id: id2,
                proc2HasEmbedding: !!proc2.embedding,
                proc2EmbeddingLength: proc2.embedding?.length || 0
              });
              continue;
            }

            // Check cache first
            let similarity = cachedMatrix[id1]?.[id2];
            
            // Also check reverse direction in cache
            if (similarity === undefined) {
              similarity = cachedMatrix[id2]?.[id1];
            }
            
            if (similarity !== undefined) {
              // Cache hit
              logger.debug('Cache hit for similarity', {
                proc1Id: id1,
                proc2Id: id2,
                cachedSimilarity: similarity,
                similarityType: typeof similarity
              });
              
              // Ensure similarity is a number
              similarity = Number(similarity);
              if (isNaN(similarity)) {
                logger.error('Cached similarity is not a number', {
                  proc1Id: id1,
                  proc2Id: id2,
                  cachedValue: cachedMatrix[id1]?.[id2],
                  cachedValueReverse: cachedMatrix[id2]?.[id1]
                });
                // Recalculate if cache value is invalid
                similarity = Process.calculateSimilarity(proc1.embedding, proc2.embedding);
                newSimilarities.push({ processId1: id1, processId2: id2, similarity });
              }
            } else {
              // Cache miss - calculate cosine similarity
              similarity = Process.calculateSimilarity(proc1.embedding, proc2.embedding);
              
              // Debug first calculation
              if (i === 0 && j === 1) {
                logger.debug('First similarity calculation details:', {
                  proc1Id: id1,
                  proc2Id: id2,
                  embedding1Length: proc1.embedding.length,
                  embedding2Length: proc2.embedding.length,
                  embedding1Sample: [proc1.embedding[0], proc1.embedding[1], proc1.embedding[2], '...', proc1.embedding[1533], proc1.embedding[1534], proc1.embedding[1535]],
                  embedding2Sample: [proc2.embedding[0], proc2.embedding[1], proc2.embedding[2], '...', proc2.embedding[1533], proc2.embedding[1534], proc2.embedding[1535]],
                  calculatedSimilarity: similarity
                });
              }
              
              // Cache for future use
              newSimilarities.push({ processId1: id1, processId2: id2, similarity });
            }

            // Collect all similarities for analysis
            allSimilarities.push(similarity);
            
            logger.debug(`Similarity calculated`, {
              calculationNumber: calculationAttempts,
              proc1Id: id1,
              proc2Id: id2,
              similarity: similarity,
              threshold: numericThreshold,
              meetsThreshold: similarity >= numericThreshold
            });

            if (similarity >= numericThreshold) {
              // Check if link already exists (from tag-based)
              const existingLink = links.find(link =>
                (link.source === id1 && link.target === id2) ||
                (link.source === id2 && link.target === id1)
              );

              if (!existingLink) {
                links.push({
                  source: id1,
                  target: id2,
                  type: 'semantic',
                  similarity: similarity.toFixed(3)
                });
              } else if (mode === 'hybrid') {
                // Add similarity score to existing link
                existingLink.similarity = similarity.toFixed(3);
                existingLink.type = 'hybrid';
              }
            }
          }
        }

        // Cache new similarities
        if (newSimilarities.length > 0) {
          await similarityCache.cacheSimilarityMatrix(newSimilarities);
        }

        // Log calculation summary
        logger.info('Similarity calculation summary', {
          totalAttempts: calculationAttempts,
          skippedCalculations: skippedCalculations,
          successfulCalculations: allSimilarities.length,
          cacheHits: calculationAttempts - skippedCalculations - newSimilarities.length,
          newCalculations: newSimilarities.length
        });

        // Log similarity distribution for debugging
        if (allSimilarities.length > 0) {
          const sortedSims = allSimilarities.sort((a, b) => a - b);
          logger.info('Similarity distribution analysis:', {
            count: allSimilarities.length,
            min: sortedSims[0].toFixed(3),
            max: sortedSims[sortedSims.length - 1].toFixed(3),
            median: sortedSims[Math.floor(sortedSims.length / 2)].toFixed(3),
            average: (allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length).toFixed(3),
            threshold: numericThreshold,
            aboveThreshold: allSimilarities.filter(s => s >= numericThreshold).length,
            belowThreshold: allSimilarities.filter(s => s < numericThreshold).length
          });
        } else {
          logger.warn('No similarities calculated!', {
            validProcessCount: validProcesses.length,
            calculationAttempts: calculationAttempts,
            skippedCalculations: skippedCalculations
          });
        }
      }

      // Filter links based on mode
      let filteredLinks = links;
      if (mode === 'semantic') {
        // Only show semantic links
        filteredLinks = links.filter(link => link.type === 'semantic');
        // Remove tag nodes and invalid process nodes if semantic only
        const validProcessIds = new Set(validProcesses?.map(p => p._id.toString()) || []);
        nodes.splice(0, nodes.length, ...nodes.filter(node => validProcessIds.has(node.id)));
      } else if (mode === 'tags') {
        // Only show tag-based links
        filteredLinks = links.filter(link => link.type !== 'semantic');
      }

      const responseData = {
        success: true,
        data: {
          nodes,
          links: filteredLinks,
          mode,
          threshold: numericThreshold,
          stats: {
            processCount: processes.length,
            tagCount: mode === 'semantic' ? 0 : tagMap.size,
            linkCount: filteredLinks.length
          }
        }
      };

      logger.info('Sending graph response', {
        nodeCount: nodes.length,
        linkCount: filteredLinks.length,
        tagCount: tagMap.size,
        mode
      });

      res.json(responseData);

    } catch (error) {
      logger.error('Get graph data error:', error);
      next(error);
    }
  }

  /**
   * Generate video access token
   * @route GET /api/v1/tenants/:tenantId/processes/:id/video-token
   * @access Private
   */
  async generateVideoToken(req, res, next) {
    try {
      const { tenantId, id } = req.params;

      // Verify process exists and user has access
      const process = await Process.findOne({
        _id: id,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      // Check if video is available in S3
      if (!process.files?.processed?.path || process.files.processed.storageType !== 's3') {
        return res.status(404).json({
          success: false,
          message: 'Video not available in cloud storage. Processing might still be in progress.'
        });
      }

      // Generate video-specific token (60 minutes expiration)
      const videoToken = videoTokenService.generateVideoToken(id, tenantId, 60);

      logger.info('Video token generated', {
        processId: id,
        tenantId,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          token: videoToken,
          expiresIn: 3600 // 60 minutes in seconds
        }
      });

    } catch (error) {
      logger.error('Generate video token error:', error);
      next(error);
    }
  }

  /**
   * Stream video file with token authentication
   * @route GET /api/v1/tenants/:tenantId/processes/:id/video
   * @access Video Token Required
   */
  async getVideo(req, res, next) {
    try {
      const { id } = req.params;
      const range = req.headers.range;

      // Video token authentication is handled by middleware
      // req.videoAuth contains { processId, tenantId }
      const { processId, tenantId } = req.videoAuth;

      // Verify the process ID matches
      if (processId !== id) {
        return res.status(403).json({
          success: false,
          message: 'Token process ID mismatch'
        });
      }

      // Find the process
      const process = await Process.findOne({
        _id: processId,
        tenantId,
        isDeleted: false
      });

      if (!process) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      // Check if video file exists in S3 (S3-only, no local fallback)
      const videoS3Key = process.files.processed?.path;
      
      if (!videoS3Key || process.files.processed.storageType !== 's3') {
        // Check if video is still being processed
        if (process.status === 'processing_media' || process.status === 'compressing') {
          return res.status(202).json({
            success: false,
            message: 'Video is still being processed. Please try again later.',
            status: process.status,
            progress: process.progress
          });
        }
        
        return res.status(404).json({
          success: false,
          message: 'Video not available in cloud storage',
          status: process.status
        });
      }

      // Check if file exists in S3
      try {
        const fileExists = await getS3Service().fileExists(videoS3Key);
        if (!fileExists) {
          throw new Error('File not found in S3');
        }
      } catch (err) {
        logger.error('Video file not found in S3:', { 
          processId: id, 
          s3Key: videoS3Key,
          processStatus: process.status,
          error: err.message 
        });
        
        return res.status(404).json({
          success: false,
          message: 'Video file not found in storage. It may have been deleted or processing failed.',
          needsReprocessing: true
        });
      }

      // Get file metadata from S3
      const fileMetadata = await getS3Service().getFileMetadata(videoS3Key);
      const fileSize = fileMetadata.size;
      const contentType = fileMetadata.contentType || 'video/mp4';

      // Set CORS headers for video streaming
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // For S3 streaming, generate a pre-signed URL and redirect
      // This is more efficient than proxying the stream through our server
      try {
        const presignedUrl = await getS3Service().generateVideoStreamUrl(videoS3Key, 3600); // 1 hour expiry
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Redirect to pre-signed URL for direct S3 access
        res.redirect(302, presignedUrl);
        
        logger.info('Video stream redirect to S3', {
          processId: id,
          s3Key: videoS3Key,
          hasRange: !!range
        });
        
      } catch (error) {
        logger.error('Failed to generate S3 stream URL', {
          processId: id,
          s3Key: videoS3Key,
          error: error.message
        });
        
        return res.status(500).json({
          success: false,
          message: 'Failed to generate video stream URL'
        });
      }

    } catch (error) {
      logger.error('Get video error:', error);
      next(error);
    }
  }

  /**
   * Finalize chunked upload
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware
   */
  async finalizeChunkedUpload(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { id: userId } = req.user;
      const { uploadId, filename, fileSize, mimeType } = req.body;

      logger.info('Finalizing chunked upload', {
        tenantId,
        userId,
        uploadId,
        filename,
        fileSize
      });

      // Import chunk middleware functions
      const { mergeChunks } = require('../middleware/chunkUploadMiddleware');

      // Generate process ID
      const mongoose = require('mongoose');
      const processId = new mongoose.Types.ObjectId().toString();
      
      // Setup output path
      const uploadDir = path.join(
        process.env.UPLOAD_DIR || './uploads/temp',
        tenantId,
        processId
      );
      const outputPath = path.join(uploadDir, `${processId}_${Date.now()}_merged.mp4`);

      // Merge chunks
      await mergeChunks(tenantId, uploadId, outputPath);

      // Create req.file object to match normal upload flow
      // Import fs.promises for async file operations
      const fsPromises = require('fs').promises;
      
      req.file = {
        fieldname: 'video',
        originalname: filename,
        mimetype: mimeType,
        path: outputPath,
        size: fileSize || (await fsPromises.stat(outputPath)).size,
        destination: uploadDir,
        filename: path.basename(outputPath)
      };

      req.processId = processId;
      req.uploadDir = uploadDir;
      req.originalFilename = filename;

      // Continue with normal processing
      logger.info('Chunked upload merged successfully, continuing with normal flow');
      
      // Recursively call createProcess with the merged file
      req.body = {}; // Clear body to avoid infinite loop
      return this.createProcess(req, res, next);

    } catch (error) {
      logger.error('Finalize chunked upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to finalize upload',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new ProcessController();