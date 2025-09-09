#!/usr/bin/env node

/**
 * Test streaming upload functionality
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:5000';

// Create a test video file (small size for testing)
function createTestVideo(sizeMB = 1) {
  const filePath = path.join(__dirname, 'test-video.mp4');
  const size = sizeMB * 1024 * 1024;
  const buffer = Buffer.alloc(size);
  
  // Add some MP4 headers to make it look like a video
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
  ]);
  
  mp4Header.copy(buffer);
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
}

async function testStreamingUpload(testFile, description) {
  console.log(`\n🧪 ${description}`);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    // Create form data
    const form = new FormData();
    form.append('video', fs.createReadStream(testFile), {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });
    
    // Monitor memory during upload
    const memoryInterval = setInterval(() => {
      const current = process.memoryUsage();
      const heapDelta = (current.heapUsed - startMemory.heapUsed) / 1024 / 1024;
      console.log(`   Memory: +${heapDelta.toFixed(2)}MB heap`);
    }, 1000);
    
    // Make the request
    const response = await axios({
      method: 'POST',
      url: `${API_BASE}/api/v1/tenants/test/processes`,
      data: form,
      headers: {
        ...form.getHeaders(),
        'Authorization': 'Bearer test-token' // Would need real auth in production
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
      validateStatus: () => true,
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        process.stdout.write(`\r   Upload Progress: ${percentCompleted}%`);
      }
    });
    
    clearInterval(memoryInterval);
    console.log(''); // New line after progress
    
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
    
    return {
      success: response.status < 400,
      status: response.status,
      duration,
      memoryUsed: memoryUsed.toFixed(2),
      error: response.data.message || null
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

async function runTests() {
  console.log('🚀 Testing Streaming Upload\n');
  console.log(`Server: ${API_BASE}`);
  console.log('================================\n');
  
  // Check if server is running
  try {
    await axios.get(API_BASE + '/health', { timeout: 2000 });
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not running');
    console.error('   Note: This test requires authentication and proper setup\n');
    process.exit(1);
  }
  
  const testCases = [
    { size: 1, description: 'Small file (1MB)' },
    { size: 10, description: 'Medium file (10MB)' },
    { size: 50, description: 'Large file (50MB)' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const testFile = createTestVideo(testCase.size);
    const fileStats = fs.statSync(testFile);
    
    console.log(`📁 Test file: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB`);
    
    const result = await testStreamingUpload(testFile, testCase.description);
    results.push({ ...testCase, ...result });
    
    // Clean up test file
    fs.unlinkSync(testFile);
    
    if (result.success) {
      console.log(`✅ Upload successful`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Memory Delta: ${result.memoryUsed}MB`);
    } else {
      console.log(`❌ Upload failed`);
      console.log(`   Status: ${result.status || 'ERROR'}`);
      console.log(`   Error: ${result.error}`);
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${results.length - successful}`);
  
  // Memory efficiency check
  const avgMemoryPerMB = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + (parseFloat(r.memoryUsed) / r.size), 0) / successful || 0;
  
  console.log(`\nMemory Efficiency: ${avgMemoryPerMB.toFixed(2)}MB heap per MB uploaded`);
  
  if (avgMemoryPerMB < 1) {
    console.log('✅ Excellent memory efficiency (streaming is working)');
  } else if (avgMemoryPerMB < 2) {
    console.log('⚠️  Good memory efficiency');
  } else {
    console.log('❌ Poor memory efficiency (file may be loaded into memory)');
  }
  
  console.log('\nNote: Upload tests may fail due to authentication requirements.');
  console.log('The important metric is memory efficiency during upload attempt.');
}

// Install form-data if not available
try {
  require('form-data');
} catch (e) {
  console.log('Installing form-data package...');
  require('child_process').execSync('npm install form-data', { stdio: 'inherit' });
}

// Run tests
runTests().catch(console.error);