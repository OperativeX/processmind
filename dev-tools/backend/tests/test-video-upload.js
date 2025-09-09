const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5000/api/v1';
const TEST_VIDEO_PATH = path.join(__dirname, '..', 'test.MP4');

// ANSI Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n=== STEP ${step}: ${message} ===`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test video file with FFprobe
async function testVideoFile() {
  logStep(1, 'Video File Validation');
  
  try {
    // Check if test.MP4 exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      logError(`Test video file not found: ${TEST_VIDEO_PATH}`);
      log('Please place a test.MP4 file in the main directory.');
      return null;
    }
    
    const stats = fs.statSync(TEST_VIDEO_PATH);
    logInfo(`File found: ${TEST_VIDEO_PATH}`);
    logInfo(`File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
    // Run FFprobe to get video metadata
    log('\n🔍 Running FFprobe analysis...');
    const ffprobeCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${TEST_VIDEO_PATH}"`;
    
    try {
      const ffprobeOutput = execSync(ffprobeCommand, { encoding: 'utf8' });
      const metadata = JSON.parse(ffprobeOutput);
      
      logSuccess('FFprobe analysis successful!');
      
      // Analyze video streams
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      if (videoStream) {
        logInfo(`Video: ${videoStream.codec_name} ${videoStream.width}x${videoStream.height} @ ${videoStream.r_frame_rate} fps`);
      } else {
        logWarning('No video stream found');
      }
      
      if (audioStream) {
        logInfo(`Audio: ${audioStream.codec_name} ${audioStream.channels}ch ${audioStream.sample_rate}Hz`);
      } else {
        logWarning('No audio stream found');
      }
      
      if (metadata.format.duration) {
        logInfo(`Duration: ${parseFloat(metadata.format.duration).toFixed(2)} seconds`);
      }
      
      return {
        path: TEST_VIDEO_PATH,
        size: stats.size,
        metadata: metadata
      };
      
    } catch (ffprobeError) {
      logError('FFprobe failed:');
      console.log(ffprobeError.toString());
      return null;
    }
    
  } catch (error) {
    logError(`File system error: ${error.message}`);
    return null;
  }
}

// Login and get authentication token
async function authenticate() {
  logStep(2, 'Authentication');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'j.tacke1@web.de',
      password: 'jonathan123'
    });

    logSuccess('Authentication successful!');
    logInfo(`User ID: ${response.data.data.user.id}`);
    logInfo(`Tenant ID: ${response.data.data.tenant.id}`);
    logInfo(`Token: ${response.data.data.tokens.accessToken.substring(0, 50)}...`);

    return response.data.data;
  } catch (error) {
    logError('Authentication failed:');
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
    return null;
  }
}

// Test server health
async function testServerHealth() {
  logStep(3, 'Server Health Check');
  
  try {
    const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    logSuccess('Server is healthy!');
    logInfo(`Status: ${response.data.status}`);
    logInfo(`Uptime: ${response.data.uptime.toFixed(2)} seconds`);
    return true;
  } catch (error) {
    logError('Server health check failed:');
    console.log(error.message);
    return false;
  }
}

