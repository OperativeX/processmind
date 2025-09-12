const busboy = require('busboy');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Base upload directory
const uploadBaseDir = process.env.UPLOAD_DIR || './uploads/temp';

/**
 * Streaming upload middleware using busboy for better memory efficiency
 * Handles large file uploads without loading entire file into memory
 */
const streamingUploadMiddleware = (options = {}) => {
  return async (req, res, next) => {
    logger.info('StreamingUploadMiddleware called', {
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      method: req.method,
      url: req.url
    });
    
    // Skip if this is a chunk finalization request
    if (req.isChunkFinalization) {
      logger.info('Chunk finalization detected, skipping streaming upload');
      return next();
    }
    
    // Check content type
    if (!req.is('multipart/form-data')) {
      logger.warn('Not multipart/form-data, skipping streaming upload');
      return next();
    }

    const {
      maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024, // 2GB default
      allowedMimeTypes = [
        'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo',
        'video/x-ms-wmv', 'video/webm', 'video/ogg', 'video/3gpp', 'video/x-flv'
      ],
      allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.ogg', '.3gp', '.flv'],
      fieldName = 'video'
    } = options;

    // Initialize upload tracking
    const uploadId = uuidv4();
    const uploadStart = Date.now();
    let uploadedBytes = 0;
    let fileStream = null;
    let uploadPath = null;
    let uploadAborted = false;

    // Create busboy instance with limits
    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: maxFileSize,
        files: 1,
        fields: 50,
        fieldSize: 1024 * 1024 // 1MB for fields
      }
    });

    // Track upload progress with more detailed logging
    const progressInterval = setInterval(() => {
      if (uploadedBytes > 0 && !uploadAborted) {
        const totalSize = parseInt(req.headers['content-length']) || 0;
        const progress = totalSize > 0 ? ((uploadedBytes / totalSize) * 100).toFixed(2) : 0;
        const uploadSpeedMBps = uploadedBytes > 0 ? 
          (uploadedBytes / 1024 / 1024) / ((Date.now() - uploadStart) / 1000) : 0;
        
        logger.info(`Upload progress`, {
          uploadId,
          tenantId: req.user?.tenantId,
          progress: `${progress}%`,
          uploadedMB: (uploadedBytes / 1024 / 1024).toFixed(2),
          totalMB: (totalSize / 1024 / 1024).toFixed(2),
          speedMBps: uploadSpeedMBps.toFixed(2),
          elapsedSeconds: Math.round((Date.now() - uploadStart) / 1000)
        });
      }
    }, 10000); // Log every 10 seconds for production

    // Promise to handle upload completion
    const uploadPromise = new Promise((resolve, reject) => {
      const cleanup = async () => {
        clearInterval(progressInterval);
        if (fileStream && !fileStream.destroyed) {
          fileStream.destroy();
        }
        if (uploadPath && uploadAborted) {
          try {
            await fs.promises.unlink(uploadPath);
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      };

      // Handle file upload
      bb.on('file', async (name, stream, info) => {
        const { filename, encoding, mimeType } = info;
        
        logger.info('File upload started:', {
          receivedFieldName: name,
          expectedFieldName: fieldName,
          filename: filename,
          mimeType: mimeType,
          fieldMatches: name === fieldName
        });

        // Validate field name
        if (name !== fieldName) {
          logger.error('Field name mismatch:', { 
            received: name, 
            expected: fieldName 
          });
          stream.resume(); // Drain stream
          return reject(new Error(`Invalid field name. Expected '${fieldName}', got '${name}'`));
        }

        // Validate mime type
        if (!allowedMimeTypes.includes(mimeType)) {
          stream.resume();
          return reject(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
        }

        // Validate extension
        const fileExtension = path.extname(filename).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
          stream.resume();
          return reject(new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`));
        }

        try {
          // Setup upload directory
          const tenantId = req.user?.tenantId || req.params.tenantId;
          const processId = req.processId || uuidv4();
          const uploadDir = path.join(uploadBaseDir, tenantId, processId);

          await fs.promises.mkdir(uploadDir, { recursive: true });

          // Generate secure filename
          const timestamp = Date.now();
          const secureFilename = `${processId}_${timestamp}_${uuidv4()}${fileExtension}`;
          uploadPath = path.join(uploadDir, secureFilename);

          // Create write stream with optimized settings
          fileStream = fs.createWriteStream(uploadPath, {
            flags: 'w',
            highWaterMark: 64 * 1024 // 64KB chunks
          });

          // Calculate hash while streaming
          const hash = crypto.createHash('sha256');

          // Handle stream events
          stream.on('data', (chunk) => {
            uploadedBytes += chunk.length;
            hash.update(chunk);

            // Check file size limit
            if (uploadedBytes > maxFileSize) {
              uploadAborted = true;
              stream.destroy();
              fileStream.destroy();
              reject(new Error(`File too large. Maximum size: ${(maxFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`));
            }
          });

          stream.on('error', (error) => {
            logger.error('Upload stream error:', error);
            uploadAborted = true;
            cleanup();
            reject(error);
          });

          stream.on('limit', () => {
            uploadAborted = true;
            cleanup();
            reject(new Error(`File too large. Maximum size: ${(maxFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`));
          });

          fileStream.on('error', (error) => {
            logger.error('File write error:', error);
            uploadAborted = true;
            cleanup();
            reject(error);
          });

          fileStream.on('finish', () => {
            if (!uploadAborted) {
              const fileHash = hash.digest('hex');
              const uploadDuration = Date.now() - uploadStart;
              const uploadSpeedMBps = (uploadedBytes / 1024 / 1024) / (uploadDuration / 1000);

              req.file = {
                fieldname: name,
                originalname: filename,
                encoding,
                mimetype: mimeType,
                destination: uploadDir,
                filename: secureFilename,
                path: uploadPath,
                size: uploadedBytes,
                hash: fileHash
              };

              req.processId = processId;
              req.uploadDir = uploadDir;
              req.originalFilename = filename;
              req.uploadStats = {
                duration: uploadDuration,
                speedMBps: uploadSpeedMBps.toFixed(2),
                uploadId
              };

              logger.info('Streaming upload completed', {
                uploadId,
                originalName: filename,
                size: uploadedBytes,
                duration: uploadDuration,
                speedMBps: uploadSpeedMBps.toFixed(2),
                hash: fileHash,
                tenantId
              });

              cleanup();
              resolve();
            }
          });

          // Pipe the upload stream to file
          stream.pipe(fileStream);

        } catch (error) {
          uploadAborted = true;
          stream.resume();
          cleanup();
          reject(error);
        }
      });

      // Handle fields
      bb.on('field', (name, value) => {
        if (req.body) {
          req.body[name] = value;
        } else {
          req.body = { [name]: value };
        }
      });

      // Handle errors
      bb.on('error', (error) => {
        logger.error('Busboy error:', error);
        uploadAborted = true;
        cleanup();
        reject(error);
      });

      // Handle finish
      bb.on('finish', () => {
        // The file check is done in the file stream 'finish' event
        // No need to check here as it causes race conditions
      });

      // Handle client disconnect with enhanced logging
      req.on('aborted', () => {
        logger.warn('Upload aborted by client', { 
          uploadId,
          uploadedBytes,
          totalSize: req.headers['content-length'],
          progress: req.headers['content-length'] ? 
            ((uploadedBytes / parseInt(req.headers['content-length'])) * 100).toFixed(2) + '%' : 'unknown'
        });
        uploadAborted = true;
        cleanup();
        reject(new Error('Upload aborted by client'));
      });

      req.on('close', () => {
        if (!req.complete) {
          logger.warn('Connection closed unexpectedly', {
            uploadId,
            uploadedBytes,
            complete: req.complete
          });
          uploadAborted = true;
          cleanup();
        }
      });

      // Handle connection errors
      req.on('error', (error) => {
        logger.error('Request stream error:', { 
          uploadId, 
          error: error.message,
          uploadedBytes 
        });
        uploadAborted = true;
        cleanup();
        reject(error);
      });
    });

    // Pipe request to busboy
    req.pipe(bb);

    try {
      await uploadPromise;

      // Add cleanup function to request
      req.cleanupUploadedFile = async () => {
        if (req.file && req.file.path) {
          try {
            await fs.promises.unlink(req.file.path);
            logger.info('Cleaned up uploaded file', { path: req.file.path });
          } catch (error) {
            logger.error('Failed to cleanup uploaded file:', error);
          }
        }
      };

      next();
    } catch (error) {
      clearInterval(progressInterval);
      
      logger.error('StreamingUploadMiddleware error:', {
        error: error.message,
        stack: error.stack,
        uploadId: uploadId || 'unknown',
        tenantId: req.params?.tenantId,
        userId: req.user?.id
      });
      
      // Clean up partial upload
      if (uploadPath && fs.existsSync(uploadPath)) {
        try {
          await fs.promises.unlink(uploadPath);
        } catch (cleanupError) {
          logger.error('Failed to cleanup partial upload:', cleanupError);
        }
      }

      // Send appropriate error response
      if (error.message.includes('too large')) {
        return res.status(413).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('Invalid file')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Upload failed',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  };
};

module.exports = streamingUploadMiddleware;