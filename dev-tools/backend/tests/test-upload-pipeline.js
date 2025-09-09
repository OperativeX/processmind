require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function testUploadPipeline() {
  console.log('🚀 Starting video upload pipeline test...\n');
  
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
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Tenant ID: ${tenantId}\n`);
    
    // Step 2: Upload video
    console.log('📤 Step 2: Uploading test.mp4...');
    const videoPath = path.join(__dirname, 'test.mp4');
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('test.mp4 not found in backend directory');
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
    
    console.log('Upload response:', JSON.stringify(uploadResponse.data, null, 2));
    
    const process = uploadResponse.data.data?.process || uploadResponse.data.process;
    const processId = process._id;
    console.log('✅ Upload successful');
    console.log(`   Process ID: ${processId}`);
    console.log(`   Initial status: ${process.status}\n`);
    
    // Step 3: Monitor process status
    console.log('📊 Step 3: Monitoring process status...');
    console.log('   (Checking every 5 seconds)\n');
    
    let previousProgress = -1;
    let checkCount = 0;
    const maxChecks = 60; // 5 minutes max
    
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
        
        const process = statusResponse.data.process;
        
        if (process.progress !== previousProgress) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] Status: ${process.status}, Progress: ${process.progress}%`);
          
          if (process.currentStep) {
            console.log(`   Current step: ${process.currentStep}`);
          }
          
          if (process.jobs) {
            const jobCounts = {
              compression: process.jobs.compression?.length || 0,
              audioExtraction: process.jobs.audioExtraction?.length || 0,
              transcription: process.jobs.transcription?.length || 0,
              aiAnalysis: process.jobs.aiAnalysis?.length || 0
            };
            console.log(`   Jobs: Compression(${jobCounts.compression}), Audio(${jobCounts.audioExtraction}), Transcription(${jobCounts.transcription}), AI(${jobCounts.aiAnalysis})`);
          }
          
          previousProgress = process.progress;
        }
        
        if (process.status === 'completed') {
          console.log('\n✅ Process completed successfully!');
          console.log('\n📋 Final results:');
          console.log(`   Title: ${process.title || 'N/A'}`);
          console.log(`   Tags: ${process.tags?.join(', ') || 'N/A'}`);
          console.log(`   Transcript length: ${process.transcript?.text?.length || 0} characters`);
          console.log(`   Todo items: ${process.todoList?.length || 0}`);
          
          if (process.transcript?.text) {
            console.log(`\n📝 First 200 chars of transcript:`);
            console.log(`   "${process.transcript.text.substring(0, 200)}..."`);
          }
          
          return true;
        }
        
        if (process.status === 'failed') {
          console.log('\n❌ Process failed!');
          console.log(`   Error: ${process.error || 'Unknown error'}`);
          return true;
        }
        
        checkCount++;
        if (checkCount >= maxChecks) {
          console.log('\n⏱️  Timeout: Process took too long');
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
    
    console.log('\n🎉 Pipeline test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testUploadPipeline();