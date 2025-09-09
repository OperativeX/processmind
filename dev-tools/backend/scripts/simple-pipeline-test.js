#!/usr/bin/env node

/**
 * Simple pipeline test without fancy UI
 */

const fs = require('fs').promises;
const FormData = require('form-data');
const axios = require('axios');
const { Queue } = require('bullmq');

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:5000',
  TENANT_ID: process.env.TEST_TENANT_ID || '68aff5b5c0d654854ea8c56e',
  AUTH_TOKEN: process.env.AUTH_TOKEN || '',
  TEST_VIDEO: process.env.TEST_VIDEO || './test.mp4'
};

// Redis connection
const redis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0
};

// Queues
const queues = {
  'video-processing': new Queue('video-processing', { connection: redis }),
  'audio-extraction': new Queue('audio-extraction', { connection: redis }),
  'transcription': new Queue('transcription', { connection: redis }),
  'ai-analysis': new Queue('ai-analysis', { connection: redis }),
  's3-upload': new Queue('s3-upload', { connection: redis }),
  'cleanup': new Queue('cleanup', { connection: redis })
};

// Job tracking
const jobTimeline = [];

async function uploadVideo() {
  console.log('\n📤 Uploading video...');
  const startTime = Date.now();
  
  try {
    const form = new FormData();
    const videoBuffer = await fs.readFile(CONFIG.TEST_VIDEO);
    form.append('video', videoBuffer, {
      filename: 'test.mp4',
      contentType: 'video/mp4'
    });

    const response = await axios.post(
      `${CONFIG.API_URL}/api/v1/tenants/${CONFIG.TENANT_ID}/processes`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const uploadTime = Date.now() - startTime;
    console.log(`✅ Upload successful in ${uploadTime}ms`);
    console.log(`📌 Process ID: ${response.data.data.process._id}`);
    
    return response.data.data.process._id;
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

async function monitorJobs(processId) {
  console.log('\n📊 Monitoring pipeline...\n');
  
  const jobStates = new Map();
  let lastUpdate = Date.now();
  let isCompleted = false;
  
  const checkInterval = setInterval(async () => {
    try {
      // Check all queues
      for (const [queueName, queue] of Object.entries(queues)) {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount()
        ]);
        
        // Get active jobs
        const activeJobs = await queue.getActive();
        for (const job of activeJobs) {
          if (job.data.processId === processId) {
            const key = `${queueName}:${job.name}`;
            if (!jobStates.has(key)) {
              jobStates.set(key, { startTime: Date.now(), status: 'active' });
              console.log(`🚀 Started: ${job.name} in ${queueName}`);
              jobTimeline.push({
                time: Date.now(),
                event: 'start',
                queue: queueName,
                job: job.name
              });
            }
          }
        }
        
        // Get completed jobs
        const completedJobs = await queue.getCompleted();
        for (const job of completedJobs) {
          if (job.data.processId === processId) {
            const key = `${queueName}:${job.name}`;
            const state = jobStates.get(key);
            if (state && state.status === 'active') {
              state.status = 'completed';
              state.endTime = Date.now();
              const duration = state.endTime - state.startTime;
              console.log(`✅ Completed: ${job.name} (${duration}ms)`);
              jobTimeline.push({
                time: Date.now(),
                event: 'complete',
                queue: queueName,
                job: job.name,
                duration
              });
            }
          }
        }
        
        // Get failed jobs
        const failedJobs = await queue.getFailed();
        for (const job of failedJobs) {
          if (job.data.processId === processId) {
            console.error(`❌ Failed: ${job.name} - ${job.failedReason}`);
            jobTimeline.push({
              time: Date.now(),
              event: 'fail',
              queue: queueName,
              job: job.name,
              error: job.failedReason
            });
          }
        }
      }
      
      // Check process status
      const response = await axios.get(
        `${CONFIG.API_URL}/api/v1/tenants/${CONFIG.TENANT_ID}/processes/${processId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`
          }
        }
      );
      
      const process = response.data.data.process;
      
      if (process.status === 'completed' && !isCompleted) {
        isCompleted = true;
        console.log('\n✅ Process completed!');
        console.log(`📊 Progress: ${process.progress}%`);
        
        // Analyze timeline
        analyzeTimeline();
        
        clearInterval(checkInterval);
        await cleanup();
        process.exit(0);
      } else if (process.status === 'failed') {
        console.error('\n❌ Process failed!');
        if (process.errors && process.errors.length > 0) {
          process.errors.forEach(err => {
            console.error(`  - ${err.stage}: ${err.error}`);
          });
        }
        clearInterval(checkInterval);
        await cleanup();
        process.exit(1);
      }
      
      // Update progress every 10 seconds
      if (Date.now() - lastUpdate > 10000) {
        console.log(`⏳ Status: ${process.status} | Progress: ${process.progress}% | Details: ${process.processingDetails || 'N/A'}`);
        lastUpdate = Date.now();
      }
      
    } catch (error) {
      console.error('Monitor error:', error.message);
    }
  }, 2000);
  
  // Timeout after 5 minutes
  setTimeout(() => {
    console.error('\n⏱️  Timeout after 5 minutes');
    clearInterval(checkInterval);
    analyzeTimeline();
    cleanup();
    process.exit(1);
  }, 300000);
}

