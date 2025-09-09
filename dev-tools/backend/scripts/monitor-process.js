#!/usr/bin/env node

const { Queue } = require('bullmq');
const axios = require('axios');

const redis = { host: 'localhost', port: 6379, db: 0 };
const processId = process.argv[2] || '68bee2cf55275c7aad1d8042';

console.log('🎬 Monitoring pipeline for process:', processId);
console.log('==================================\n');

const queues = {
  'video-processing': new Queue('video-processing', { connection: redis }),
  'audio-extraction': new Queue('audio-extraction', { connection: redis }),
  'transcription': new Queue('transcription', { connection: redis }),
  'ai-analysis': new Queue('ai-analysis', { connection: redis }),
  's3-upload': new Queue('s3-upload', { connection: redis }),
  'cleanup': new Queue('cleanup', { connection: redis })
};

const jobLog = new Map();
const timeline = [];
let checkCount = 0;

async function checkQueues() {
  checkCount++;
  const timestamp = new Date();
  console.log(`\nCheck #${checkCount} at ${timestamp.toLocaleTimeString()}`);
  console.log('─'.repeat(50));
  
  for (const [name, queue] of Object.entries(queues)) {
    const [active, completed, failed, waiting] = await Promise.all([
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getWaiting()
    ]);
    
    // Check waiting jobs
    for (const job of waiting) {
      if (job.data.processId === processId) {
        const key = `${name}:${job.id}`;
        if (!jobLog.has(key)) {
          jobLog.set(key, { status: 'waiting', startTime: timestamp });
          console.log(`  ⏳ Waiting in ${name}: ${job.name}`);
        }
      }
    }
    
    // Check active jobs
    for (const job of active) {
      if (job.data.processId === processId) {
        const key = `${name}:${job.id}`;
        if (!jobLog.has(key) || jobLog.get(key).status !== 'active') {
          jobLog.set(key, { status: 'active', startTime: timestamp });
          timeline.push({ time: timestamp, event: 'start', queue: name, job: job.name });
          console.log(`  ⚡ Started in ${name}: ${job.name} (progress: ${job.progress || 0}%)`);
        } else if (job.progress > 0) {
          console.log(`  ⟳  Progress in ${name}: ${job.name} - ${job.progress}%`);
        }
      }
    }
    
    // Check completed jobs
    for (const job of completed) {
      if (job.data.processId === processId) {
        const key = `${name}:${job.id}`;
        if (!jobLog.has(key) || jobLog.get(key).status !== 'completed') {
          const duration = job.finishedOn - job.processedOn;
          jobLog.set(key, { status: 'completed', endTime: timestamp, duration });
          timeline.push({ time: timestamp, event: 'complete', queue: name, job: job.name, duration });
          console.log(`  ✅ Completed in ${name}: ${job.name} (${duration}ms)`);
        }
      }
    }
    
    // Check failed jobs
    for (const job of failed) {
      if (job.data.processId === processId) {
        const key = `${name}:${job.id}`;
        if (!jobLog.has(key) || jobLog.get(key).status !== 'failed') {
          jobLog.set(key, { status: 'failed', endTime: timestamp });
          timeline.push({ time: timestamp, event: 'fail', queue: name, job: job.name, error: job.failedReason });
          console.log(`  ❌ Failed in ${name}: ${job.name} - ${job.failedReason}`);
        }
      }
    }
  }
  
  // Check process status via API
  try {
    const response = await axios.get(
      `http://localhost:5000/api/v1/tenants/68aff5b5c0d654854ea8c56e/processes/${processId}`,
      {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGIwNjE1MGZkZDFmMDNlN2JkYzg4MDIiLCJlbWFpbCI6InRlc3RhZG1pbkBwcm9jZXNzbWluZC5jb20iLCJ0ZW5hbnRJZCI6IjY4YWZmNWI1YzBkNjU0ODU0ZWE4YzU2ZSIsInJvbGUiOiJvd25lciIsImlhdCI6MTc1NzMzOTY3MywiZXhwIjoxNzU3OTQ0NDczfQ.yN5omBtuGjtvSTgLaVuaQYYnwgvGTspyms7LQQVVU-Q'
        }
      }
    );
    
    const process = response.data.data.process;
    console.log(`\n  📊 Process Status: ${process.status} | Progress: ${process.progress.percentage}%`);
    if (process.processingDetails) {
      console.log(`     Details: ${process.processingDetails}`);
    }
    
    if (process.status === 'completed') {
      console.log('\n🎉 Process completed successfully!\n');
      analyzeTimeline();
      cleanup();
      process.exit(0);
    } else if (process.status === 'failed') {
      console.log('\n❌ Process failed!\n');
      if (process.processingErrors?.length > 0) {
        process.processingErrors.forEach(err => {
          console.log(`  Error: ${err.stage} - ${err.error}`);
        });
      }
      cleanup();
      process.exit(1);
    }
  } catch (error) {
    // Ignore API errors during monitoring
  }
}

