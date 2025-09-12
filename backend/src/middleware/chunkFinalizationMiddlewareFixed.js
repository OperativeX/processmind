const busboy = require('busboy');
const logger = require('../utils/logger');

/**
 * Improved middleware to detect and handle chunk finalization requests
 * Buffers the stream so it can be reused if needed
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

  // Buffer the request data
  const chunks = [];
  let totalLength = 0;
  
  req.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;
  });

  req.on('end', () => {
    // Reconstruct the full body
    const buffer = Buffer.concat(chunks, totalLength);
    
    // Create a new readable stream from the buffer
    const { Readable } = require('stream');
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    
    // Parse with busboy
    const bb = busboy({ headers: req.headers });
    const fields = {};
    let hasFile = false;
    let finished = false;

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', () => {
      hasFile = true;
    });

    bb.on('finish', () => {
      if (!finished) {
        finished = true;
        
        if (fields.uploadId && !hasFile) {
          // This is a chunk finalization request
          logger.info('Detected chunk finalization request', {
            uploadId: fields.uploadId,
            filename: fields.filename,
            fileSize: fields.fileSize
          });
          
          req.body = fields;
          req.isChunkFinalization = true;
          next();
        } else {
          // Not a chunk finalization, restore the stream for next middleware
          req.removeAllListeners('data');
          req.removeAllListeners('end');
          
          // Replace req with a new readable stream
          const restoredStream = new Readable();
          restoredStream.push(buffer);
          restoredStream.push(null);
          
          // Copy properties from original request
          Object.keys(req).forEach(key => {
            if (key !== '_readableState' && key !== '_events' && key !== '_eventsCount') {
              restoredStream[key] = req[key];
            }
          });
          
          // Use the restored stream for the next middleware
          Object.setPrototypeOf(restoredStream, Object.getPrototypeOf(req));
          
          // Continue to next middleware with restored stream
          next();
        }
      }
    });

    bb.on('error', (error) => {
      logger.error('Busboy error in chunk finalization check:', error);
      if (!finished) {
        finished = true;
        next(error);
      }
    });

    // Pipe the buffered data to busboy
    readableStream.pipe(bb);
  });

  req.on('error', (error) => {
    logger.error('Request stream error:', error);
    next(error);
  });
};

module.exports = chunkFinalizationMiddleware;