require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function testFullPipeline() {
  console.log('🚀 Starting full pipeline test...\n');
  console.log('📊 Testing video processing with:');
  console.log('   - Audio extraction');
  console.log('   - Whisper transcription');
  console.log('   - AI analysis (Tags, Title, Todo)\n');
  
  try {
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'pipeline@test.com',
      password: 'Test1234!'
    });
    
    const token = loginResponse.data.data.tokens.accessToken;
    const user = loginResponse.data.data.user;
    const tenantId = user.tenantId.id;
    console.log('✅ Login successful\n');
    
    // Step 2: Upload video
    console.log('📤 Step 2: Uploading test.mp4...');
    const videoPath = path.join(__dirname, 'test.mp4');
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('test.mp4 not found');
    }
    
    const fileStats = fs.statSync(videoPath);
    console.log(`   File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    const formData = new FormData();
    formData.append('video', fs.createReadStream(videoPath));
    
    const uploadResponse = await axios.post(
      `${API_BASE_URL}/tenants/${tenantId}/processes`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Debug: log the full response
    console.log('Upload response structure:', Object.keys(uploadResponse.data));
    
    const responseData = uploadResponse.data;
    let processId;
    
    // Try different response structures
    if (responseData.data?.process?.id) {
      processId = responseData.data.process.id;
    } else if (responseData.data?.process?._id) {
      processId = responseData.data.process._id;
    } else if (responseData.process?.id) {
      processId = responseData.process.id;
    } else if (responseData.process?._id) {
      processId = responseData.process._id;
    } else if (responseData.data?.processId) {
      processId = responseData.data.processId;
    } else if (responseData.processId) {
      processId = responseData.processId;
    } else if (responseData._id) {
      processId = responseData._id;
    } else if (responseData.id) {
      processId = responseData.id;
    }
    
    if (!processId) {
      console.error('Could not find process ID in response:', JSON.stringify(responseData, null, 2));
      throw new Error('Process ID not found in upload response');
    }
    
    console.log('✅ Upload successful');
    console.log(`   Process ID: ${processId}\n`);
    
    // Step 3: Monitor process status
    console.log('📊 Step 3: Monitoring pipeline progress...\n');
    
    let previousProgress = -1;
    let checkCount = 0;
    const maxChecks = 120; // 10 minutes max
    
    const checkStatus = async () => {
      try {
        const statusResponse = await axios.get(
          `${API_BASE_URL}/tenants/${tenantId}/processes/${processId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const process = statusResponse.data.data?.process || statusResponse.data.process;
        const progress = process.progress?.percentage || process.progress || 0;
        
        if (progress !== previousProgress) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] Progress: ${progress}%`);
          
          if (process.progress?.currentStep) {
            console.log(`   Step: ${process.progress.currentStep} - ${process.progress.stepDetails || ''}`);
          } else if (process.currentStep) {
            console.log(`   Step: ${process.currentStep}`);
          }
          
          // Log specific milestones
          if (process.transcript?.text && previousProgress < 40) {
            console.log(`   ✅ Transcription complete: ${process.transcript.text.length} characters`);
          }
          
          if (process.tags?.length > 0 && !previousProgress.tagLogged) {
            console.log(`   ✅ Tags generated: ${process.tags.join(', ')}`);
            previousProgress.tagLogged = true;
          }
          
          if (process.title !== 'New Process' && !previousProgress.titleLogged) {
            console.log(`   ✅ Title generated: "${process.title}"`);
            previousProgress.titleLogged = true;
          }
          
          if (process.todoList?.length > 0 && !previousProgress.todoLogged) {
            console.log(`   ✅ Todo list generated: ${process.todoList.length} items`);
            previousProgress.todoLogged = true;
          }
          
          previousProgress = progress;
        }
        
        if (process.status === 'completed' || progress === 100) {
          console.log('\n✅ Pipeline completed successfully!\n');
          console.log('📋 Final Results:');
          console.log(`   Status: ${process.status}`);
          console.log(`   Title: "${process.title || 'N/A'}"`);
          console.log(`   Tags: ${process.tags?.join(', ') || 'None'}`);
          console.log(`   Transcript: ${process.transcript?.text?.length || 0} characters`);
          console.log(`   Todo items: ${process.todoList?.length || 0}`);
          console.log(`   Video duration: ${process.files?.original?.duration?.toFixed(1) || '?'} seconds`);
          
          if (process.transcript?.text) {
            console.log(`\n📝 Transcript preview:`);
            console.log(`   "${process.transcript.text.substring(0, 300)}..."`);
          }
          
          if (process.todoList?.length > 0) {
            console.log(`\n📋 Todo items:`);
            process.todoList.slice(0, 3).forEach((todo, i) => {
              console.log(`   ${i + 1}. ${todo.task}`);
            });
            if (process.todoList.length > 3) {
              console.log(`   ... and ${process.todoList.length - 3} more`);
            }
          }
          
          return true;
        }
        
        if (process.status === 'failed') {
          console.log('\n❌ Pipeline failed!');
          console.log(`   Error: ${process.error || 'Unknown error'}`);
          return true;
        }
        
        checkCount++;
        if (checkCount >= maxChecks) {
          console.log('\n⏱️  Timeout: Process took too long');
          console.log(`   Last status: ${process.status}`);
          console.log(`   Last progress: ${progress}%`);
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking status:', error.message);
        return false;
      }
    };
    
    // Check status every 5 seconds
    while (!(await checkStatus())) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n🎉 Full pipeline test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
console.log('='.repeat(60));
console.log('Process Mind - Full Pipeline Test');
console.log('='.repeat(60) + '\n');

testFullPipeline();