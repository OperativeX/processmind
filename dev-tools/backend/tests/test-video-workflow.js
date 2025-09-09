#!/usr/bin/env node

const mongoose = require('mongoose');
const Redis = require('ioredis');
const { Queue } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const FormData = require('form-data');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load environment variables
require('dotenv').config();

// Load all models
require('./src/models');

// Configuration
const TEST_VIDEO = './test.mp4';
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api/v1';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

class VideoWorkflowTester {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });
    this.processId = null;
    this.authToken = null;
    this.tenantId = null;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async init() {
    this.log('\n🚀 Initializing test environment...', 'cyan');
    
    // MongoDB connection
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
      this.log('✅ Connected to MongoDB', 'green');
    } catch (error) {
      this.log('❌ MongoDB connection failed: ' + error.message, 'red');
      throw error;
    }

    // Initialize BullMQ queues
    const queueConnection = { connection: this.redis };
    this.videoQueue = new Queue('video-processing', queueConnection);
    this.audioQueue = new Queue('audio-extraction', queueConnection);
    this.transcriptionQueue = new Queue('transcription', queueConnection);
    this.aiQueue = new Queue('ai-analysis', queueConnection);
    this.s3Queue = new Queue('s3-upload', queueConnection);
    this.cleanupQueue = new Queue('cleanup', queueConnection);

    // Check if test video exists
    try {
      await fs.access(TEST_VIDEO);
      this.log('✅ Test video found: ' + TEST_VIDEO, 'green');
    } catch {
      this.log('❌ Test video not found: ' + TEST_VIDEO, 'red');
      this.log('Creating a test video...', 'yellow');
      await this.createTestVideo();
    }

    // Get auth credentials
    await this.authenticate();
  }

  async createTestVideo() {
    // Create a simple test video using ffmpeg
    const command = `ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=10 -c:v libx264 -c:a aac -y ${TEST_VIDEO}`;
    
    try {
      await execPromise(command);
      this.log('✅ Test video created', 'green');
    } catch (error) {
      this.log('❌ Failed to create test video: ' + error.message, 'red');
      throw error;
    }
  }

  async authenticate() {
    this.log('\n🔐 Authenticating...', 'cyan');
    
    // First, try to find an existing user and tenant
    const User = mongoose.model('User');
    const Tenant = mongoose.model('Tenant');
    
    try {
      // Find first tenant
      const tenant = await Tenant.findOne({ isActive: true });
      if (!tenant) {
        this.log('❌ No active tenant found. Please create a tenant first.', 'red');
        throw new Error('No tenant found');
      }
      
      this.tenantId = tenant._id.toString();
      this.log(`✅ Using tenant: ${tenant.name} (${this.tenantId})`, 'green');
      
      // Find user in this tenant
      const user = await User.findOne({ tenantId: tenant._id });
      if (!user) {
        this.log('❌ No user found in tenant. Please create a user first.', 'red');
        throw new Error('No user found');
      }
      
      // Generate auth token (simplified for testing)
      const jwt = require('jsonwebtoken');
      this.authToken = jwt.sign(
        { userId: user._id, email: user.email, tenantId: this.tenantId },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
      
      this.log(`✅ Authenticated as: ${user.email}`, 'green');
    } catch (error) {
      this.log('❌ Authentication failed: ' + error.message, 'red');
      throw error;
    }
  }

  async testUpload() {
    this.log('\n📤 Testing video upload...', 'cyan');
    
    const form = new FormData();
    const fileStream = require('fs').createReadStream(TEST_VIDEO);
    form.append('video', fileStream, 'test.mp4');
    
    try {
      const response = await axios.post(
        `${API_BASE}/tenants/${this.tenantId}/processes`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.authToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      // Debug response structure
      this.log('Upload response structure:', 'cyan');
      this.log(JSON.stringify(response.data, null, 2).substring(0, 500), 'blue');
      
      this.processId = response.data.data?.process?._id || response.data.data?.process?.id;
      this.log(`✅ Upload successful! Process ID: ${this.processId}`, 'green');
      this.log(`   Status: ${response.data.data?.process?.status}`, 'blue');
      
      return response.data.data.process;
    } catch (error) {
      this.log('❌ Upload failed:', 'red');
      if (error.response) {
        this.log(`   Status: ${error.response.status}`, 'red');
        this.log(`   Message: ${error.response.data?.message || error.response.statusText}`, 'red');
      } else {
        this.log(`   Error: ${error.message}`, 'red');
      }
      throw error;
    }
  }

  async monitorQueues() {
    this.log('\n🔍 Monitoring job queues...', 'cyan');
    
    const queues = [
      { name: 'Video Processing', queue: this.videoQueue },
      { name: 'Audio Extraction', queue: this.audioQueue },
      { name: 'Transcription', queue: this.transcriptionQueue },
      { name: 'AI Analysis', queue: this.aiQueue },
      { name: 'S3 Upload', queue: this.s3Queue },
      { name: 'Cleanup', queue: this.cleanupQueue }
    ];
    
    for (const { name, queue } of queues) {
      this.log(`\n${name} Queue:`, 'yellow');
      
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const completed = await queue.getCompletedCount();
      const failed = await queue.getFailedCount();
      
      this.log(`  Waiting: ${waiting} | Active: ${active} | Completed: ${completed} | Failed: ${failed}`, 'blue');
      
      // Get jobs for our process
      const allJobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed']);
      const ourJobs = allJobs.filter(job => job.data.processId === this.processId);
      
      if (ourJobs.length > 0) {
        this.log(`  📌 Our process jobs:`, 'magenta');
        for (const job of ourJobs) {
          const status = await job.getState();
          this.log(`     - ${job.name} [${status}] Progress: ${job.progress}%`, 'magenta');
          
          if (status === 'failed') {
            this.log(`       Error: ${job.failedReason}`, 'red');
          }
        }
      }
    }
  }

  async checkDatabase() {
    this.log('\n💾 Checking database...', 'cyan');
    
    const Process = mongoose.model('Process');
    const process = await Process.findById(this.processId);
    
    if (!process) {
      this.log('❌ Process not found in database!', 'red');
      return null;
    }
    
    this.log('Process Details:', 'yellow');
    this.log(`  Status: ${process.status}`, 'blue');
    this.log(`  Progress: ${process.progress?.percentage || 0}%`, 'blue');
    this.log(`  Current Step: ${process.progress?.currentStep || 'unknown'}`, 'blue');
    
    this.log('\nFiles:', 'yellow');
    this.log(`  Original: ${process.files?.original?.path ? '✅' : '❌'} ${process.files?.original?.path || 'missing'}`, process.files?.original ? 'green' : 'red');
    this.log(`  Processed: ${process.files?.processed?.path ? '✅' : '❌'} ${process.files?.processed?.path || 'missing'}`, process.files?.processed ? 'green' : 'red');
    this.log(`  Audio: ${process.files?.audio?.path ? '✅' : '❌'} ${process.files?.audio?.path || 'missing'}`, process.files?.audio ? 'green' : 'red');
    
    // S3 Storage Information
    this.log('\nS3 Storage:', 'yellow');
    if (process.files?.processed) {
      const storageType = process.files.processed.storageType || 'unknown';
      this.log(`  Storage Type: ${storageType}`, storageType === 's3' ? 'green' : 'red');
      if (storageType === 's3') {
        this.log(`  S3 Key: ${process.files.processed.path}`, 'blue');
        this.log(`  S3 Location: ${process.files.processed.s3Location || 'unknown'}`, 'blue');
      }
    } else {
      this.log(`  No processed file info`, 'red');
    }
    
    // CRITICAL CHECK
    this.log('\n🚨 CRITICAL CHECKS:', 'yellow');
    this.log(`  pendingVideoResult: ${process.pendingVideoResult ? '✅ EXISTS' : '❌ MISSING'}`, process.pendingVideoResult ? 'green' : 'red');
    
    if (process.pendingVideoResult) {
      this.log('  pendingVideoResult details:', 'cyan');
      this.log(`    - outputPath: ${process.pendingVideoResult.outputPath}`, 'blue');
      this.log(`    - compressedSize: ${(process.pendingVideoResult.compressedSize / 1024 / 1024).toFixed(2)} MB`, 'blue');
      this.log(`    - codec: ${process.pendingVideoResult.codec}`, 'blue');
      this.log(`    - completedAt: ${process.pendingVideoResult.completedAt}`, 'blue');
    }
    
    // Job IDs
    this.log('\nJob IDs:', 'yellow');
    if (process.jobs) {
      if (process.jobs.videoProcessing) this.log(`  Video Processing: ${process.jobs.videoProcessing}`, 'blue');
      if (process.jobs.audioExtraction) this.log(`  Audio Extraction: ${process.jobs.audioExtraction}`, 'blue');
      if (process.jobs.transcription && process.jobs.transcription.length) {
        this.log(`  Transcription: ${process.jobs.transcription.length} jobs`, 'blue');
      }
      if (process.jobs.aiAnalysis) {
        this.log(`  AI Analysis:`, 'blue');
        if (process.jobs.aiAnalysis.tags) this.log(`    Tags: ${process.jobs.aiAnalysis.tags}`, 'blue');
        if (process.jobs.aiAnalysis.todo) this.log(`    Todo: ${process.jobs.aiAnalysis.todo}`, 'blue');
        if (process.jobs.aiAnalysis.title) this.log(`    Title: ${process.jobs.aiAnalysis.title}`, 'blue');
        if (process.jobs.aiAnalysis.embedding) this.log(`    Embedding: ${process.jobs.aiAnalysis.embedding}`, 'blue');
      }
      if (process.jobs.s3Upload) this.log(`  S3 Upload: ${process.jobs.s3Upload}`, 'blue');
      if (process.jobs.localCleanup) this.log(`  Local Cleanup: ${process.jobs.localCleanup}`, 'blue');
    } else {
      this.log(`  No job IDs found`, 'red');
    }

    // Check all fields
    this.log('\n📋 All Process Fields:', 'yellow');
    const keys = Object.keys(process.toObject());
    keys.forEach(key => {
      if (!['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
        const value = process[key];
        const hasValue = value !== undefined && value !== null && 
                        (typeof value !== 'object' || Object.keys(value).length > 0);
        this.log(`  ${key}: ${hasValue ? '✓' : '✗'}`, hasValue ? 'green' : 'gray');
      }
    });
    
    return process;
  }

  async checkFileSystem() {
    this.log('\n📁 Checking file system...', 'cyan');
    
    if (!this.processId) {
      this.log('❌ No process ID available', 'red');
      return;
    }
    
    const processDir = path.join('./uploads/processed', this.processId);
    
    try {
      await fs.access(processDir);
      const files = await fs.readdir(processDir);
      this.log(`Files in ${processDir}:`, 'yellow');
      
      let videoFound = false;
      let audioFound = false;
      
      for (const file of files) {
        const filePath = path.join(processDir, file);
        const stats = await fs.stat(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        this.log(`  - ${file} (${sizeMB} MB)`, 'blue');
        
        // Check video
        if (file === 'video.mp4' || file.endsWith('.mp4')) {
          videoFound = true;
          this.log('    ✅ Compressed video found!', 'green');
          
          // Validate with ffprobe
          try {
            const { stdout } = await execPromise(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json ${filePath}`);
            const info = JSON.parse(stdout);
            if (info.streams && info.streams[0]) {
              const stream = info.streams[0];
              this.log(`    Codec: ${stream.codec_name}`, 'magenta');
              this.log(`    Resolution: ${stream.width}x${stream.height}`, 'magenta');
              
              if (stream.codec_name === 'h264') {
                this.log('    ✅ Valid H.264 video', 'green');
              } else if (stream.codec_name === 'hevc') {
                this.log('    ✅ Valid H.265/HEVC video', 'green');
              } else {
                this.log(`    ⚠️  Unexpected codec: ${stream.codec_name}`, 'yellow');
              }
            }
          } catch (error) {
            this.log('    ❌ Failed to probe video: ' + error.message, 'red');
          }
        }
        
        // Check audio
        if (file === 'audio.wav' || file.endsWith('.wav')) {
          audioFound = true;
          this.log('    ✅ Extracted audio found!', 'green');
        }
      }
      
      if (!videoFound) {
        this.log('  ❌ No compressed video file found!', 'red');
      }
      if (!audioFound) {
        this.log('  ⚠️  No extracted audio file found (might be processing)', 'yellow');
      }
      
    } catch (error) {
      this.log(`❌ Process directory not accessible: ${processDir}`, 'red');
      this.log(`   Error: ${error.message}`, 'red');
    }
  }

  async checkRedisData() {
    this.log('\n🔴 Checking Redis data...', 'cyan');
    
    try {
      // Check for process-related keys
      const keys = await this.redis.keys(`*${this.processId}*`);
      this.log(`Redis keys containing process ID:`, 'yellow');
      
      if (keys.length === 0) {
        this.log('  No keys found', 'blue');
      } else {
        for (const key of keys) {
          const type = await this.redis.type(key);
          this.log(`  - ${key} (${type})`, 'blue');
          
          if (type === 'string') {
            const value = await this.redis.get(key);
            try {
              const parsed = JSON.parse(value);
              if (parsed.pendingVideoResult) {
                this.log('    🎯 Found pendingVideoResult in Redis!', 'green');
                this.log(`    ${JSON.stringify(parsed.pendingVideoResult, null, 2)}`, 'magenta');
              }
            } catch {
              // Not JSON, ignore
            }
          }
        }
      }
    } catch (error) {
      this.log('❌ Failed to check Redis: ' + error.message, 'red');
    }
  }

  async waitAndMonitor(durationSeconds = 60) {
    this.log(`\n🔄 Monitoring for ${durationSeconds} seconds...`, 'cyan');
    
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    
    while ((Date.now() - startTime) < (durationSeconds * 1000)) {
      this.log(`\n⏱️  Time elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`, 'blue');
      
      const process = await this.checkDatabase();
      await this.monitorQueues();
      await this.checkFileSystem();
      await this.checkRedisData();
      
      if (process?.status === 'completed' || process?.status === 'failed') {
        this.log(`\n🏁 Process finished with status: ${process.status}`, process.status === 'completed' ? 'green' : 'red');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  async generateReport() {
    this.log('\n📊 FINAL REPORT', 'cyan');
    this.log('================', 'cyan');
    
    if (!this.processId) {
      this.log('❌ No process was created', 'red');
      return;
    }
    
    const Process = mongoose.model('Process');
    const finalProcess = await Process.findById(this.processId);
    
    if (!finalProcess) {
      this.log('❌ Process disappeared from database!', 'red');
      return;
    }
    
    // Summary
    const checks = {
      'Upload successful': this.processId ? true : false,
      'Process in database': finalProcess ? true : false,
      'Original file saved': finalProcess.files?.original?.path ? true : false,
      'Video compression started': finalProcess.status !== 'uploaded',
      'Audio extraction completed': finalProcess.files?.audio?.path ? true : false,
      'Video file exists on disk': false, // Will check below
      'pendingVideoResult exists': finalProcess.pendingVideoResult ? true : false,
      'Processed video in DB': finalProcess.files?.processed?.path ? true : false,
      'S3 upload completed': finalProcess.files?.processed?.storageType === 's3',
      'Local files cleaned': finalProcess.files?.original?.storageType === 'deleted',
      'Process completed': finalProcess.status === 'completed'
    };
    
    // Check if video file actually exists
    if (finalProcess.files?.processed?.path) {
      try {
        await fs.access(finalProcess.files.processed.path);
        checks['Video file exists on disk'] = true;
      } catch {
        // File doesn't exist
      }
    } else if (this.processId) {
      // Check expected location
      const expectedPath = path.join('./uploads/processed', this.processId, 'video.mp4');
      try {
        await fs.access(expectedPath);
        checks['Video file exists on disk'] = true;
        this.log(`\n⚠️  Video exists at ${expectedPath} but NOT in database!`, 'yellow');
      } catch {
        // File doesn't exist
      }
    }
    
    // Print results
    this.log('\nTest Results:', 'yellow');
    Object.entries(checks).forEach(([test, passed]) => {
      this.log(`  ${test}: ${passed ? '✅' : '❌'}`, passed ? 'green' : 'red');
    });
    
    // Diagnosis
    this.log('\n🔍 DIAGNOSIS:', 'cyan');
    
    if (!checks['pendingVideoResult exists'] && checks['Video file exists on disk']) {
      this.log('⚠️  CRITICAL: Video was compressed but pendingVideoResult was not persisted!', 'red');
      this.log('   This confirms the schema issue - pendingVideoResult is not defined in MongoDB schema.', 'red');
    }
    
    if (checks['pendingVideoResult exists'] && !checks['Processed video in DB']) {
      this.log('⚠️  Video result is pending but was never finalized!', 'yellow');
      this.log('   The checkAndFinalizeVideoCompression might not have been called.', 'yellow');
    }
    
    if (!checks['Video compression started']) {
      this.log('❌ Video compression never started. Check if workers are running.', 'red');
    }
    
    if (checks['Processed video in DB'] && !checks['S3 upload completed']) {
      this.log('⚠️  Video processed but not uploaded to S3!', 'yellow');
      this.log('   S3Upload worker might not be running or job failed.', 'yellow');
    }
    
    if (checks['S3 upload completed'] && !checks['Local files cleaned']) {
      this.log('⚠️  S3 upload complete but local files not cleaned!', 'yellow');
      this.log('   LocalCleanup worker might not be running or job failed.', 'yellow');
    }
    
    if (checks['Process completed'] && checks['S3 upload completed'] && checks['Local files cleaned']) {
      this.log('✅ PERFECT: Full S3 pipeline completed successfully!', 'green');
    }
    
    // Final status
    this.log(`\nFinal Process Status: ${finalProcess.status}`, 'cyan');
    this.log(`Final Progress: ${finalProcess.progress?.percentage || 0}%`, 'cyan');
    
    if (finalProcess.errors && finalProcess.errors.length > 0) {
      this.log('\n❌ Errors found:', 'red');
      finalProcess.errors.forEach(error => {
        this.log(`  - ${error.stage}: ${error.error}`, 'red');
      });
    }
  }

  async cleanup() {
    this.log('\n🧹 Cleaning up...', 'cyan');
    
    try {
      await this.generateReport();
      
      await mongoose.disconnect();
      await this.redis.quit();
      
      this.log('\n✅ Test completed', 'green');
    } catch (error) {
      this.log('❌ Cleanup error: ' + error.message, 'red');
    }
  }

  async run() {
    try {
      await this.init();
      const uploadResult = await this.testUpload();
      
      // Initial checks
      await this.monitorQueues();
      await this.checkDatabase();
      await this.checkFileSystem();
      
      // Monitor for a while
      await this.waitAndMonitor(30);
      
    } catch (error) {
      this.log('\n❌ Test failed with error:', 'red');
      this.log(error.stack || error.message, 'red');
    } finally {
      await this.cleanup();
      process.exit(0);
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new VideoWorkflowTester();
  
  process.on('SIGINT', async () => {
    console.log('\n\nInterrupted! Cleaning up...');
    await tester.cleanup();
    process.exit(0);
  });
  
  tester.run().catch(console.error);
}

module.exports = VideoWorkflowTester;