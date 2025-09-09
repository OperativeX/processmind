const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class S3Service {
  constructor() {
    // Configure S3 client for Hetzner Object Storage
    this.s3 = new AWS.S3({
      endpoint: process.env.S3_ENDPOINT, // e.g., https://fsn1.your-objectstorage.com
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      region: 'us-east-1', // Use standard region for Hetzner
      s3ForcePathStyle: true, // Required for non-AWS S3
      signatureVersion: 'v4',
      httpOptions: {
        timeout: 30000
      }
    });

    this.bucket = process.env.S3_BUCKET;
    
    if (!this.bucket) {
      logger.error('S3_BUCKET environment variable is required');
      throw new Error('S3_BUCKET environment variable is required');
    }

    logger.info('S3 Service initialized', {
      endpoint: process.env.S3_ENDPOINT,
      bucket: this.bucket,
      region: 'us-east-1'
    });
  }

  /**
   * Test S3 connection and credentials
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      // Try to list objects in bucket (minimal operation to test connection)
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      logger.info('S3 connection test successful', { bucket: this.bucket });
      return true;
    } catch (error) {
      logger.error('S3 connection test failed', {
        bucket: this.bucket,
        error: error.message,
        code: error.code
      });
      return false;
    }
  }

  /**
   * Upload file to S3
   * @param {string} localFilePath - Path to local file
   * @param {string} s3Key - S3 object key
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(localFilePath, s3Key, metadata = {}) {
    try {
      logger.info('Starting S3 upload', {
        localPath: localFilePath,
        s3Key,
        bucket: this.bucket
      });

      // Check if local file exists
      if (!fs.existsSync(localFilePath)) {
        throw new Error(`Local file not found: ${localFilePath}`);
      }

      const fileStats = await fs.promises.stat(localFilePath);
      const fileStream = fs.createReadStream(localFilePath);

      // Determine content type based on file extension
      const contentType = this.getContentType(localFilePath);

      const uploadParams = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType,
        Metadata: {
          originalName: metadata.originalName || path.basename(localFilePath),
          uploadedBy: metadata.userId || 'unknown',
          tenantId: metadata.tenantId || 'unknown',
          processId: metadata.processId || 'unknown',
          ...metadata
        }
      };

      const result = await this.s3.upload(uploadParams).promise();

      logger.info('S3 upload completed', {
        s3Key,
        bucket: this.bucket,
        location: result.Location,
        etag: result.ETag,
        size: fileStats.size
      });

      return {
        success: true,
        location: result.Location,
        etag: result.ETag,
        key: s3Key,
        bucket: this.bucket,
        size: fileStats.size,
        contentType
      };

    } catch (error) {
      logger.error('S3 upload failed', {
        localPath: localFilePath,
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Download file from S3 to local filesystem
   * @param {string} s3Key - S3 object key
   * @param {string} localFilePath - Local file destination
   * @returns {Promise<Object>} Download result
   */
  async downloadFile(s3Key, localFilePath) {
    try {
      logger.info('Starting S3 download', {
        s3Key,
        localPath: localFilePath,
        bucket: this.bucket
      });

      // Ensure local directory exists
      const localDir = path.dirname(localFilePath);
      await fs.promises.mkdir(localDir, { recursive: true });

      const downloadParams = {
        Bucket: this.bucket,
        Key: s3Key
      };

      const data = await this.s3.getObject(downloadParams).promise();
      await fs.promises.writeFile(localFilePath, data.Body);

      const fileStats = await fs.promises.stat(localFilePath);

      logger.info('S3 download completed', {
        s3Key,
        localPath: localFilePath,
        size: fileStats.size
      });

      return {
        success: true,
        localPath: localFilePath,
        size: fileStats.size,
        metadata: data.Metadata
      };

    } catch (error) {
      logger.error('S3 download failed', {
        s3Key,
        localPath: localFilePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(s3Key) {
    try {
      logger.info('Starting S3 delete', {
        s3Key,
        bucket: this.bucket
      });

      const deleteParams = {
        Bucket: this.bucket,
        Key: s3Key
      };

      await this.s3.deleteObject(deleteParams).promise();

      logger.info('S3 delete completed', {
        s3Key,
        bucket: this.bucket
      });

      return {
        success: true,
        deleted: s3Key
      };

    } catch (error) {
      logger.error('S3 delete failed', {
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate pre-signed URL for temporary access
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @param {string} operation - Operation type ('getObject' or 'putObject')
   * @returns {Promise<string>} Pre-signed URL
   */
  async generatePresignedUrl(s3Key, expiresIn = 3600, operation = 'getObject') {
    try {
      const params = {
        Bucket: this.bucket,
        Key: s3Key,
        Expires: expiresIn
      };

      const url = await this.s3.getSignedUrlPromise(operation, params);

      logger.debug('Pre-signed URL generated', {
        s3Key,
        operation,
        expiresIn
      });

      return url;

    } catch (error) {
      logger.error('Pre-signed URL generation failed', {
        s3Key,
        operation,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(s3Key) {
    try {
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: s3Key
      }).promise();
      
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(s3Key) {
    try {
      const result = await this.s3.headObject({
        Bucket: this.bucket,
        Key: s3Key
      }).promise();

      return {
        key: s3Key,
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };

    } catch (error) {
      logger.error('Get file metadata failed', {
        s3Key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List files in S3 bucket with prefix
   * @param {string} prefix - S3 key prefix
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles(prefix = '', maxKeys = 1000) {
    try {
      const listParams = {
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      };

      const result = await this.s3.listObjectsV2(listParams).promise();

      return result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      }));

    } catch (error) {
      logger.error('List S3 files failed', {
        prefix,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} filePath - File path
   * @returns {string} MIME type
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.ogg': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.m4v': 'video/mp4',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.flv': 'video/x-flv',
      '.wmv': 'video/x-ms-wmv',
      '.3gp': 'video/3gpp'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate S3 key for uploaded file
   * @param {string} tenantId - Tenant ID
   * @param {string} processId - Process ID
   * @param {string} filename - File name
   * @param {string} type - File type (original, processed, audio, etc.)
   * @returns {string} S3 key
   */
  generateS3Key(tenantId, processId, filename, type = 'original') {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `tenants/${tenantId}/processes/${processId}/${type}/${sanitizedFilename}`;
  }

  /**
   * Generate temporary download URL for video streaming
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} Temporary URL
   */
  async generateVideoStreamUrl(s3Key, expiresIn = 3600) {
    return this.generatePresignedUrl(s3Key, expiresIn, 'getObject');
  }

  /**
   * Copy file within S3 bucket
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   * @returns {Promise<Object>} Copy result
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      logger.info('Starting S3 copy', {
        sourceKey,
        destinationKey,
        bucket: this.bucket
      });

      const copyParams = {
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey
      };

      const result = await this.s3.copyObject(copyParams).promise();

      logger.info('S3 copy completed', {
        sourceKey,
        destinationKey,
        etag: result.CopyObjectResult.ETag
      });

      return {
        success: true,
        sourceKey,
        destinationKey,
        etag: result.CopyObjectResult.ETag
      };

    } catch (error) {
      logger.error('S3 copy failed', {
        sourceKey,
        destinationKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get storage usage for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Storage usage statistics
   */
  async getTenantStorageUsage(tenantId) {
    try {
      const prefix = `tenants/${tenantId}/`;
      const files = await this.listFiles(prefix);

      let totalSize = 0;
      let filesByType = {
        videos: { count: 0, size: 0 },
        audio: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      };

      files.forEach(file => {
        totalSize += file.size;

        if (file.key.includes('/original/') || file.key.includes('/processed/')) {
          const ext = path.extname(file.key).toLowerCase();
          if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
            filesByType.videos.count++;
            filesByType.videos.size += file.size;
          } else {
            filesByType.other.count++;
            filesByType.other.size += file.size;
          }
        } else if (file.key.includes('/audio/')) {
          filesByType.audio.count++;
          filesByType.audio.size += file.size;
        } else {
          filesByType.other.count++;
          filesByType.other.size += file.size;
        }
      });

      return {
        tenantId,
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        totalSizeGB: totalSize / (1024 * 1024 * 1024),
        breakdown: filesByType
      };

    } catch (error) {
      logger.error('Get tenant storage usage failed', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete all files for a specific process
   * @param {string} tenantId - Tenant ID
   * @param {string} processId - Process ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProcessFiles(tenantId, processId) {
    try {
      const prefix = `tenants/${tenantId}/processes/${processId}/`;
      const files = await this.listFiles(prefix);

      if (files.length === 0) {
        logger.info('No S3 files found for process', { tenantId, processId });
        return { success: true, deletedCount: 0 };
      }

      logger.info('Deleting S3 files for process', {
        tenantId,
        processId,
        fileCount: files.length,
        totalSizeMB: files.reduce((total, file) => total + file.size, 0) / (1024 * 1024)
      });

      // Delete files in batches of 1000 (S3 limit)
      const deletePromises = [];
      const errors = [];
      
      for (let i = 0; i < files.length; i += 1000) {
        const batch = files.slice(i, i + 1000);
        const deleteParams = {
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map(file => ({ Key: file.key })),
            Quiet: false
          }
        };

        try {
          const result = await this.s3.deleteObjects(deleteParams).promise();
          if (result.Errors && result.Errors.length > 0) {
            errors.push(...result.Errors);
            logger.warn('Some S3 files failed to delete', {
              processId,
              errors: result.Errors
            });
          }
        } catch (error) {
          errors.push({ Key: 'batch_error', Code: error.code, Message: error.message });
          logger.error('S3 batch delete failed', { processId, error: error.message });
        }
      }

      const deletedCount = files.length - errors.length;

      logger.info('Process S3 files deletion completed', {
        tenantId,
        processId,
        deletedCount,
        errorCount: errors.length,
        totalFiles: files.length
      });

      return {
        success: errors.length === 0,
        deletedCount,
        errorCount: errors.length,
        totalFiles: files.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('Delete process files failed', {
        tenantId,
        processId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete all files for a tenant (used for tenant deletion)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteTenantFiles(tenantId) {
    try {
      const prefix = `tenants/${tenantId}/`;
      const files = await this.listFiles(prefix);

      if (files.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      // Delete files in batches of 1000 (S3 limit)
      const deletePromises = [];
      for (let i = 0; i < files.length; i += 1000) {
        const batch = files.slice(i, i + 1000);
        const deleteParams = {
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map(file => ({ Key: file.key })),
            Quiet: false
          }
        };

        deletePromises.push(this.s3.deleteObjects(deleteParams).promise());
      }

      const results = await Promise.all(deletePromises);
      const deletedCount = results.reduce((total, result) => total + result.Deleted.length, 0);

      logger.info('Tenant files deleted from S3', {
        tenantId,
        deletedCount,
        totalFiles: files.length
      });

      return {
        success: true,
        deletedCount,
        totalFiles: files.length
      };

    } catch (error) {
      logger.error('Delete tenant files failed', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get bucket statistics
   * @returns {Promise<Object>} Bucket statistics
   */
  async getBucketStats() {
    try {
      const allFiles = await this.listFiles('', 10000); // Get up to 10k files for stats

      let totalSize = 0;
      const tenantStats = new Map();

      allFiles.forEach(file => {
        totalSize += file.size;

        // Extract tenant ID from key pattern: tenants/{tenantId}/...
        const keyParts = file.key.split('/');
        if (keyParts[0] === 'tenants' && keyParts[1]) {
          const tenantId = keyParts[1];
          if (!tenantStats.has(tenantId)) {
            tenantStats.set(tenantId, { files: 0, size: 0 });
          }
          const stats = tenantStats.get(tenantId);
          stats.files++;
          stats.size += file.size;
        }
      });

      return {
        bucket: this.bucket,
        totalFiles: allFiles.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        totalSizeGB: totalSize / (1024 * 1024 * 1024),
        tenantCount: tenantStats.size,
        tenantBreakdown: Object.fromEntries(
          Array.from(tenantStats.entries()).map(([tenantId, stats]) => [
            tenantId,
            {
              files: stats.files,
              sizeBytes: stats.size,
              sizeMB: stats.size / (1024 * 1024),
              sizeGB: stats.size / (1024 * 1024 * 1024)
            }
          ])
        )
      };

    } catch (error) {
      logger.error('Get bucket stats failed', {
        error: error.message
      });
      throw error;
    }
  }
}

// Lazy initialization to prevent errors during startup
let s3ServiceInstance = null;

module.exports = {
  getInstance() {
    if (!s3ServiceInstance) {
      try {
        s3ServiceInstance = new S3Service();
      } catch (error) {
        logger.error('Failed to initialize S3Service:', error.message);
        // Return a mock service that won't crash the app
        return {
          testConnection: async () => false,
          uploadFile: async () => { throw new Error('S3 service not available'); },
          getFileStream: async () => { throw new Error('S3 service not available'); },
          deleteFile: async () => { throw new Error('S3 service not available'); },
          listFiles: async () => { throw new Error('S3 service not available'); },
          getBucketStats: async () => { throw new Error('S3 service not available'); }
        };
      }
    }
    return s3ServiceInstance;
  },
  
  // Direct access for backwards compatibility (will initialize if needed)
  get testConnection() { return this.getInstance().testConnection.bind(this.getInstance()); },
  get uploadFile() { return this.getInstance().uploadFile.bind(this.getInstance()); },
  get getFileStream() { return this.getInstance().getFileStream.bind(this.getInstance()); },
  get deleteFile() { return this.getInstance().deleteFile.bind(this.getInstance()); },
  get listFiles() { return this.getInstance().listFiles.bind(this.getInstance()); },
  get getBucketStats() { return this.getInstance().getBucketStats.bind(this.getInstance()); },
  get generateS3Key() { return this.getInstance().generateS3Key.bind(this.getInstance()); },
  get generatePresignedUrl() { return this.getInstance().generatePresignedUrl.bind(this.getInstance()); },
  get generateVideoStreamUrl() { return this.getInstance().generateVideoStreamUrl.bind(this.getInstance()); },
  get getFileMetadata() { return this.getInstance().getFileMetadata.bind(this.getInstance()); },
  get fileExists() { return this.getInstance().fileExists.bind(this.getInstance()); }
};