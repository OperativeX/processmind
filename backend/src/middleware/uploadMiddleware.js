const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Base upload directory
const uploadBaseDir = process.env.UPLOAD_DIR || './uploads/temp';
if (!fs.existsSync(uploadBaseDir)) {
  fs.mkdirSync(uploadBaseDir, { recursive: true });
}

// Configure multer storage with dynamic tenant/process paths
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Get tenantId and generate processId if not present
      const tenantId = req.user?.tenantId || req.params.tenantId;
      const processId = req.body?.processId || req.processId || uuidv4();
      
      // Create tenant and process specific directory
      const uploadDir = tenantId && processId 
        ? path.join(uploadBaseDir, tenantId, processId)
        : uploadBaseDir;
      
      // Ensure directory exists
      await fs.promises.mkdir(uploadDir, { recursive: true });
      
      // Store processId in request for later use (but NOT in body to avoid MongoDB issues)
      req.processId = processId;
      req.uploadDir = uploadDir;
      
      // IMPORTANT: Remove processId from body to prevent MongoDB casting errors
      if (req.body) {
        delete req.body.processId;
        delete req.body._id;
      }
      
      logger.info('Upload directory prepared', { 
        tenantId, 
        processId, 
        uploadDir 
      });
      
      cb(null, uploadDir);
    } catch (error) {
      logger.error('Error creating upload directory', error);
      cb(error);
    }
  },
  
  filename: (req, file, cb) => {
    // Generate unique filename with process prefix
    const processId = req.processId || uuidv4();
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    // Include processId in filename for safety
    const filename = `${processId}_${timestamp}_${uniqueId}${fileExtension}`;
    
    // Store original filename for later use
    req.originalFilename = file.originalname;
    req.uploadTimestamp = timestamp;
    
    cb(null, filename);
  }
});

// File filter to allow only video files
const fileFilter = (req, file, cb) => {
  // Allowed video MIME types
  const allowedMimeTypes = [
    'video/mp4',
    'video/avi',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/x-ms-wmv', // .wmv
    'video/webm',
    'video/ogg',
    'video/3gpp',
    'video/x-flv'
  ];

  // Allowed file extensions
  const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.ogg', '.3gp', '.flv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check MIME type and extension
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    logger.info(`Video upload accepted:`, {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    cb(null, true);
  } else {
    logger.warn(`Video upload rejected:`, {
      filename: file.originalname,
      mimetype: file.mimetype,
      extension: fileExtension
    });
    cb(new Error(`Invalid file type. Allowed formats: ${allowedExtensions.join(', ')}`), false);
  }
};

// Configure multer for large file uploads with enhanced buffer settings
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024, // 2GB default
    files: 1, // Only allow one file at a time
    fieldSize: 100 * 1024 * 1024, // 100MB field size limit
    parts: 1000, // Maximum number of multipart parts
    fieldNameSize: 1000, // Max field name size
    fields: 50 // Max number of non-file fields
  }
});

// Error handling middleware for multer errors
const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer upload error:', {
      error: error.message,
      code: error.code,
      field: error.field
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: `File too large. Maximum size allowed: ${(parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)}GB`
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one video file allowed at a time'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use "video" as the field name'
        });
      
      default:
        return res.status(400).json({
          success: false,
          message: error.message
        });
    }
  } else if (error) {
    logger.error('Upload error:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
};

// Safe cleanup function to remove uploaded file on error
const cleanupUploadedFile = async (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }
    
    // Validate path is within upload directory
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(uploadBaseDir);
    const relative = path.relative(resolvedBase, resolvedPath);
    
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      logger.error('Attempted to delete file outside upload directory', { filePath });
      return;
    }
    
    await fs.promises.unlink(filePath);
    logger.info('Cleaned up uploaded file', { filePath });
    
    // Try to clean up empty parent directories
    const dir = path.dirname(filePath);
    if (dir !== uploadBaseDir && dir.startsWith(resolvedBase)) {
      try {
        // Check if directory is empty
        const files = await fs.promises.readdir(dir);
        if (files.length === 0) {
          await fs.promises.rmdir(dir);
          logger.debug('Removed empty directory', { dir });
          
          // Try to clean parent directory too (tenantId level)
          const parentDir = path.dirname(dir);
          if (parentDir !== uploadBaseDir && parentDir.startsWith(resolvedBase)) {
            const parentFiles = await fs.promises.readdir(parentDir);
            if (parentFiles.length === 0) {
              await fs.promises.rmdir(parentDir);
              logger.debug('Removed empty tenant directory', { parentDir });
            }
          }
        }
      } catch (err) {
        // Ignore errors when cleaning directories
        logger.debug('Could not clean empty directories', { error: err.message });
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup uploaded file', { 
      filePath, 
      error: error.message 
    });
  }
};

// Enhanced upload middleware (local storage only)
const uploadMiddleware = {
  single: (fieldName) => {
    return [
      upload.single(fieldName),
      handleUploadErrors,
      (req, res, next) => {
        // Add cleanup function to request for later use
        req.cleanupUploadedFile = async () => {
          if (req.file) {
            await cleanupUploadedFile(req.file.path);
          }
        };
        
        // CRITICAL: Clean up req.body to prevent MongoDB errors
        if (req.body) {
          delete req.body.processId;
          delete req.body._id;
        }
        
        // Log successful upload with tenant/process info
        if (req.file) {
          logger.info('File uploaded successfully:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            path: req.file.path,
            tenantId: req.user?.tenantId || req.params.tenantId,
            processId: req.processId,
            uploadDir: req.uploadDir
          });
        }
        
        next();
      }
    ];
  }
};

module.exports = uploadMiddleware;