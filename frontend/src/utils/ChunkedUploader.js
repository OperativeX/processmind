import { v4 as uuidv4 } from 'uuid';

/**
 * ChunkedUploader - Handles large file uploads with chunking and resume capability
 * 
 * Features:
 * - Splits large files into chunks
 * - Supports resume on failure
 * - Progress tracking
 * - Automatic retry with exponential backoff
 * - Network failure resilience
 */
class ChunkedUploader {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB chunks
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.concurrentUploads = options.concurrentUploads || 1;
    this.uploadId = null;
    this.chunks = [];
    this.uploadedChunks = new Set();
    this.cancelTokenSource = null;
    this.isPaused = false;
    this.onProgress = options.onProgress || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    // Accept axios instance to use configured interceptors
    this.axiosInstance = options.axiosInstance || null;
  }

  /**
   * Initialize upload with file
   */
  async init(file, tenantId) {
    console.log('🚀 ChunkedUploader.init called with:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      tenantId,
      chunkSize: this.chunkSize,
      chunkSizeMB: (this.chunkSize / 1024 / 1024).toFixed(2) + 'MB'
    });

    this.file = file;
    this.tenantId = tenantId;
    this.uploadId = uuidv4();
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    
    // Create chunks metadata
    this.chunks = Array.from({ length: this.totalChunks }, (_, index) => ({
      index,
      start: index * this.chunkSize,
      end: Math.min((index + 1) * this.chunkSize, file.size),
      status: 'pending',
      retries: 0
    }));

    // Try to restore progress from localStorage
    this.restoreProgress();
    
    console.log(`✅ Upload initialized: uploadId=${this.uploadId}, totalChunks=${this.totalChunks}`);
    return this.uploadId;
  }

  /**
   * Start or resume upload
   */
  async upload() {
    console.log('📤 ChunkedUploader.upload() called');
    
    if (!this.file || !this.uploadId) {
      console.error('❌ Upload not initialized:', { hasFile: !!this.file, uploadId: this.uploadId });
      throw new Error('Upload not initialized');
    }

    if (!this.axiosInstance) {
      console.error('❌ Axios instance not provided');
      throw new Error('Axios instance not provided');
    }

    this.isPaused = false;
    // Import CancelToken from the axios instance
    const axios = await import('axios');
    this.cancelTokenSource = axios.CancelToken.source();
    this.onStatusChange('uploading');

    console.log('🔄 Starting chunk upload process...');

    try {
      // Upload chunks in parallel with concurrency limit
      await this.uploadChunksWithConcurrency();
      
      console.log('✅ All chunks uploaded, finalizing...');
      
      // All chunks uploaded, finalize the upload
      await this.finalizeUpload();
      
      // Clean up stored progress
      this.clearProgress();
      
      this.onStatusChange('completed');
      console.log('🎉 Upload completed successfully!');
      return { success: true, uploadId: this.uploadId, processId: this.processId };
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      const axios = await import('axios');
      if (axios.isCancel && axios.isCancel(error)) {
        this.onStatusChange('paused');
        this.saveProgress();
        return { success: false, paused: true };
      }
      
      this.onStatusChange('failed');
      throw error;
    }
  }

  /**
   * Upload chunks with concurrency control
   */
  async uploadChunksWithConcurrency() {
    const pendingChunks = this.chunks.filter(
      chunk => chunk.status !== 'completed' && !this.uploadedChunks.has(chunk.index)
    );

    let activeUploads = [];
    let chunkIndex = 0;

    while (chunkIndex < pendingChunks.length || activeUploads.length > 0) {
      if (this.isPaused) {
        await Promise.all(activeUploads);
        const axios = await import('axios');
        throw new axios.CancelToken.source().token.reason || new Error('Upload paused');
      }

      // Start new uploads up to concurrency limit
      while (activeUploads.length < this.concurrentUploads && chunkIndex < pendingChunks.length) {
        const chunk = pendingChunks[chunkIndex++];
        activeUploads.push(this.uploadChunk(chunk));
      }

      // Wait for at least one upload to complete
      if (activeUploads.length > 0) {
        const completed = await Promise.race(activeUploads);
        activeUploads = activeUploads.filter(p => p !== completed);
      }
    }
  }

  /**
   * Upload a single chunk with retry logic
   */
  async uploadChunk(chunk) {
    console.log(`📦 Uploading chunk ${chunk.index + 1}/${this.totalChunks}`);
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const chunkData = this.file.slice(chunk.start, chunk.end);
        const formData = new FormData();
        
        formData.append('chunk', chunkData);
        formData.append('uploadId', this.uploadId);
        formData.append('chunkIndex', chunk.index);
        formData.append('totalChunks', this.totalChunks);
        formData.append('filename', this.file.name);
        
        console.log(`🌐 POST /tenants/${this.tenantId}/processes/upload-chunk`, {
          chunkIndex: chunk.index,
          chunkSize: chunk.end - chunk.start,
          uploadId: this.uploadId
        });
        
        const response = await this.axiosInstance.post(
          `/tenants/${this.tenantId}/processes/upload-chunk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            cancelToken: this.cancelTokenSource.token,
            timeout: 300000, // 5 minute timeout per chunk
            onUploadProgress: (progressEvent) => {
              this.updateProgress(chunk.index, progressEvent.loaded, progressEvent.total);
            }
          }
        );

        console.log(`✅ Chunk ${chunk.index} uploaded successfully:`, response.data);
        
        chunk.status = 'completed';
        this.uploadedChunks.add(chunk.index);
        this.saveProgress();
        
        return response.data;
        
      } catch (error) {
        console.error(`❌ Chunk ${chunk.index} upload failed (attempt ${attempt + 1}):`, error.message);
        chunk.retries = attempt + 1;
        
        // Check if axios is imported
        const axios = await import('axios');
        if (axios.isCancel && axios.isCancel(error)) {
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          chunk.status = 'failed';
          console.error(`Failed to upload chunk ${chunk.index} after ${this.maxRetries} retries`);
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        console.warn(`Retrying chunk ${chunk.index} in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Finalize the upload after all chunks are uploaded
   */
  async finalizeUpload() {
    console.log('🏁 Finalizing chunked upload...', {
      uploadId: this.uploadId,
      filename: this.file.name,
      fileSize: this.file.size,
      mimeType: this.file.type
    });
    
    const formData = new FormData();
    formData.append('uploadId', this.uploadId);
    formData.append('filename', this.file.name);
    formData.append('fileSize', this.file.size);
    formData.append('mimeType', this.file.type);
    
    // No need to send the file again - just metadata for chunk finalization
    
    console.log(`🌐 POST /tenants/${this.tenantId}/processes/finalize-chunked-upload`);
    
    const response = await this.axiosInstance.post(
      `/tenants/${this.tenantId}/processes/finalize-chunked-upload`,
      {
        uploadId: this.uploadId,
        filename: this.file.name,
        fileSize: this.file.size,
        mimeType: this.file.type
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 300000, // 5 minute timeout for finalization
      }
    );
    
    console.log('✅ Finalization response:', response.data);

    // Store the process ID from response
    this.processId = response.data.data.process.id || response.data.data.process._id;
    
    return response.data;
  }

  /**
   * Update progress tracking
   */
  updateProgress(chunkIndex, loaded, total) {
    const completedChunks = this.uploadedChunks.size;
    const currentChunkProgress = loaded / total;
    const totalProgress = ((completedChunks + currentChunkProgress) / this.totalChunks) * 100;
    
    // Throttle progress updates to avoid performance issues
    const roundedProgress = Math.round(totalProgress);
    if (!this.lastReportedProgress || roundedProgress !== this.lastReportedProgress) {
      this.lastReportedProgress = roundedProgress;
      this.onProgress(roundedProgress);
    }
  }

  /**
   * Pause the upload
   */
  pause() {
    this.isPaused = true;
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('Upload paused by user');
    }
  }

  /**
   * Resume a paused upload
   */
  async resume() {
    if (!this.isPaused) {
      return;
    }
    
    return this.upload();
  }

  /**
   * Cancel the upload completely
   */
  cancel() {
    this.pause();
    this.clearProgress();
    this.onStatusChange('cancelled');
  }

  /**
   * Save upload progress to localStorage
   */
  saveProgress() {
    const progressKey = `upload_progress_${this.uploadId}`;
    const progressData = {
      uploadId: this.uploadId,
      filename: this.file.name,
      fileSize: this.file.size,
      uploadedChunks: Array.from(this.uploadedChunks),
      totalChunks: this.totalChunks,
      timestamp: Date.now()
    };
    
    localStorage.setItem(progressKey, JSON.stringify(progressData));
  }

  /**
   * Restore upload progress from localStorage
   */
  restoreProgress() {
    const progressKey = `upload_progress_${this.uploadId}`;
    const savedProgress = localStorage.getItem(progressKey);
    
    if (savedProgress) {
      try {
        const progressData = JSON.parse(savedProgress);
        
        // Verify file matches
        if (progressData.filename === this.file.name && progressData.fileSize === this.file.size) {
          this.uploadedChunks = new Set(progressData.uploadedChunks);
          console.log(`Restored upload progress: ${this.uploadedChunks.size}/${this.totalChunks} chunks completed`);
        }
      } catch (error) {
        console.error('Failed to restore upload progress:', error);
      }
    }
  }

  /**
   * Clear stored progress
   */
  clearProgress() {
    const progressKey = `upload_progress_${this.uploadId}`;
    localStorage.removeItem(progressKey);
  }

  /**
   * Get upload statistics
   */
  getStats() {
    return {
      uploadId: this.uploadId,
      totalChunks: this.totalChunks,
      uploadedChunks: this.uploadedChunks.size,
      progress: Math.round((this.uploadedChunks.size / this.totalChunks) * 100),
      isPaused: this.isPaused
    };
  }
}

export default ChunkedUploader;