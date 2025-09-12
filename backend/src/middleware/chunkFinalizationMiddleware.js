const busboy = require('busboy');
const logger = require('../utils/logger');

/**
 * Middleware to detect and handle chunk finalization requests
 * Must run before streamingUploadMiddleware
 */
const chunkFinalizationMiddleware = (req, res, next) => {
  // Only process multipart/form-data
  if (!req.is('multipart/form-data')) {
    return next();
  }

  // Check content length - finalization requests are typically small
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  // If content is over 1MB, it's likely a regular upload
  if (contentLength > 1024 * 1024) {
    return next();
  }

  logger.info('Checking for chunk finalization request', {
    contentLength,
    method: req.method,
    url: req.url
  });

  // Parse the form data
  const bb = busboy({ headers: req.headers });
  const fields = {};
  let hasFile = false;
  let finished = false;

  bb.on('field', (name, value) => {
    fields[name] = value;
  });

  bb.on('file', () => {
    hasFile = true;
    // If we detect a file, stop processing and pass to next middleware
    if (!finished) {
      finished = true;
      req.unpipe(bb);
      next();
    }
  });

  bb.on('finish', () => {
    if (!finished) {
      finished = true;
      
      if (fields.uploadId && !hasFile && fields.filename && fields.fileSize && fields.mimeType) {
        // This is a chunk finalization request - requires all finalization fields
        logger.info('Detected chunk finalization request', {
          uploadId: fields.uploadId,
          filename: fields.filename,
          fileSize: fields.fileSize
        });
        
        req.body = fields;
        req.isChunkFinalization = true;
        next();
      } else {
        // Not a chunk finalization, continue to next middleware
        logger.info('Not a chunk finalization, passing to next middleware', {
          hasUploadId: !!fields.uploadId,
          hasFile: hasFile,
          hasFilename: !!fields.filename,
          hasFileSize: !!fields.fileSize,
          hasMimeType: !!fields.mimeType
        });
        next();
      }
    }
  });

  bb.on('error', (error) => {
    logger.error('Busboy error in chunk finalization check:', error);
    if (!finished) {
      finished = true;
      next();
    }
  });

  // Pipe request to busboy
  req.pipe(bb);
};

module.exports = chunkFinalizationMiddleware;