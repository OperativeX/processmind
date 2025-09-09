#!/usr/bin/env node

/**
 * Video Pipeline Test Script
 * Tests the complete video processing pipeline with detailed monitoring
 */

const path = require('path');
const fs = require('fs').promises;
const FormData = require('form-data');
const axios = require('axios');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
// Use colors from util instead of chalk for ES module compatibility
const { inspect } = require('util');
const colors = {
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};
const chalk = {
  cyan: { bold: (text) => colors.cyan(colors.bold(text)) },
  green: (text) => colors.green(text),
  yellow: (text) => colors.yellow(text),
  red: (text) => colors.red(text),
  gray: (text) => colors.gray(text),
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => colors.bold(text)
};
const { table } = require('table');

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:5000',
  TENANT_ID: process.env.TEST_TENANT_ID || 'test-tenant',
  AUTH_TOKEN: process.env.AUTH_TOKEN || '',
  TEST_VIDEO: process.env.TEST_VIDEO || './test-videos/sample.mp4',
  MONITOR_INTERVAL: 2000, // 2 seconds
  TIMEOUT: 600000 // 10 minutes
};

// Redis connection for monitoring
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0
});

// Queue instances for monitoring
const queues = {
  'video-processing': new Queue('video-processing', { connection: redis }),
  'audio-extraction': new Queue('audio-extraction', { connection: redis }),
  'transcription': new Queue('transcription', { connection: redis }),
  'ai-analysis': new Queue('ai-analysis', { connection: redis }),
  's3-upload': new Queue('s3-upload', { connection: redis }),
  'cleanup': new Queue('cleanup', { connection: redis })
};

// Pipeline stages tracking
const pipelineStages = {
  'upload': { status: 'pending', startTime: null, endTime: null },
  'audio-extraction': { status: 'pending', startTime: null, endTime: null },
  'video-compression': { status: 'pending', startTime: null, endTime: null },
  'audio-segmentation': { status: 'pending', startTime: null, endTime: null },
  'transcription': { status: 'pending', startTime: null, endTime: null, segments: 0 },
  'ai-tags': { status: 'pending', startTime: null, endTime: null },
  'ai-todo': { status: 'pending', startTime: null, endTime: null },
  'ai-title': { status: 'pending', startTime: null, endTime: null },
  'ai-embedding': { status: 'pending', startTime: null, endTime: null },
  's3-upload': { status: 'pending', startTime: null, endTime: null },
  'cleanup': { status: 'pending', startTime: null, endTime: null }
};

// Job tracking
const jobTracking = new Map();

// Utility functions
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function getStatusIcon(status) {
  switch (status) {
    case 'completed': return chalk.green('✓');
    case 'active': return chalk.yellow('⟳');
    case 'failed': return chalk.red('✗');
    case 'pending': return chalk.gray('○');
    default: return chalk.gray('?');
  }
}

// Clear console and show header
function showHeader() {
  console.clear();
  console.log(chalk.cyan.bold('\n=== VIDEO PIPELINE TEST ===\n'));
  console.log(chalk.gray(`Started: ${new Date().toLocaleTimeString()}`));
  console.log(chalk.gray(`Video: ${CONFIG.TEST_VIDEO}`));
  console.log(chalk.gray(`API: ${CONFIG.API_URL}\n`));
}

// Display pipeline status
function displayPipelineStatus() {
  const tableData = [
    [chalk.bold('Stage'), chalk.bold('Status'), chalk.bold('Duration'), chalk.bold('Details')]
  ];

  for (const [stage, data] of Object.entries(pipelineStages)) {
    let duration = '-';
    if (data.startTime) {
      const endTime = data.endTime || Date.now();
      duration = formatDuration(endTime - data.startTime);
    }

    let details = '';
    if (stage === 'transcription' && data.segments > 0) {
      details = `${data.segments} segments`;
    }

    tableData.push([
      stage,
      getStatusIcon(data.status) + ' ' + data.status,
      duration,
      details
    ]);
  }

  console.log('\n' + chalk.yellow('Pipeline Status:'));
  console.log(table(tableData));
}

