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
    // Check content type
    if (!req.is('multipart/form-data')) {
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

    // Track upload progress
    const progressInterval = setInterval(() => {
      if (uploadedBytes > 0 && !uploadAborted) {
        const progress = ((uploadedBytes / req.headers['content-length']) * 100).toFixed(2);
        logger.debug(`Upload progress: ${progress}% (${(uploadedBytes / 1024 / 1024).toFixed(2)}MB)`, {
          uploadId,
          tenantId: req.user?.tenantId
        });
      }
    }, 5000); // Log every 5 seconds

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

        // Validate field name
        if (name !== fieldName) {
          stream.resume(); // Drain stream
          return reject(new Error(`Invalid field name. Expected '${fieldName}'`));
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
        if (!req.file && !uploadAborted) {
          reject(new Error('No file uploaded'));
        }
      });

      // Handle client disconnect
      req.on('aborted', () => {
        logger.warn('Upload aborted by client', { uploadId });
        uploadAborted = true;
        cleanup();
        reject(new Error('Upload aborted by client'));
      });

      req.on('close', () => {
        if (!req.complete) {
          uploadAborted = true;
          cleanup();
        }
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