function analyzeTimeline() {
  console.log('\n📈 Pipeline Analysis');
  console.log('===================\n');
  
  // Find parallel execution groups
  const startEvents = timeline.filter(e => e.event === 'start');
  const parallelGroups = [];
  let currentGroup = [];
  let lastTime = null;
  
  for (const event of startEvents) {
    if (!lastTime || event.time - lastTime < 5000) {
      currentGroup.push(event);
    } else {
      if (currentGroup.length > 0) {
        parallelGroups.push(currentGroup);
      }
      currentGroup = [event];
    }
    lastTime = event.time;
  }
  
  if (currentGroup.length > 0) {
    parallelGroups.push(currentGroup);
  }
  
  console.log('🔄 Parallel Execution Groups:');
  parallelGroups.forEach((group, i) => {
    console.log(`\nGroup ${i + 1} (${group.length} jobs in parallel):`);
    group.forEach(job => {
      console.log(`  - ${job.job} (${job.queue})`);
    });
  });
  
  // Check specific parallelism requirements
  console.log('\n✓ Parallelism Checks:');
  
  // Phase 1: Video compression + Audio segmentation
  const videoStart = timeline.find(e => e.job === 'compress-video' && e.event === 'start');
  const audioSegStart = timeline.find(e => e.job === 'segment-audio' && e.event === 'start');
  
  if (videoStart && audioSegStart) {
    const diff = Math.abs(videoStart.time - audioSegStart.time);
    if (diff < 30000) {
      console.log(`✅ Phase 1: Video & Audio parallel (time diff: ${diff}ms)`);
    } else {
      console.log(`❌ Phase 1: Video & Audio NOT parallel (time diff: ${diff}ms)`);
    }
  }
  
  // Phase 2: AI jobs parallel
  const aiJobs = timeline.filter(e => 
    ['generate-tags', 'generate-todo', 'generate-title'].includes(e.job) && 
    e.event === 'start'
  );
  
  if (aiJobs.length === 3) {
    const times = aiJobs.map(j => j.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const maxDiff = maxTime - minTime;
    
    if (maxDiff < 2000) {
      console.log(`✅ Phase 2: AI jobs parallel (max diff: ${maxDiff}ms)`);
    } else {
      console.log(`❌ Phase 2: AI jobs NOT parallel (max diff: ${maxDiff}ms)`);
    }
  }
  
  // Embedding timing check
  const embeddingStart = timeline.find(e => e.job === 'generate-embedding' && e.event === 'start');
  const tagComplete = timeline.find(e => e.job === 'generate-tags' && e.event === 'complete');
  const titleComplete = timeline.find(e => e.job === 'generate-title' && e.event === 'complete');
  
  if (embeddingStart && tagComplete && titleComplete) {
    const prereqComplete = Math.max(tagComplete.time, titleComplete.time);
    if (embeddingStart.time > prereqComplete) {
      console.log(`✅ Embedding correctly waits for tags & title`);
    } else {
      console.log(`❌ Embedding started too early`);
    }
  }
  
  // Total pipeline time
  if (timeline.length > 1) {
    const firstEvent = timeline[0];
    const lastEvent = timeline[timeline.length - 1];
    const totalTime = lastEvent.time - firstEvent.time;
    console.log(`\n⏱️  Total pipeline time: ${Math.round(totalTime / 1000)}s`);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
}

// Start monitoring
const interval = setInterval(checkQueues, 3000);
checkQueues();

// Timeout after 5 minutes
setTimeout(() => {
  console.log('\n⏱️  Monitoring timeout after 5 minutes');
  analyzeTimeline();
  cleanup();
  process.exit(0);
}, 300000);

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down...');
  clearInterval(interval);
  await cleanup();
  process.exit(0);
});