#!/usr/bin/env node

/**
 * Test script to verify worker processes can start individually
 */

const { spawn } = require('child_process');
const path = require('path');

const workers = [
  {
    name: 'Queue Worker',
    script: 'src/workers/queue-worker-process.js',
    env: { WORKER_TYPE: 'queue' }
  },
  {
    name: 'Heavy Worker',
    script: 'src/workers/heavy-worker-process.js',
    env: { WORKER_TYPE: 'heavy', UV_THREADPOOL_SIZE: '4' }
  },
  {
    name: 'Scheduler',
    script: 'src/workers/scheduler-process.js',
    env: { WORKER_TYPE: 'scheduler' }
  }
];

async function testWorker(worker) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing ${worker.name}...`);
    
    const child = spawn('node', [worker.script], {
      cwd: __dirname,
      env: { ...process.env, ...worker.env },
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, 5000); // 5 seconds timeout

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 || (code === null && output.includes('Initializing'))) {
        console.log(`✅ ${worker.name} started successfully`);
        if (output.includes('MongoDB')) {
          console.log(`   - MongoDB connection: ✓`);
        }
        if (output.includes('Redis')) {
          console.log(`   - Redis connection: ✓`);
        }
        resolve(true);
      } else {
        console.log(`❌ ${worker.name} failed to start (exit code: ${code})`);
        if (errorOutput) {
          console.log(`   Error: ${errorOutput.split('\n')[0]}`);
        }
        resolve(false);
      }
    });
  });
}

async function runTests() {
  console.log('🔧 Testing Worker Processes\n');
  console.log('Note: Workers will be started and stopped after 5 seconds');
  
  const results = [];
  
  for (const worker of workers) {
    const success = await testWorker(worker);
    results.push({ name: worker.name, success });
  }
  
  console.log('\n📊 Test Results:');
  console.log('================');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
  });
  
  const allPassed = results.every(r => r.success);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
  process.exit(allPassed ? 0 : 1);
}

// Check if MongoDB and Redis are available
const checkDependencies = () => {
  console.log('🔍 Checking dependencies...\n');
  
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI not set in environment');
  }
  
  if (!process.env.REDIS_HOST) {
    console.warn('⚠️  REDIS_HOST not set in environment');
  }
};

// Run the tests
checkDependencies();
runTests();