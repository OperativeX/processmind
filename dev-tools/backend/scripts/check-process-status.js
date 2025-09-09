#!/usr/bin/env node

const axios = require('axios');

const processId = process.argv[2] || '68bee9e955275c7aad1db4e1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGIwNjE1MGZkZDFmMDNlN2JkYzg4MDIiLCJlbWFpbCI6InRlc3RhZG1pbkBwcm9jZXNzbWluZC5jb20iLCJ0ZW5hbnRJZCI6IjY4YWZmNWI1YzBkNjU0ODU0ZWE4YzU2ZSIsInJvbGUiOiJvd25lciIsImlhdCI6MTc1NzMzOTY3MywiZXhwIjoxNzU3OTQ0NDczfQ.yN5omBtuGjtvSTgLaVuaQYYnwgvGTspyms7LQQVVU-Q';

console.log(`\n🔍 Monitoring process: ${processId}\n`);

async function checkStatus() {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/v1/tenants/68aff5b5c0d654854ea8c56e/processes/${processId}`,
      {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      }
    );
    
    const process = response.data.data.process;
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] Status: ${process.status} | Progress: ${process.progress.percentage}%`);
    
    if (process.processingDetails) {
      console.log(`  Details: ${process.processingDetails}`);
    }
    
    // Check S3 status
    const hasS3Location = !!process.files?.processed?.s3Location;
    const storageType = process.files?.processed?.storageType;
    
    if (hasS3Location) {
      console.log(`  ✅ S3 Upload complete: ${process.files.processed.s3Location}`);
    } else if (storageType === 's3') {
      console.log(`  ⚠️  Storage marked as S3 but no location yet`);
    }
    
    if (process.status === 'completed') {
      console.log('\n🎉 Process completed successfully!');
      console.log(`  Final status check:`);
      console.log(`  - Storage Type: ${storageType || 'Not set'}`);
      console.log(`  - S3 Location: ${process.files?.processed?.s3Location || 'Not set'}`);
      console.log(`  - Progress: ${process.progress.percentage}%`);
      
      if (!hasS3Location && storageType === 's3') {
        console.log('\n❌ WARNING: Process marked as completed but S3 location is missing!');
      }
      
      clearInterval(interval);
      process.exit(0);
    } else if (process.status === 'failed') {
      console.log('\n❌ Process failed!');
      clearInterval(interval);
      process.exit(1);
    }
    
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] Check failed: ${err.message}`);
  }
}

let count = 0;
const interval = setInterval(async () => {
  count++;
  await checkStatus();
  
  if (count > 45) { // 90 seconds
    console.log('\n⏱️  Timeout after 90 seconds');
    clearInterval(interval);
    process.exit(1);
  }
}, 2000);

// Initial check
checkStatus();