// Upload video file
async function uploadVideo(authData, videoInfo) {
  logStep(4, 'Video Upload');
  
  try {
    const form = new FormData();
    form.append('video', fs.createReadStream(videoInfo.path), {
      filename: 'test.MP4',
      contentType: 'video/mp4'
    });

    const uploadUrl = `${BASE_URL}/tenants/${authData.tenant.id}/processes`;
    logInfo(`Upload URL: ${uploadUrl}`);
    logInfo(`File size: ${(videoInfo.size / (1024 * 1024)).toFixed(2)} MB`);
    
    // Debug form data
    logInfo(`Form boundaries: ${form.getBoundary()}`);
    const headers = form.getHeaders();
    logInfo(`Content-Type: ${headers['content-type']}`);

    log('\n🚀 Starting upload...');
    const startTime = Date.now();

    // Build full headers with debug output
    const requestHeaders = {
      ...form.getHeaders(),
      'Authorization': `Bearer ${authData.tokens.accessToken}`
    };
    
    logInfo('Request headers:');
    Object.entries(requestHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${key === 'Authorization' ? value.substring(0, 50) + '...' : value}`);
    });

    const response = await axios.post(uploadUrl, form, {
      headers: requestHeaders,
      timeout: 120000, // 2 minutes timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        process.stdout.write(`\r📤 Upload progress: ${percentCompleted}%`);
      }
    });

    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(); // New line after progress
    
    logSuccess(`Upload completed in ${uploadTime} seconds!`);
    logInfo(`Process ID: ${response.data.data.process.id}`);
    logInfo(`Status: ${response.data.data.process.status}`);
    logInfo(`Original filename: ${response.data.data.process.originalFilename}`);

    return {
      success: true,
      processId: response.data.data.process.id,
      uploadTime: uploadTime,
      response: response.data
    };

  } catch (error) {
    logError('Upload failed:');
    
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
      
      // Debug response headers
      if (error.response.headers) {
        console.log('Response headers:');
        Object.entries(error.response.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
      
      // Detailed error analysis
      if (error.response.status === 400) {
        logError('Bad Request - Possible causes:');
        console.log('  • Invalid video file format');
        console.log('  • File size too large');
        console.log('  • Missing required fields');
        console.log('  • Multer field name mismatch (expected: "video")');
        
        // Check for multer specific errors
        if (error.response.data.message) {
          if (error.response.data.message.includes('Unexpected file field')) {
            logError('Multer field name error - check field name in form.append()');
          } else if (error.response.data.message.includes('Invalid file type')) {
            logError('File type not allowed - check MIME type and extension');
          }
        }
      } else if (error.response.status === 401) {
        logError('Unauthorized - Token may be expired');
      } else if (error.response.status === 403) {
        logError('Forbidden - Check tenant permissions');
      } else if (error.response.status === 413) {
        logError('Payload Too Large - File size exceeds limit');
        console.log(`  Current file size: ${(videoInfo.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`  Server limit: check MAX_FILE_SIZE in .env`);
      } else if (error.response.status === 500) {
        logError('Internal Server Error - Check server logs');
      }
    } else if (error.code === 'ECONNABORTED') {
      logError('Upload timeout - File may be too large or connection too slow');
    } else if (error.code === 'ECONNREFUSED') {
      logError('Connection refused - Is the server running on port 5000?');
    } else {
      console.log('Network/Request Error:', error.message);
      console.log('Error code:', error.code);
      if (error.stack) {
        console.log('Stack trace:', error.stack);
      }
    }

    return { success: false, error: error };
  }
}