// Display queue statistics
async function displayQueueStats() {
  const tableData = [
    [chalk.bold('Queue'), chalk.bold('Waiting'), chalk.bold('Active'), chalk.bold('Completed'), chalk.bold('Failed')]
  ];

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);

      tableData.push([
        name,
        waiting > 0 ? chalk.yellow(waiting) : waiting,
        active > 0 ? chalk.green(active) : active,
        completed > 0 ? chalk.blue(completed) : completed,
        failed > 0 ? chalk.red(failed) : failed
      ]);
    } catch (err) {
      tableData.push([name, '-', '-', '-', '-']);
    }
  }

  console.log('\n' + chalk.yellow('Queue Statistics:'));
  console.log(table(tableData));
}

// Display active jobs with progress
async function displayActiveJobs() {
  const activeJobs = [];

  for (const [queueName, queue] of Object.entries(queues)) {
    try {
      const jobs = await queue.getActive();
      for (const job of jobs) {
        activeJobs.push({
          queue: queueName,
          id: job.id,
          name: job.name,
          progress: job.progress || 0,
          processId: job.data.processId,
          startTime: job.processedOn
        });
      }
    } catch (err) {
      // Ignore errors
    }
  }

  if (activeJobs.length > 0) {
    console.log('\n' + chalk.yellow('Active Jobs:'));
    const tableData = [
      [chalk.bold('Queue'), chalk.bold('Job'), chalk.bold('Progress'), chalk.bold('Duration')]
    ];

    for (const job of activeJobs) {
      const duration = job.startTime ? formatDuration(Date.now() - job.startTime) : '-';
      const progressBar = generateProgressBar(job.progress);
      
      tableData.push([
        job.queue,
        `${job.name} (${job.id})`,
        progressBar + ` ${job.progress}%`,
        duration
      ]);
    }

    console.log(table(tableData));
  }
}

