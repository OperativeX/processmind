#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const TEST_FILE_PATH = './test.mp4';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

// Test user credentials - adjust as needed
const TEST_USER = {
  email: 'lars.koetting@3d-composite.de',
  password: 'Hallo123!'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging helpers
const log = {
  info: (msg, data = null) => {
    console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
    if (data) console.log(colors.dim, JSON.stringify(data, null, 2), colors.reset);
  },
  success: (msg, data = null) => {
    console.log(`${colors.green}✅ ${msg}${colors.reset}`);
    if (data) console.log(colors.dim, JSON.stringify(data, null, 2), colors.reset);
  },
  error: (msg, data = null) => {
    console.log(`${colors.red}❌ ${msg}${colors.reset}`);
    if (data) console.log(colors.red, data, colors.reset);
  },
  warn: (msg, data = null) => {
    console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
    if (data) console.log(colors.yellow, data, colors.reset);
  },
  step: (msg) => {
    console.log(`\n${colors.bright}${colors.cyan}📍 ${msg}${colors.reset}\n`);
  }
};

// Create axios instance with interceptors
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minute timeout
});

// Request/Response interceptors for debugging
api.interceptors.request.use(
  (config) => {
    log.info(`Request: ${config.method.toUpperCase()} ${config.url}`);
    if (config.headers) {
      log.info('Headers:', {
        'Content-Type': config.headers['Content-Type'],
        'Authorization': config.headers['Authorization'] ? 'Bearer ...' : 'None'
      });
    }
    return config;
  },
  (error) => {
    log.error('Request Error:', error.message);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    log.success(`Response: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    if (error.response) {
      log.error(`Response Error: ${error.response.status} ${error.response.statusText}`);
      if (error.response.data) {
        log.error('Error Data:', error.response.data);
      }
    } else {
      log.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Main test class
class ChunkedUploadTester {
  constructor() {
    this.token = null;
    this.tenantId = null;
    this.userId = null;
    this.uploadId = null;
    this.chunks = [];
  }

  async login() {
    log.step('1. Logging in');
    
    try {
      const response = await api.post('/auth/login', TEST_USER);
      
      // Debug: Log full response structure
      log.info('Login response structure:', {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasNestedData: !!response.data?.data,
        nestedDataKeys: response.data?.data ? Object.keys(response.data.data) : []
      });
      
      this.token = response.data.data.tokens?.accessToken || response.data.data.accessToken || response.data.data.token;
      this.tenantId = response.data.data.user.tenantId?.id || response.data.data.user.tenantId;
      this.userId = response.data.data.user.id || response.data.data.user._id;
      
      // Set auth header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      
      log.success('Login successful', {
        userId: this.userId,
        tenantId: this.tenantId,
        tokenReceived: !!this.token,
        tokenLength: this.token?.length
      });
      
      return true;
    } catch (error) {
      log.error('Login failed');
      return false;
    }
  }

  async prepareFile() {
    log.step('2. Preparing file for upload');
    
    try {
      // Check if file exists
      if (!fs.existsSync(TEST_FILE_PATH)) {
        log.error(`Test file not found: ${TEST_FILE_PATH}`);
        return false;
      }

      const stats = fs.statSync(TEST_FILE_PATH);
      const fileSize = stats.size;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      
      log.info('File info:', {
        path: TEST_FILE_PATH,
        size: fileSize,
        sizeMB: (fileSize / 1024 / 1024).toFixed(2) + 'MB',
        chunkSize: CHUNK_SIZE,
        chunkSizeMB: (CHUNK_SIZE / 1024 / 1024).toFixed(2) + 'MB',
        totalChunks: totalChunks
      });

      // Generate upload ID
      this.uploadId = uuidv4();
      
      // Create chunks metadata
      this.chunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        
        this.chunks.push({
          index: i,
          start: start,
          end: end,
          size: end - start,
          uploaded: false
        });
      }

      log.success('File prepared for chunked upload', {
        uploadId: this.uploadId,
        totalChunks: this.chunks.length
      });

      return true;
    } catch (error) {
      log.error('File preparation failed:', error.message);
      return false;
    }
  }

  async uploadChunk(chunk) {
    log.info(`Uploading chunk ${chunk.index + 1}/${this.chunks.length}`);
    
    try {
      // Read chunk from file
      const buffer = Buffer.alloc(chunk.size);
      const fd = fs.openSync(TEST_FILE_PATH, 'r');
      fs.readSync(fd, buffer, 0, chunk.size, chunk.start);
      fs.closeSync(fd);

      // Create form data
      const formData = new FormData();
      formData.append('chunk', buffer, {
        filename: 'chunk.part',
        contentType: 'application/octet-stream'
      });
      formData.append('uploadId', this.uploadId);
      formData.append('chunkIndex', chunk.index.toString());
      formData.append('totalChunks', this.chunks.length.toString());
      formData.append('filename', path.basename(TEST_FILE_PATH));

      // Upload chunk
      const response = await api.post(
        `/tenants/${this.tenantId}/processes/upload-chunk`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      chunk.uploaded = true;
      
      log.success(`Chunk ${chunk.index + 1} uploaded`, response.data.data);
      
      return true;
    } catch (error) {
      log.error(`Failed to upload chunk ${chunk.index + 1}`);
      return false;
    }
  }

  async uploadAllChunks() {
    log.step('3. Uploading chunks');
    
    let successCount = 0;
    
    for (const chunk of this.chunks) {
      const success = await this.uploadChunk(chunk);
      if (success) {
        successCount++;
      } else {
        log.warn(`Stopping after ${successCount}/${this.chunks.length} chunks uploaded`);
        return false;
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log.success(`All ${successCount} chunks uploaded successfully`);
    return true;
  }

  async finalizeUpload() {
    log.step('4. Finalizing upload');
    
    try {
      const fileStats = fs.statSync(TEST_FILE_PATH);
      
      // Create form data for finalization
      const formData = new FormData();
      formData.append('uploadId', this.uploadId);
      formData.append('filename', path.basename(TEST_FILE_PATH));
      formData.append('fileSize', fileStats.size.toString());
      formData.append('mimeType', 'video/mp4');

      log.info('Finalization request data:', {
        uploadId: this.uploadId,
        filename: path.basename(TEST_FILE_PATH),
        fileSize: fileStats.size,
        mimeType: 'video/mp4'
      });

      // Send finalization request
      const response = await api.post(
        `/tenants/${this.tenantId}/processes/finalize-chunked-upload`,
        {
          uploadId: this.uploadId,
          filename: path.basename(TEST_FILE_PATH),
          fileSize: fileStats.size,
          mimeType: 'video/mp4'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      log.success('Upload finalized successfully', {
        processId: response.data.data.process.id || response.data.data.process._id,
        status: response.data.data.process.status
      });

      return response.data.data.process;
    } catch (error) {
      log.error('Finalization failed');
      return null;
    }
  }

  async checkProcessStatus(processId) {
    log.step('5. Checking process status');
    
    try {
      const response = await api.get(`/tenants/${this.tenantId}/processes/${processId}`);
      const process = response.data.data.process;
      
      log.info('Process status:', {
        id: process._id,
        status: process.status,
        title: process.title || 'Not generated yet',
        hasTranscript: !!process.transcript?.text,
        hasTags: process.tags?.length > 0
      });

      return process;
    } catch (error) {
      log.error('Failed to check process status');
      return null;
    }
  }

  async runTest() {
    console.log(colors.bright + colors.magenta + '\n🚀 Starting Chunked Upload Test\n' + colors.reset);
    
    // Step 1: Login
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      log.error('Test aborted: Login failed');
      return;
    }

    // Step 2: Prepare file
    const prepareSuccess = await this.prepareFile();
    if (!prepareSuccess) {
      log.error('Test aborted: File preparation failed');
      return;
    }

    // Step 3: Upload chunks
    const uploadSuccess = await this.uploadAllChunks();
    if (!uploadSuccess) {
      log.error('Test aborted: Chunk upload failed');
      return;
    }

    // Step 4: Finalize upload
    const process = await this.finalizeUpload();
    if (!process) {
      log.error('Test aborted: Finalization failed');
      return;
    }

    // Step 5: Check status
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.checkProcessStatus(process._id || process.id);

    console.log(colors.bright + colors.green + '\n✨ Test completed successfully!\n' + colors.reset);
  }
}

// Run the test
async function main() {
  const tester = new ChunkedUploadTester();
  await tester.runTest();
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ChunkedUploadTester;