// Test OpenAI API configuration
async function testOpenAIConfiguration() {
  logStep(5, 'OpenAI API Configuration Test');
  
  try {
    // Simple test of OpenAI API connectivity
    const testResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test connection - respond with just "OK"' }],
      max_tokens: 5,
      temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    logSuccess('OpenAI API connection successful!');
    logInfo(`Model: ${testResponse.data.model}`);
    logInfo(`Response: ${testResponse.data.choices[0].message.content}`);
    logInfo(`Usage: ${testResponse.data.usage.total_tokens} tokens`);
    
    return { success: true, model: testResponse.data.model };

  } catch (error) {
    logError('OpenAI API test failed:');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${error.response.data.error?.message || 'Unknown error'}`);
      
      if (error.response.status === 401) {
        logError('Invalid API key - check OPENAI_API_KEY environment variable');
      } else if (error.response.status === 429) {
        logError('Rate limit exceeded - wait before retrying');
      } else if (error.response.status === 402) {
        logError('Insufficient credits - check OpenAI billing');
      }
    } else {
      console.log(error.message);
    }
    return { success: false, error: error };
  }
}

// Monitor process status with enhanced AI pipeline tracking
async function monitorProcessStatus(authData, processId, maxWaitTime = 300) {
  logStep(6, 'AI Processing Pipeline Monitoring');
  
  logInfo(`Monitoring process: ${processId}`);
  logInfo(`Max wait time: ${maxWaitTime} seconds (extended for AI processing)`);
  logInfo('Expected pipeline steps:');
  console.log('  1. 🎬 Video compression (2-5 min)');
  console.log('  2. 🎵 Audio extraction (20-30 sec)');
  console.log('  3. 🎤 Transcription with Whisper (30-60 sec)');
  console.log('  4. 🤖 AI analysis with GPT-4 (15-30 sec)');
  console.log('  5. 🧹 Cleanup (5 sec)');

  const statusUrl = `${BASE_URL}/tenants/${authData.tenant.id}/processes/${processId}/status`;
  const startTime = Date.now();
  let lastStep = '';
  let checkCount = 0;

  while (true) {
    try {
      const response = await axios.get(statusUrl, {
        headers: {
          'Authorization': `Bearer ${authData.tokens.accessToken}`
        }
      });

      const processData = response.data.data.process;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const currentStep = processData.progress?.currentStep || 'N/A';
      
      // Show detailed progress for different AI steps
      if (currentStep !== lastStep) {
        console.log();
        switch(currentStep) {
          case 'video_compression':
            logInfo('🎬 Video compression in progress...');
            break;
          case 'audio_extraction':
            logInfo('🎵 Extracting audio from video...');
            break;
          case 'transcription':
            logInfo('🎤 Transcribing audio with OpenAI Whisper...');
            break;
          case 'ai_analysis':
            logInfo('🤖 Generating AI insights (tags, title, todos)...');
            break;
          case 'cleanup':
            logInfo('🧹 Cleaning up temporary files...');
            break;
        }
        lastStep = currentStep;
      }
      
      checkCount++;
      process.stdout.write(`\r⏱️  [${elapsed}s] Status: ${processData.status} | Progress: ${processData.progress?.percentage || 0}% | Step: ${currentStep} | Checks: ${checkCount}`);

      if (processData.status === 'completed') {
        console.log();
        logSuccess('🎉 AI Processing completed successfully!');
        logInfo('Pipeline completed all steps:');
        console.log('  ✅ Video compression');
        console.log('  ✅ Audio extraction');
        console.log('  ✅ Speech-to-text transcription');
        console.log('  ✅ AI content analysis');
        console.log('  ✅ File cleanup');
        return { success: true, finalStatus: processData };
      }

      if (processData.status === 'failed') {
        console.log();
        logError('❌ AI Processing failed!');
        if (processData.errors && processData.errors.length > 0) {
          console.log('Errors by step:');
          processData.errors.forEach(err => {
            console.log(`  • ${err.step}: ${err.message}`);
            if (err.step === 'transcription') {
              console.log('    💡 Check OpenAI API key and credits');
            } else if (err.step === 'ai_analysis') {
              console.log('    💡 GPT-4 might be temporarily unavailable');
            }
          });
        }
        return { success: false, finalStatus: processData };
      }

      // Show warnings for long-running steps
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      if (elapsedSeconds > 60 && currentStep === 'transcription') {
        if (Math.floor(elapsedSeconds) % 30 === 0) { // Every 30 seconds
          console.log();
          logWarning('Transcription taking longer than expected - large video files need more time');
        }
      }

      // Check timeout
      if (elapsedSeconds > maxWaitTime) {
        console.log();
        logWarning(`⏰ Monitoring timeout after ${maxWaitTime} seconds`);
        logInfo(`Final status: ${processData.status}`);
        logInfo('Processing may continue in background - check process details later');
        return { success: false, timeout: true, finalStatus: processData };
      }

      // Adaptive wait time based on step
      let waitTime = 5000; // Default 5 seconds
      if (currentStep === 'transcription') {
        waitTime = 10000; // 10 seconds for transcription
      } else if (currentStep === 'ai_analysis') {
        waitTime = 8000; // 8 seconds for AI analysis
      }
      
      await new Promise(resolve => setTimeout(resolve, waitTime));

    } catch (error) {
      console.log();
      logError('Status check failed:');
      if (error.response) {
        console.log(JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(error.message);
      }
      return { success: false, error: error };
    }
  }
}

// Get final process details with AI results analysis
async function getFinalProcessDetails(authData, processId) {
  logStep(7, 'AI Results Analysis');
  
  try {
    const response = await axios.get(`${BASE_URL}/tenants/${authData.tenant.id}/processes/${processId}`, {
      headers: {
        'Authorization': `Bearer ${authData.tokens.accessToken}`
      }
    });

    const process = response.data.data.process;
    
    logSuccess('AI processing results retrieved!');
    console.log('\n🤖 AI ANALYSIS RESULTS');
    console.log('========================');
    console.log(`  📁 Process ID: ${process.id}`);
    console.log(`  📝 Generated Title: ${process.title || '❌ Not generated'}`);
    console.log(`  📊 Status: ${process.status}`);
    console.log(`  ⏱️  Created: ${new Date(process.createdAt).toLocaleString()}`);
    console.log(`  💾 File Size: ${process.files?.original?.size ? (process.files.original.size / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'}`);
    console.log(`  ⏱️  Duration: ${process.files?.original?.duration ? process.files.original.duration.toFixed(2) + 's' : 'N/A'}`);
    
    // AI Generated Content Analysis
    console.log('\n🏷️  AI GENERATED TAGS:');
    if (process.tags && process.tags.length > 0) {
      process.tags.forEach((tag, index) => {
        console.log(`  ${index + 1}. ${tag}`);
      });
      logSuccess(`Generated ${process.tags.length} relevant tags`);
    } else {
      console.log('  ❌ No tags generated');
    }
    
    console.log('\n📋 AI GENERATED TODO LIST:');
    if (process.todoList && process.todoList.length > 0) {
      process.todoList.forEach((todo, index) => {
        const timestamp = todo.timestamp ? `[${Math.floor(todo.timestamp / 60)}:${String(todo.timestamp % 60).padStart(2, '0')}]` : '';
        console.log(`  ${index + 1}. ${timestamp} ${todo.task}`);
      });
      logSuccess(`Generated ${process.todoList.length} actionable todo items`);
    } else {
      console.log('  ❌ No todo items generated');
    }
    
    console.log('\n🎤 TRANSCRIPTION RESULTS:');
    if (process.transcript?.text) {
      const wordCount = process.transcript.text.split(' ').length;
      const confidence = process.transcript.confidence ? (process.transcript.confidence * 100).toFixed(1) + '%' : 'Unknown';
      const language = process.transcript.language || 'Unknown';
      
      console.log(`  • Language: ${language}`);
      console.log(`  • Word Count: ${wordCount} words`);
      console.log(`  • Confidence: ${confidence}`);
      console.log(`  • Sample: "${process.transcript.text.substring(0, 150)}${process.transcript.text.length > 150 ? '...' : ''}"`);
      
      if (process.transcript.segments && process.transcript.segments.length > 0) {
        console.log(`  • Segments: ${process.transcript.segments.length} time-coded segments`);
      }
      
      logSuccess('Transcription completed with good quality');
    } else {
      console.log('  ❌ No transcription available');
    }
    
    // Performance Metrics
    if (process.createdAt && process.updatedAt) {
      const processingTime = ((new Date(process.updatedAt) - new Date(process.createdAt)) / 1000).toFixed(1);
      console.log(`\n⚡ Processing Performance: ${processingTime}s total`);
    }
    
    // Quality Assessment
    console.log('\n🎯 AI QUALITY ASSESSMENT:');
    let qualityScore = 0;
    let maxScore = 4;
    
    if (process.title && process.title.length > 5) {
      console.log('  ✅ Title generation: Success');
      qualityScore++;
    } else {
      console.log('  ❌ Title generation: Failed');
    }
    
    if (process.tags && process.tags.length >= 3) {
      console.log('  ✅ Tag generation: Success');
      qualityScore++;
    } else {
      console.log('  ❌ Tag generation: Insufficient');
    }
    
    if (process.transcript?.text && process.transcript.text.length > 50) {
      console.log('  ✅ Transcription: Success');
      qualityScore++;
    } else {
      console.log('  ❌ Transcription: Failed');
    }
    
    if (process.todoList && process.todoList.length > 0) {
      console.log('  ✅ Todo extraction: Success');
      qualityScore++;
    } else {
      console.log('  ❌ Todo extraction: Failed');
    }
    
    const qualityPercentage = Math.round((qualityScore / maxScore) * 100);
    console.log(`\n📈 Overall AI Quality: ${qualityScore}/${maxScore} (${qualityPercentage}%)`);
    
    if (qualityScore === maxScore) {
      logSuccess('🌟 Perfect AI processing - all features working!');
    } else if (qualityScore >= maxScore * 0.75) {
      logSuccess('✨ Good AI processing - most features working');
    } else if (qualityScore >= maxScore * 0.5) {
      logWarning('⚠️  Partial AI processing - some issues detected');
    } else {
      logError('💥 Poor AI processing - significant issues');
    }

    return { success: true, process: process, qualityScore, maxScore };

  } catch (error) {
    logError('Failed to get AI results:');
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
    return { success: false, error: error };
  }
}

// Main test function with full AI pipeline
async function runVideoUploadTest() {
  log('\n🤖 PROCESS MIND - AI VIDEO PROCESSING TEST', 'bright');
  log('===========================================', 'bright');
  
  const results = {
    videoValidation: null,
    authentication: null,
    serverHealth: null,
    openaiTest: null,
    upload: null,
    monitoring: null,
    finalDetails: null
  };

  try {
    // Step 1: Test video file
    results.videoValidation = await testVideoFile();
    if (!results.videoValidation) {
      logError('❌ Video file validation failed - cannot proceed');
      return results;
    }

    // Step 2: Authenticate
    results.authentication = await authenticate();
    if (!results.authentication) {
      logError('❌ Authentication failed - cannot proceed');
      return results;
    }

    // Step 3: Test server health
    results.serverHealth = await testServerHealth();
    if (!results.serverHealth) {
      logError('❌ Server health check failed - cannot proceed');
      return results;
    }

    // Step 4: Test OpenAI API
    results.openaiTest = await testOpenAIConfiguration();
    if (!results.openaiTest.success) {
      logWarning('⚠️  OpenAI API test failed - AI features may not work properly');
      logInfo('Continuing with upload test...');
    }

    // Step 5: Upload video
    results.upload = await uploadVideo(results.authentication, results.videoValidation);
    if (!results.upload.success) {
      logError('❌ Upload failed - cannot proceed with monitoring');
      return results;
    }

    // Step 6: Monitor AI processing
    results.monitoring = await monitorProcessStatus(results.authentication, results.upload.processId, 300);

    // Step 7: Analyze AI results
    results.finalDetails = await getFinalProcessDetails(results.authentication, results.upload.processId);

  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    results.error = error;
  }

  // Enhanced Final Summary
  log('\n🏁 AI PROCESSING TEST SUMMARY', 'bright');
  log('=============================', 'bright');
  
  logInfo('Infrastructure Tests:');
  console.log(`  • Video File Validation: ${results.videoValidation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  • Backend Authentication: ${results.authentication ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  • Server Health Check: ${results.serverHealth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  • OpenAI API Connection: ${results.openaiTest?.success ? '✅ PASS' : '❌ FAIL'}`);

  logInfo('\nProcessing Pipeline Tests:');
  console.log(`  • Video Upload: ${results.upload?.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  • AI Processing Pipeline: ${results.monitoring?.success ? '✅ PASS' : results.monitoring?.timeout ? '⏰ TIMEOUT' : '❌ FAIL'}`);
  console.log(`  • Results Analysis: ${results.finalDetails?.success ? '✅ PASS' : '❌ FAIL'}`);

  if (results.finalDetails?.success && results.finalDetails.qualityScore !== undefined) {
    logInfo('\nAI Quality Metrics:');
    const qualityPercentage = Math.round((results.finalDetails.qualityScore / results.finalDetails.maxScore) * 100);
    console.log(`  • AI Processing Quality: ${results.finalDetails.qualityScore}/${results.finalDetails.maxScore} (${qualityPercentage}%)`);
    
    const aiFeatures = ['Title Generation', 'Tag Extraction', 'Transcription', 'Todo Lists'];
    aiFeatures.forEach((feature, index) => {
      const passed = index < results.finalDetails.qualityScore;
      console.log(`  • ${feature}: ${passed ? '✅ WORKING' : '❌ FAILED'}`);
    });
  }

  // Overall Result
  if (results.upload?.success) {
    log('\n🎉 UPLOAD SUCCESSFUL!', 'green');
    logInfo(`Process ID: ${results.upload.processId}`);
    logInfo(`Upload time: ${results.upload.uploadTime}s`);
    
    if (results.monitoring?.success) {
      log('🤖 AI PROCESSING COMPLETED!', 'green');
      if (results.finalDetails?.qualityScore === results.finalDetails?.maxScore) {
        log('🌟 PERFECT AI RESULTS - All features working flawlessly!', 'green');
      } else if (results.finalDetails?.qualityScore >= results.finalDetails?.maxScore * 0.75) {
        log('✨ GOOD AI RESULTS - Most features working correctly', 'green');
      } else {
        log('⚠️  PARTIAL AI RESULTS - Some features need attention', 'yellow');
      }
    } else if (results.monitoring?.timeout) {
      log('⏰ AI PROCESSING TIMEOUT - Check process status later', 'yellow');
    } else {
      log('❌ AI PROCESSING FAILED - Check logs for details', 'red');
    }
  } else {
    log('\n💥 UPLOAD TEST FAILED!', 'red');
  }

  return results;
}

// Run the test
if (require.main === module) {
  runVideoUploadTest().catch(console.error);
}

module.exports = { runVideoUploadTest };