function analyzeTimeline() {
  console.log('\n📈 Pipeline Analysis:\n');
  
  // Group by parallel execution
  const parallelGroups = [];
  let currentGroup = [];
  let lastTime = 0;
  
  jobTimeline.filter(e => e.event === 'start').forEach(event => {
    if (event.time - lastTime > 5000 && currentGroup.length > 0) {
      parallelGroups.push([...currentGroup]);
      currentGroup = [];
    }
    currentGroup.push(event);
    lastTime = event.time;
  });
  
  if (currentGroup.length > 0) {
    parallelGroups.push(currentGroup);
  }
  
  // Check parallel phases
  console.log('🔄 Parallel Execution Groups:');
  parallelGroups.forEach((group, i) => {
    console.log(`\nGroup ${i + 1}:`);
    group.forEach(job => {
      console.log(`  - ${job.job} (${job.queue})`);
    });
  });
  
  // Check specific requirements
  console.log('\n✓ Phase Checks:');
  
  // Phase 1: Video + Audio should be parallel
  const videoStart = jobTimeline.find(e => e.job === 'compress-video' && e.event === 'start');
  const audioSegStart = jobTimeline.find(e => e.job === 'segment-audio' && e.event === 'start');
  
  if (videoStart && audioSegStart) {
    const diff = Math.abs(videoStart.time - audioSegStart.time);
    if (diff < 30000) { // Within 30 seconds
      console.log(`✅ Phase 1: Video & Audio processing parallel (diff: ${diff}ms)`);
    } else {
      console.log(`❌ Phase 1: Video & Audio NOT parallel (diff: ${diff}ms)`);
    }
  }
  
  // Phase 2: AI jobs should be parallel
  const tagStart = jobTimeline.find(e => e.job === 'generate-tags' && e.event === 'start');
  const todoStart = jobTimeline.find(e => e.job === 'generate-todo' && e.event === 'start');
  const titleStart = jobTimeline.find(e => e.job === 'generate-title' && e.event === 'start');
  
  if (tagStart && todoStart && titleStart) {
    const times = [tagStart.time, todoStart.time, titleStart.time];
    const maxDiff = Math.max(...times) - Math.min(...times);
    if (maxDiff < 2000) { // Within 2 seconds
      console.log(`✅ Phase 2: AI jobs parallel (max diff: ${maxDiff}ms)`);
    } else {
      console.log(`❌ Phase 2: AI jobs NOT parallel (max diff: ${maxDiff}ms)`);
    }
  }
  
  // Total time
  if (jobTimeline.length > 0) {
    const firstJob = jobTimeline[0];
    const lastJob = jobTimeline[jobTimeline.length - 1];
    const totalTime = lastJob.time - firstJob.time;
    console.log(`\n⏱️  Total pipeline time: ${totalTime}ms (${Math.round(totalTime / 1000)}s)`);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
}

async function main() {
  try {
    console.log('🎬 Video Pipeline Test');
    console.log('====================');
    console.log(`📁 Video: ${CONFIG.TEST_VIDEO}`);
    console.log(`🌐 API: ${CONFIG.API_URL}`);
    console.log(`🏢 Tenant: ${CONFIG.TENANT_ID}`);
    
    // Check video exists
    await fs.access(CONFIG.TEST_VIDEO);
    const stats = await fs.stat(CONFIG.TEST_VIDEO);
    console.log(`📏 Size: ${Math.round(stats.size / 1024 / 1024)}MB`);
    
    // Upload and monitor
    const processId = await uploadVideo();
    await monitorJobs(processId);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  await cleanup();
  process.exit(0);
});

main();