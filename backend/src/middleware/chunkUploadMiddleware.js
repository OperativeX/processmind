const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Base directory for chunk storage
const CHUNKS_DIR = process.env.CHUNKS_DIR || './uploads/chunks';

// Use disk storage for better memory efficiency
// Note: We still need to handle the file first, then parse fields
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Create a temporary unique directory first
      const tenantId = req.params.tenantId || req.user?.tenantId;
      const tempId = uuidv4();
      const tempDir = path.join(CHUNKS_DIR, tenantId, 'temp', tempId);
      
      // Ensure directory exists
      await fs.mkdir(tempDir, { recursive: true });
      
      // Store temp path for later use
      req.tempChunkPath = tempDir;
      
      cb(null, tempDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use a temporary filename
    cb(null, 'chunk.tmp');
  }
});

// File filter for chunks
const fileFilter = (req, file, cb) => {
  // Accept any chunk since we'll validate the complete file later
  cb(null, true);
};

// Create multer instance for chunks
const chunkUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per chunk (safety limit)
    fields: 10,
    files: 1
  }
});

/**
 * Middleware to handle chunk uploads
 */
const handleChunkUpload = chunkUpload.single('chunk');

/**
 * Middleware to validate chunk upload data
 */
const validateChunkUpload = async (req, res, next) => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename } = req.body;
    
    // Validate required fields
    if (!uploadId || chunkIndex === undefined || !totalChunks || !filename) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: uploadId, chunkIndex, totalChunks, filename'
      });
    }

    // Validate chunk index
    const index = parseInt(chunkIndex);
    const total = parseInt(totalChunks);
    
    if (isNaN(index) || isNaN(total) || index < 0 || index >= total) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chunk index or total chunks'
      });
    }

    // Store parsed values
    req.chunkData = {
      uploadId,
      chunkIndex: index,
      totalChunks: total,
      filename
    };

    next();
  } catch (error) {
    logger.error('Chunk validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Chunk validation failed'
    });
  }
};

/**
 * Process uploaded chunk
 */
const processChunk = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No chunk file provided'
      });
    }

    const { uploadId, chunkIndex, totalChunks } = req.chunkData;
    const tenantId = req.params.tenantId || req.user?.tenantId;

    // Create proper chunk directory
    const chunkDir = path.join(CHUNKS_DIR, tenantId, uploadId);
    await fs.mkdir(chunkDir, { recursive: true });

    // Move chunk from temp location to proper location
    const tempPath = req.file.path;
    const chunkFilename = `chunk_${String(chunkIndex).padStart(6, '0')}.part`;
    const chunkPath = path.join(chunkDir, chunkFilename);
    
    // Move the file
    await fs.rename(tempPath, chunkPath);
    
    // Clean up temp directory
    try {
      await fs.rmdir(req.tempChunkPath);
    } catch (e) {
      // Ignore cleanup errors
    }

    logger.info('Chunk saved:', {
      uploadId,
      chunkIndex,
      totalChunks,
      size: req.file.size,
      tenantId,
      path: chunkPath
    });

    // Check if all chunks are uploaded
    const files = await fs.readdir(chunkDir);
    const uploadedChunks = files.filter(f => f.endsWith('.part')).length;

    res.json({
      success: true,
      data: {
        uploadId,
        chunkIndex,
        uploadedChunks,
        totalChunks,
        isComplete: uploadedChunks === totalChunks
      }
    });
  } catch (error) {
    logger.error('Process chunk error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chunk',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Merge all chunks into a single file
 */
const mergeChunks = async (tenantId, uploadId, outputPath) => {
  try {
    const chunkDir = path.join(CHUNKS_DIR, tenantId, uploadId);
    const files = await fs.readdir(chunkDir);
    
    // Filter and sort chunk files
    const chunkFiles = files
      .filter(f => f.endsWith('.part'))
      .sort(); // Works because of zero-padded naming

    if (chunkFiles.length === 0) {
      throw new Error('No chunks found for upload');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Create write stream for output
    const writeStream = require('fs').createWriteStream(outputPath);

    // Merge chunks using streams (no memory buffering)
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkPath = path.join(chunkDir, chunkFiles[i]);
      const readStream = require('fs').createReadStream(chunkPath);
      
      await new Promise((resolve, reject) => {
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }

    // Close the write stream
    await new Promise((resolve, reject) => {
      writeStream.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Clean up chunks after successful merge
    await cleanupChunks(tenantId, uploadId);

    logger.info('Chunks merged successfully:', {
      tenantId,
      uploadId,
      outputPath,
      totalChunks: chunkFiles.length
    });

    return true;
  } catch (error) {
    logger.error('Merge chunks error:', error);
    throw error;
  }
};

/**
 * Clean up chunk files
 */
const cleanupChunks = async (tenantId, uploadId) => {
  try {
    const chunkDir = path.join(CHUNKS_DIR, tenantId, uploadId);
    
    // Remove all files in chunk directory
    const files = await fs.readdir(chunkDir);
    for (const file of files) {
      await fs.unlink(path.join(chunkDir, file));
    }
    
    // Remove the directory
    await fs.rmdir(chunkDir);
    
    logger.info('Cleaned up chunks:', { tenantId, uploadId });
  } catch (error) {
    logger.error('Cleanup chunks error:', error);
    // Don't throw - cleanup errors shouldn't break the flow
  }
};

/**
 * Clean up old/abandoned chunk uploads
 */
const cleanupAbandonedChunks = async () => {
  try {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    // Check all tenant directories
    const tenantDirs = await fs.readdir(CHUNKS_DIR).catch(() => []);
    
    for (const tenantDir of tenantDirs) {
      const tenantPath = path.join(CHUNKS_DIR, tenantDir);
      const stat = await fs.stat(tenantPath);
      
      if (!stat.isDirectory()) continue;

      // Check all upload directories
      const uploadDirs = await fs.readdir(tenantPath);
      
      for (const uploadDir of uploadDirs) {
        const uploadPath = path.join(tenantPath, uploadDir);
        const uploadStat = await fs.stat(uploadPath);
        
        // If older than maxAge, remove it
        if (now - uploadStat.mtimeMs > maxAge) {
          await cleanupChunks(tenantDir, uploadDir);
          logger.info('Cleaned up abandoned chunks:', {
            tenantId: tenantDir,
            uploadId: uploadDir,
            age: Math.round((now - uploadStat.mtimeMs) / 1000 / 60 / 60) + ' hours'
          });
        }
      }
    }
  } catch (error) {
    logger.error('Cleanup abandoned chunks error:', error);
  }
};

// Run cleanup every 6 hours
setInterval(cleanupAbandonedChunks, 6 * 60 * 60 * 1000);

module.exports = {
  handleChunkUpload,
  validateChunkUpload,
  processChunk,
  mergeChunks,
  cleanupChunks
};