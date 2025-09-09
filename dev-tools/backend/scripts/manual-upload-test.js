const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function uploadTestVideo() {
  try {
    // First login to get token
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'j.tacke1@web.de',
      password: 'Test123!@#'
    });
    
    const token = loginResponse.data.data.tokens.accessToken;
    const tenantId = loginResponse.data.data.tenant.id;
    console.log('Login successful, token:', token.substring(0, 30) + '...');
    console.log('Tenant ID:', tenantId);
    
    // Upload video
    console.log('\n2. Uploading test.mp4...');
    const form = new FormData();
    form.append('video', fs.createReadStream('./test.mp4'));
    
    const uploadResponse = await axios.post(
      `http://localhost:5000/api/v1/tenants/${tenantId}/processes`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const processId = uploadResponse.data.data.process.id;
    console.log('Upload successful, process ID:', processId);
    
    // Monitor status
    console.log('\n3. Monitoring process status...');
    let status = 'processing';
    let lastStatus = '';
    let checkCount = 0;
    
    while (status !== 'completed' && status !== 'failed' && checkCount < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `http://localhost:5000/api/v1/tenants/${tenantId}/processes/${processId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      status = statusResponse.data.data.status;
      const processingDetails = statusResponse.data.data.processingDetails;
      const progress = statusResponse.data.data.progress;
      
      if (status !== lastStatus || processingDetails) {
        console.log(`[${new Date().toLocaleTimeString()}] Status: ${status}, Details: ${processingDetails}, Progress: ${progress}%`);
        lastStatus = status;
      }
      
      checkCount++;
    }
    
    // Get final process details
    console.log('\n4. Getting final process details...');
    const finalResponse = await axios.get(
      `http://localhost:5000/api/v1/tenants/${tenantId}/processes/${processId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const finalProcess = finalResponse.data.data;
    console.log('\nFinal Process State:');
    console.log('Status:', finalProcess.status);
    console.log('Title:', finalProcess.title);
    console.log('Tags:', finalProcess.tags);
    console.log('Todo items:', finalProcess.todoList?.length || 0);
    console.log('Transcript length:', finalProcess.transcript?.text?.length || 0);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

uploadTestVideo();