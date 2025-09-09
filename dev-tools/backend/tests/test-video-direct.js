#!/usr/bin/env node

const mongoose = require('mongoose');
const Redis = require('ioredis');
const { Queue } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load environment variables
require('dotenv').config();

// Load all models
require('./src/models');

// Import the queue methods directly
const { queueMethods } = require('./src/config/bullmq');

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

class DirectVideoTester {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });
    this.processId = null;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async init() {
    this.log('\n🚀 Initializing direct test...', 'cyan');
    
    // MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    this.log('✅ Connected to MongoDB', 'green');

    // Initialize BullMQ queues
    const queueConnection = { connection: this.redis };
    this.videoQueue = new Queue('video-processing', queueConnection);
    this.audioQueue = new Queue('audio-extraction', queueConnection);

    // Create test video if needed
    const testVideo = './test.mp4';
    try {
      await fs.access(testVideo);
      this.log('✅ Test video found', 'green');
    } catch {
      this.log('Creating test video...', 'yellow');
      await execPromise(`ffmpeg -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=5 -c:v libx264 -c:a aac -y ${testVideo}`);
    }
  }

  async createTestProcess() {
    this.log('\n📝 Creating test process directly...', 'cyan');
    
    const Process = mongoose.model('Process');
    const Tenant = mongoose.model('Tenant');
    const User = mongoose.model('User');

    // Get first tenant and user
    const tenant = await Tenant.findOne({ isActive: true });
    const user = await User.findOne({ tenantId: tenant._id });

    if (!tenant || !user) {
      throw new Error('No tenant or user found');
    }

    // Create process document
    const process = new Process({
      tenantId: tenant._id,
      userId: user._id,
      originalFilename: 'test.mp4',
      status: 'uploaded',
      files: {
        original: {
          path: './test.mp4',
          size: (await fs.stat('./test.mp4')).size,
          duration: 5,
          format: 'mp4',
          resolution: { width: 1280, height: 720 }
        }
      },
      transcript: {
        language: 'en',
        segments: []
      }
    });

    await process.save();
    this.processId = process._id.toString();
    
    this.log(`✅ Process created: ${this.processId}`, 'green');
    return process;
  }

  async startProcessingPipeline() {
    this.log('\n🚀 Starting processing pipeline...', 'cyan');
    
    const processId = this.processId;
    const inputPath = './test.mp4';
    
    // Create output directories
    const processedDir = path.join('./uploads/processed', processId);
    await fs.mkdir(processedDir, { recursive: true });
    await fs.mkdir(path.join(processedDir, 'segments'), { recursive: true });
    
    const videoOutputPath = path.join(processedDir, 'video.mp4');
    const audioOutputPath = path.join(processedDir, 'audio.wav');

    this.log('📹 Adding video compression job...', 'yellow');
    const videoJob = await queueMethods.addVideoCompressionJob(
      processId,
      inputPath,
      videoOutputPath
    );
    this.log(`   Job ID: ${videoJob.id}`, 'blue');

    this.log('🎵 Adding audio extraction job...', 'yellow');
    const audioJob = await queueMethods.addAudioExtractionJob(
      processId,
      inputPath,
      audioOutputPath
    );
    this.log(`   Job ID: ${audioJob.id}`, 'blue');

    // Update process status
    const Process = mongoose.model('Process');
    await Process.findByIdAndUpdate(processId, { 
      status: 'processing_video',
      'jobs.videoProcessing': videoJob.id,
      'jobs.audioExtraction': audioJob.id
    });
  }

  async checkQueues() {
    this.log('\n🔍 Checking job queues...', 'cyan');
    
    // Video queue
    const videoJobs = await this.videoQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    this.log(`\nVideo Queue (${videoJobs.length} total jobs):`, 'yellow');
    
    for (const job of videoJobs) {
      if (job.data.processId === this.processId) {
        const state = await job.getState();
        this.log(`  📌 Our job: ${job.name} [${state}] Progress: ${job.progress}%`, 'magenta');
        
        if (state === 'completed') {
          this.log('    ✅ Result keys: ' + Object.keys(job.returnvalue || {}).join(', '), 'green');
        } else if (state === 'failed') {
          this.log('    ❌ Error: ' + job.failedReason, 'red');
        }
      }
    }

    // Audio queue
    const audioJobs = await this.audioQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    this.log(`\nAudio Queue (${audioJobs.length} total jobs):`, 'yellow');
    
    for (const job of audioJobs) {
      if (job.data.processId === this.processId) {
        const state = await job.getState();
        this.log(`  📌 Our job: ${job.name} [${state}] Progress: ${job.progress}%`, 'magenta');
      }
    }
  }

  async checkDatabase() {
    this.log('\n💾 Checking database...', 'cyan');
    
    const Process = mongoose.model('Process');
    const process = await Process.findById(this.processId);
    
    if (!process) {
      this.log('❌ Process not found!', 'red');
      return null;
    }

    this.log(`Status: ${process.status}`, 'blue');
    this.log(`Progress: ${process.progress?.percentage || 0}%`, 'blue');
    
    // Files check
    this.log('\nFiles:', 'yellow');
    this.log(`  Original: ${process.files?.original?.path ? '✅' : '❌'}`, process.files?.original ? 'green' : 'red');
    this.log(`  Processed: ${process.files?.processed?.path ? '✅' : '❌'}`, process.files?.processed ? 'green' : 'red');
    
    // CRITICAL CHECK
    this.log('\n🚨 CRITICAL FIELD CHECK:', 'yellow');
    
    // Check if pendingVideoResult exists in the schema
    const schemaPath = process.schema.path('pendingVideoResult');
    this.log(`  pendingVideoResult in schema: ${schemaPath ? '✅' : '❌'}`, schemaPath ? 'green' : 'red');
    
    // Check if value exists
    this.log(`  pendingVideoResult value: ${process.pendingVideoResult ? '✅' : '❌'}`, process.pendingVideoResult ? 'green' : 'red');
    
    // Try to set it manually to test
    if (!schemaPath) {
      this.log('\n⚠️  Attempting to set pendingVideoResult...', 'yellow');
      process.pendingVideoResult = { test: 'data' };
      
      try {
        await process.save();
        const reloaded = await Process.findById(this.processId);
        this.log(`  After save and reload: ${reloaded.pendingVideoResult ? '✅' : '❌'}`, reloaded.pendingVideoResult ? 'green' : 'red');
        
        if (!reloaded.pendingVideoResult) {
          this.log('  💀 CONFIRMED: pendingVideoResult is NOT persisted!', 'red');
          this.log('     The field is not in the MongoDB schema!', 'red');
        }
      } catch (error) {
        this.log('  ❌ Save error: ' + error.message, 'red');
      }
    }
    
    return process;
  }

  async checkFileSystem() {
    this.log('\n📁 Checking file system...', 'cyan');
    
    const processDir = path.join('./uploads/processed', this.processId);
    
    try {
      const files = await fs.readdir(processDir);
      this.log(`Files in ${processDir}:`, 'yellow');
      
      for (const file of files) {
        const stats = await fs.stat(path.join(processDir, file));
        this.log(`  - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`, 'blue');
        
        if (file === 'video.mp4') {
          this.log('    ✅ Compressed video found!', 'green');
          
          // Check codec
          try {
            const { stdout } = await execPromise(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${path.join(processDir, file)}"`);
            const codec = stdout.trim();
            this.log(`    Codec: ${codec}`, 'magenta');
          } catch (e) {
            this.log('    ❌ Failed to probe codec', 'red');
          }
        }
      }
    } catch (error) {
      this.log(`❌ Cannot access directory: ${error.message}`, 'red');
    }
  }

  async startWorkers() {
    this.log('\n🔧 Loading queue workers...', 'cyan');
    
    try {
      require('./src/services/queueWorkers');
      this.log('✅ Workers loaded', 'green');
      
      // Give workers time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      this.log('❌ Failed to load workers: ' + error.message, 'red');
    }
  }

  async monitor(seconds = 30) {
    this.log(`\n⏱️  Monitoring for ${seconds} seconds...`, 'cyan');
    
    for (let i = 0; i < seconds; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.log(`\n--- Check ${i + 5}s ---`, 'blue');
      await this.checkQueues();
      const process = await this.checkDatabase();
      await this.checkFileSystem();
      
      if (process?.status === 'completed' || process?.status === 'failed') {
        this.log(`\n🏁 Process finished: ${process.status}`, process.status === 'completed' ? 'green' : 'red');
        break;
      }
    }
  }

  async cleanup() {
    this.log('\n🧹 Cleaning up...', 'cyan');
    
    // Final report
    this.log('\n📊 FINAL DIAGNOSIS:', 'cyan');
    
    const Process = mongoose.model('Process');
    const finalProcess = await Process.findById(this.processId);
    
    if (finalProcess) {
      const videoFileExists = await fs.access(path.join('./uploads/processed', this.processId, 'video.mp4')).then(() => true).catch(() => false);
      
      this.log('Results:', 'yellow');
      this.log(`  Process created: ✅`, 'green');
      this.log(`  Jobs queued: ✅`, 'green');
      this.log(`  Video file exists: ${videoFileExists ? '✅' : '❌'}`, videoFileExists ? 'green' : 'red');
      this.log(`  pendingVideoResult persisted: ${finalProcess.pendingVideoResult ? '✅' : '❌'}`, finalProcess.pendingVideoResult ? 'green' : 'red');
      this.log(`  files.processed saved: ${finalProcess.files?.processed?.path ? '✅' : '❌'}`, finalProcess.files?.processed ? 'green' : 'red');
      
      if (videoFileExists && !finalProcess.files?.processed?.path) {
        this.log('\n💀 PROBLEM CONFIRMED:', 'red');
        this.log('   Video was compressed but path not saved in DB!', 'red');
        this.log('   Reason: pendingVideoResult is not in MongoDB schema', 'red');
      }
    }
    
    await mongoose.disconnect();
    await this.redis.quit();
  }

  async run() {
    try {
      await this.init();
      await this.createTestProcess();
      await this.startWorkers();
      await this.startProcessingPipeline();
      await this.monitor(30);
    } catch (error) {
      this.log('\n❌ Error: ' + error.message, 'red');
      console.error(error);
    } finally {
      await this.cleanup();
      process.exit(0);
    }
  }
}

// Run test
const tester = new DirectVideoTester();
tester.run().catch(console.error);