// Generate progress bar
function generateProgressBar(progress, width = 20) {
  const filled = Math.floor((progress / 100) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

// Monitor job events
async function setupJobMonitoring(processId) {
  // Monitor each queue for job events
  for (const [queueName, queue] of Object.entries(queues)) {
    // Listen for new jobs
    queue.on('waiting', (job) => {
      if (job.data.processId === processId) {
        console.log(chalk.blue(`\n[${new Date().toLocaleTimeString()}] New job: ${job.name} in ${queueName}`));
        jobTracking.set(job.id, { queue: queueName, name: job.name, startTime: Date.now() });
      }
    });

    // Listen for active jobs
    queue.on('active', (job) => {
      if (job.data.processId === processId) {
        updatePipelineStage(job.name, 'active');
      }
    });

    // Listen for completed jobs
    queue.on('completed', (job) => {
      if (job.data.processId === processId) {
        const jobInfo = jobTracking.get(job.id);
        if (jobInfo) {
          const duration = formatDuration(Date.now() - jobInfo.startTime);
          console.log(chalk.green(`\n[${new Date().toLocaleTimeString()}] Completed: ${job.name} (${duration})`));
        }
        updatePipelineStage(job.name, 'completed');
      }
    });

    // Listen for failed jobs
    queue.on('failed', (job, err) => {
      if (job.data.processId === processId) {
        console.log(chalk.red(`\n[${new Date().toLocaleTimeString()}] Failed: ${job.name} - ${err.message}`));
        updatePipelineStage(job.name, 'failed');
      }
    });
  }
}

// Update pipeline stage based on job name
function updatePipelineStage(jobName, status) {
  const now = Date.now();
  
  // Map job names to pipeline stages
  const stageMapping = {
    'extract-audio': 'audio-extraction',
    'compress-video': 'video-compression',
    'segment-audio': 'audio-segmentation',
    'transcribe-segment': 'transcription',
    'merge-transcripts': 'transcription',
    'generate-tags': 'ai-tags',
    'generate-todo': 'ai-todo',
    'generate-title': 'ai-title',
    'generate-embedding': 'ai-embedding',
    's3-upload-video': 's3-upload',
    'local-cleanup': 'cleanup'
  };

  const stage = stageMapping[jobName];
  if (stage && pipelineStages[stage]) {
    if (status === 'active' && pipelineStages[stage].status === 'pending') {
      pipelineStages[stage].status = 'active';
      pipelineStages[stage].startTime = now;
    } else if (status === 'completed') {
      pipelineStages[stage].status = 'completed';
      pipelineStages[stage].endTime = now;
    } else if (status === 'failed') {
      pipelineStages[stage].status = 'failed';
      pipelineStages[stage].endTime = now;
    }

    // Special handling for transcription segments
    if (jobName === 'transcribe-segment' && status === 'completed') {
      pipelineStages.transcription.segments++;
    }
  }
}

// Check parallel execution
function checkParallelExecution() {
  const parallelChecks = [];

  // Check Phase 1: Video compression and audio segmentation should run in parallel
  const videoStart = pipelineStages['video-compression'].startTime;
  const audioSegStart = pipelineStages['audio-segmentation'].startTime;
  
  if (videoStart && audioSegStart) {
    const timeDiff = Math.abs(videoStart - audioSegStart);
    if (timeDiff < 5000) { // Within 5 seconds
      parallelChecks.push(chalk.green('✓ Phase 1: Video compression and audio processing running in parallel'));
    } else {
      parallelChecks.push(chalk.red('✗ Phase 1: Video compression and audio processing NOT parallel (diff: ' + formatDuration(timeDiff) + ')'));
    }
  }

  // Check Phase 2: AI jobs should start in parallel
  const tagStart = pipelineStages['ai-tags'].startTime;
  const todoStart = pipelineStages['ai-todo'].startTime;
  const titleStart = pipelineStages['ai-title'].startTime;

  if (tagStart && todoStart && titleStart) {
    const maxDiff = Math.max(
      Math.abs(tagStart - todoStart),
      Math.abs(tagStart - titleStart),
      Math.abs(todoStart - titleStart)
    );
    
    if (maxDiff < 2000) { // Within 2 seconds
      parallelChecks.push(chalk.green('✓ Phase 2: AI analysis jobs running in parallel'));
    } else {
      parallelChecks.push(chalk.red('✗ Phase 2: AI analysis jobs NOT parallel (max diff: ' + formatDuration(maxDiff) + ')'));
    }
  }

  // Check embedding timing (should start after tags and title)
  const embeddingStart = pipelineStages['ai-embedding'].startTime;
  const tagEnd = pipelineStages['ai-tags'].endTime;
  const titleEnd = pipelineStages['ai-title'].endTime;

  if (embeddingStart && tagEnd && titleEnd) {
    const minEnd = Math.max(tagEnd, titleEnd);
    if (embeddingStart > minEnd) {
      parallelChecks.push(chalk.green('✓ Embedding generation correctly waits for tags and title'));
    } else {
      parallelChecks.push(chalk.red('✗ Embedding generation started too early'));
    }
  }

  if (parallelChecks.length > 0) {
    console.log('\n' + chalk.yellow('Parallel Execution Check:'));
    parallelChecks.forEach(check => console.log('  ' + check));
  }
}

// Upload video file
async function uploadVideo() {
  console.log(chalk.cyan('\nUploading video...'));
  
  pipelineStages.upload.status = 'active';
  pipelineStages.upload.startTime = Date.now();

  try {
    const form = new FormData();
    form.append('video', await fs.readFile(CONFIG.TEST_VIDEO), {
      filename: path.basename(CONFIG.TEST_VIDEO),
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

    pipelineStages.upload.status = 'completed';
    pipelineStages.upload.endTime = Date.now();

    const processId = response.data.data.process._id;
    console.log(chalk.green(`✓ Upload successful! Process ID: ${processId}`));
    
    return processId;
  } catch (error) {
    pipelineStages.upload.status = 'failed';
    pipelineStages.upload.endTime = Date.now();
    
    console.error(chalk.red('✗ Upload failed:'), error.response?.data || error.message);
    throw error;
  }
}

// Monitor process status via API
async function monitorProcessStatus(processId) {
  try {
    const response = await axios.get(
      `${CONFIG.API_URL}/api/v1/tenants/${CONFIG.TENANT_ID}/processes/${processId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`
        }
      }
    );

    const process = response.data.data.process;
    return {
      status: process.status,
      progress: process.progress || 0,
      details: process.processingDetails,
      errors: process.errors || []
    };
  } catch (error) {
    console.error(chalk.red('Failed to get process status:'), error.message);
    return null;
  }
}

// Main monitoring loop
async function runMonitoring(processId) {
  let lastUpdate = Date.now();
  let completed = false;

  const monitoringInterval = setInterval(async () => {
    showHeader();
    displayPipelineStatus();
    await displayQueueStats();
    await displayActiveJobs();
    checkParallelExecution();

    // Check process status
    const processStatus = await monitorProcessStatus(processId);
    if (processStatus) {
      console.log('\n' + chalk.yellow('Process Status:'));
      console.log(`  Status: ${processStatus.status}`);
      console.log(`  Progress: ${generateProgressBar(processStatus.progress)} ${processStatus.progress}%`);
      if (processStatus.details) {
        console.log(`  Details: ${processStatus.details}`);
      }

      if (processStatus.status === 'completed') {
        completed = true;
      } else if (processStatus.status === 'failed') {
        console.log(chalk.red('\n✗ Process failed!'));
        if (processStatus.errors.length > 0) {
          console.log(chalk.red('Errors:'));
          processStatus.errors.forEach(err => {
            console.log(`  - ${err.stage}: ${err.error}`);
          });
        }
        clearInterval(monitoringInterval);
      }
    }

    // Check for completion
    if (completed && pipelineStages.cleanup.status === 'completed') {
      const totalDuration = Date.now() - pipelineStages.upload.startTime;
      console.log(chalk.green(`\n✓ Pipeline completed successfully!`));
      console.log(chalk.cyan(`Total duration: ${formatDuration(totalDuration)}`));
      
      // Show final timing report
      console.log('\n' + chalk.yellow('Stage Timing Report:'));
      const timingData = [];
      for (const [stage, data] of Object.entries(pipelineStages)) {
        if (data.startTime && data.endTime) {
          timingData.push({
            stage,
            duration: data.endTime - data.startTime
          });
        }
      }
      
      timingData.sort((a, b) => b.duration - a.duration);
      timingData.forEach(({ stage, duration }) => {
        console.log(`  ${stage}: ${formatDuration(duration)}`);
      });
      
      clearInterval(monitoringInterval);
      process.exit(0);
    }

    // Check for timeout
    if (Date.now() - lastUpdate > CONFIG.TIMEOUT) {
      console.log(chalk.red('\n✗ Pipeline timeout!'));
      clearInterval(monitoringInterval);
      process.exit(1);
    }
  }, CONFIG.MONITOR_INTERVAL);
}

// Cleanup function
async function cleanup() {
  console.log('\nCleaning up...');
  await redis.quit();
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
}

// Main function
async function main() {
  try {
    // Check if test video exists
    try {
      await fs.access(CONFIG.TEST_VIDEO);
    } catch (err) {
      console.error(chalk.red(`Test video not found: ${CONFIG.TEST_VIDEO}`));
      console.log(chalk.yellow('Please create a test-videos directory and add a sample.mp4 file'));
      process.exit(1);
    }

    // Check if auth token is set
    if (!CONFIG.AUTH_TOKEN) {
      console.error(chalk.red('AUTH_TOKEN environment variable not set'));
      console.log(chalk.yellow('Please set AUTH_TOKEN with a valid JWT token'));
      process.exit(1);
    }

    showHeader();

    // Upload video
    const processId = await uploadVideo();

    // Setup monitoring
    await setupJobMonitoring(processId);

    // Start monitoring loop
    await runMonitoring(processId);

  } catch (error) {
    console.error(chalk.red('\nFatal error:'), error.message);
    await cleanup();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await cleanup();
  process.exit(0);
});

// Run the test
main();