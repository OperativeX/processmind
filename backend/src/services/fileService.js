const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class FileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads/temp';
    this.processedDir = process.env.PROCESSED_DIR || './uploads/processed';
  }

  /**
   * Cleanup files by deleting them from filesystem
   * @param {Array|string} filePaths - Array of file paths or single file path
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupFiles(filePaths) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = {
      deleted: [],
      errors: [],
      totalFiles: paths.length
    };

    logger.info('Starting file cleanup', {
      fileCount: paths.length,
      files: paths
    });

    for (const filePath of paths) {
      try {
        if (!filePath || typeof filePath !== 'string') {
          results.errors.push({
            path: filePath,
            error: 'Invalid file path'
          });
          continue;
        }

        // Check if file exists
        const exists = await this.fileExists(filePath);
        if (!exists) {
          logger.warn('File not found during cleanup', { filePath });
          results.errors.push({
            path: filePath,
            error: 'File not found'
          });
          continue;
        }

        // Check if it's a file or directory and delete accordingly
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          // Delete directory recursively
          await fs.rm(filePath, { recursive: true, force: true });
          results.deleted.push(filePath);
          logger.info('Directory deleted recursively', { filePath });
        } else {
          // Delete single file
          await fs.unlink(filePath);
          results.deleted.push(filePath);
          logger.debug('File deleted successfully', { filePath });
        }

      } catch (error) {
        logger.error('Error deleting file', {
          filePath,
          error: error.message
        });
        
        results.errors.push({
          path: filePath,
          error: error.message
        });
      }
    }

    // Try to clean up empty directories
    await this.cleanupEmptyDirectories(paths);

    logger.info('File cleanup completed', {
      totalFiles: results.totalFiles,
      deleted: results.deleted.length,
      errors: results.errors.length
    });

    return results;
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file information
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const hash = await this.getFileHash(filePath);

      return {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        hash
      };
    } catch (error) {
      logger.error('Error getting file info', {
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate file hash
   * @param {string} filePath - Path to file
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {Promise<string>} File hash
   */
  async getFileHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = require('fs').createReadStream(filePath);

      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Move file from one location to another
   * @param {string} sourcePath - Source file path
   * @param {string} destinationPath - Destination file path
   * @returns {Promise<Object>} Move result
   */
  async moveFile(sourcePath, destinationPath) {
    try {
      logger.info('Moving file', {
        from: sourcePath,
        to: destinationPath
      });

      // Ensure destination directory exists
      const destDir = path.dirname(destinationPath);
      await fs.mkdir(destDir, { recursive: true });

      // Check if source file exists
      const exists = await this.fileExists(sourcePath);
      if (!exists) {
        throw new Error('Source file does not exist');
      }

      // Move the file
      await fs.rename(sourcePath, destinationPath);

      const result = {
        success: true,
        sourcePath,
        destinationPath,
        size: (await fs.stat(destinationPath)).size
      };

      logger.info('File moved successfully', result);
      return result;

    } catch (error) {
      logger.error('Error moving file', {
        sourcePath,
        destinationPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Copy file from one location to another
   * @param {string} sourcePath - Source file path
   * @param {string} destinationPath - Destination file path
   * @returns {Promise<Object>} Copy result
   */
  async copyFile(sourcePath, destinationPath) {
    try {
      logger.info('Copying file', {
        from: sourcePath,
        to: destinationPath
      });

      // Ensure destination directory exists
      const destDir = path.dirname(destinationPath);
      await fs.mkdir(destDir, { recursive: true });

      // Check if source file exists
      const exists = await this.fileExists(sourcePath);
      if (!exists) {
        throw new Error('Source file does not exist');
      }

      // Copy the file
      await fs.copyFile(sourcePath, destinationPath);

      const result = {
        success: true,
        sourcePath,
        destinationPath,
        size: (await fs.stat(destinationPath)).size
      };

      logger.info('File copied successfully', result);
      return result;

    } catch (error) {
      logger.error('Error copying file', {
        sourcePath,
        destinationPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path
   * @returns {Promise<boolean>} True if directory was created or already exists
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      logger.error('Error creating directory', {
        dirPath,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get directory contents
   * @param {string} dirPath - Directory path
   * @param {Object} options - Options for filtering
   * @returns {Promise<Array>} Array of file information objects
   */
  async getDirectoryContents(dirPath, options = {}) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const results = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Filter by file type if specified
        if (options.filesOnly && !entry.isFile()) continue;
        if (options.directoriesOnly && !entry.isDirectory()) continue;
        
        // Filter by extension if specified
        if (options.extensions && entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!options.extensions.includes(ext)) continue;
        }

        try {
          const info = await this.getFileInfo(fullPath);
          results.push(info);
        } catch (error) {
          logger.warn('Error getting info for directory entry', {
            path: fullPath,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      logger.error('Error reading directory', {
        dirPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate directory size recursively
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} Directory size information
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    let dirCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        } else if (entry.isDirectory()) {
          const subDirInfo = await this.getDirectorySize(fullPath);
          totalSize += subDirInfo.size;
          fileCount += subDirInfo.files;
          dirCount += subDirInfo.directories + 1;
        }
      }

      return {
        path: dirPath,
        size: totalSize,
        files: fileCount,
        directories: dirCount,
        sizeFormatted: this.formatBytes(totalSize)
      };

    } catch (error) {
      logger.error('Error calculating directory size', {
        dirPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up empty directories
   * @param {Array} filePaths - Array of file paths to check for empty parent directories
   */
  async cleanupEmptyDirectories(filePaths) {
    const directories = new Set();
    
    // Get all unique directories from file paths
    for (const filePath of filePaths) {
      if (filePath && typeof filePath === 'string') {
        directories.add(path.dirname(filePath));
      }
    }

    // Try to remove empty directories
    for (const dirPath of directories) {
      try {
        // Check if directory exists and is empty
        const exists = await this.fileExists(dirPath);
        if (!exists) continue;

        const contents = await fs.readdir(dirPath);
        if (contents.length === 0) {
          await fs.rmdir(dirPath);
          logger.info('Removed empty directory', { dirPath });
        }
      } catch (error) {
        // Ignore errors when cleaning up directories
        logger.debug('Could not remove directory', {
          dirPath,
          error: error.message
        });
      }
    }
  }

  /**
   * Get temporary file path
   * @param {string} extension - File extension (optional)
   * @param {string} tenantId - Tenant ID
   * @param {string} processId - Process ID
   * @returns {string} Temporary file path
   */
  getTempFilePath(extension = '', tenantId = null, processId = null) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = `temp_${timestamp}_${random}${extension}`;
    
    if (tenantId && processId) {
      // Use tenant and process specific directory
      return path.join(this.uploadDir, tenantId, processId, filename);
    }
    
    // Fallback to root upload dir (for backward compatibility)
    return path.join(this.uploadDir, filename);
  }

  /**
   * Get processed file path
   * @param {string} processId - Process ID
   * @param {string} filename - File name
   * @param {string} tenantId - Tenant ID (optional)
   * @returns {string} Processed file path
   */
  getProcessedFilePath(processId, filename, tenantId = null) {
    if (tenantId) {
      // Use tenant-specific directory structure
      return path.join(this.processedDir, tenantId, processId, filename);
    }
    
    // Fallback to current structure (for backward compatibility)
    return path.join(this.processedDir, processId, filename);
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Validate file extension
   * @param {string} filename - File name
   * @param {Array} allowedExtensions - Array of allowed extensions
   * @returns {boolean} True if extension is allowed
   */
  isValidExtension(filename, allowedExtensions) {
    if (!filename || !allowedExtensions || !Array.isArray(allowedExtensions)) {
      return false;
    }

    const extension = path.extname(filename).toLowerCase();
    return allowedExtensions.map(ext => ext.toLowerCase()).includes(extension);
  }

  /**
   * Sanitize filename for safe storage
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    // Remove or replace dangerous characters
    let sanitized = filename
      .replace(/[^\w\s.-]/gi, '')
      .replace(/\s+/g, '_')
      .trim();

    // Ensure filename is not empty and has reasonable length
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'unnamed_file';
    } else if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const base = path.basename(sanitized, ext);
      sanitized = base.substring(0, 255 - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Get upload directory path for tenant/process
   * @param {string} tenantId - Tenant ID
   * @param {string} processId - Process ID
   * @returns {string} Upload directory path
   */
  getUploadDirPath(tenantId, processId) {
    return path.join(this.uploadDir, tenantId, processId);
  }

  /**
   * Validate cleanup path to prevent directory traversal
   * @param {string} filePath - Path to validate
   * @param {string} allowedBasePath - Base path that must be a parent
   * @returns {boolean} True if path is safe to delete
   */
  isPathSafeToDelete(filePath, allowedBasePath) {
    try {
      // Resolve both paths to absolute
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(allowedBasePath);
      
      // Check if the path is within the allowed base path
      const relative = path.relative(resolvedBase, resolvedPath);
      
      // If relative path starts with '..' it's outside the base path
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch (error) {
      logger.error('Path validation error', { filePath, allowedBasePath, error: error.message });
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    try {
      const [uploadStats, processedStats] = await Promise.all([
        this.getDirectorySize(this.uploadDir).catch(() => ({ size: 0, files: 0, directories: 0 })),
        this.getDirectorySize(this.processedDir).catch(() => ({ size: 0, files: 0, directories: 0 }))
      ]);

      return {
        upload: uploadStats,
        processed: processedStats,
        total: {
          size: uploadStats.size + processedStats.size,
          files: uploadStats.files + processedStats.files,
          directories: uploadStats.directories + processedStats.directories,
          sizeFormatted: this.formatBytes(uploadStats.size + processedStats.size)
        }
      };

    } catch (error) {
      logger.error('Error getting storage stats', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new FileService();