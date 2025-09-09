#!/usr/bin/env node

/**
 * Test script to verify server starts without workers
 */

const { spawn } = require('child_process');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting server without workers...\n');
    
    const server = spawn('node', ['src/server.js'], {
      cwd: __dirname,
      env: { 
        ...process.env, 
        DISABLE_WORKERS: 'true',
        NODE_ENV: 'test'
      },
      stdio: 'pipe'
    });

    let serverOutput = '';
    let serverReady = false;
    
    const timeout = setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000); // 30 seconds timeout

    server.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      process.stdout.write(output);
      
      // Check if server is ready
      if (output.includes('server running on port') || output.includes('Backend server running')) {
        serverReady = true;
        clearTimeout(timeout);
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    server.on('close', (code) => {
      clearTimeout(timeout);
      if (!serverReady) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

async function testEndpoints() {
  console.log('\n🧪 Testing endpoints...\n');
  
  const tests = [
    {
      name: 'Health Check',
      url: `${SERVER_URL}/health`,
      method: 'GET',
      expectedStatus: 200,
      checkResponse: (data) => data.status === 'ok'
    },
    {
      name: 'API Root',
      url: `${SERVER_URL}/api/v1`,
      method: 'GET',
      expectedStatus: 404 // No root handler
    }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      
      const passed = response.status === test.expectedStatus && 
                    (!test.checkResponse || test.checkResponse(response.data));
      
      results.push({
        name: test.name,
        passed,
        status: response.status,
        expected: test.expectedStatus
      });
      
      console.log(`${passed ? '✅' : '❌'} ${test.name} - Status: ${response.status}`);
      
    } catch (error) {
      results.push({
        name: test.name,
        passed: false,
        error: error.message
      });
      console.log(`❌ ${test.name} - Error: ${error.message}`);
    }
  }
  
  return results;
}

async function runTest() {
  let server;
  
  try {
    // Start server
    server = await startServer();
    console.log('\n✅ Server started successfully!');
    
    // Wait a bit for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test endpoints
    const results = await testEndpoints();
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    const passed = results.filter(r => r.passed).length;
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${results.length - passed}`);
    
    const allPassed = results.every(r => r.passed);
    console.log(`\n${allPassed ? '✅ All tests passed!' : '⚠️  Some tests failed'}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    // Clean up
    if (server) {
      console.log('\n🛑 Stopping server...');
      server.kill('SIGTERM');
      
      // Give server time to shut down gracefully
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Run the test
console.log('🔧 Testing Server Startup Without Workers\n');
console.log(`Port: ${PORT}`);
console.log(`Workers: DISABLED`);
console.log('================================\n');

runTest().catch(console.error);