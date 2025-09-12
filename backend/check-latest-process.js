const mongoose = require('mongoose');
require('dotenv').config();

async function checkLatestProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  
  // Find the latest process
  const proc = await Process.findOne()
    .sort({ createdAt: -1 })
    .limit(1);
  
  if (!proc) {
    console.log('No processes found');
    await mongoose.disconnect();
    return;
  }

  console.log('=== LATEST PROCESS ===');
  console.log('ID:', proc._id);
  console.log('Created:', proc.createdAt);
  console.log('Status:', proc.status);
  console.log('Progress:', proc.progress.percentage + '%');
  console.log('Current Step:', proc.progress.currentStep);
  console.log('Step Details:', proc.progress.stepDetails);
  
  console.log('\n=== COMPLETION FLAGS ===');
  console.log('Has Transcript:', !!proc.transcript);
  console.log('Has Tags:', proc.tags?.length > 0);
  console.log('Has Title:', !!proc.title && proc.title !== 'New Process');
  console.log('Has Todos:', proc.todoList?.length > 0);
  console.log('Has Embedding:', !!proc.embedding);
  
  console.log('\n=== FILE STATUS ===');
  console.log('Video Path:', proc.videoPath || proc.files?.processed?.path || 'none');
  console.log('S3 Video Key:', proc.s3VideoKey || 'none');
  console.log('Storage Type:', proc.files?.processed?.storageType || 'none');
  
  console.log('\n=== JOBS ===');
  if (proc.jobs) {
    console.log('Video Processing:', proc.jobs.videoProcessing || 'none');
    console.log('S3 Upload:', proc.jobs.s3Upload || 'none');
    console.log('Local Cleanup:', proc.jobs.localCleanup || 'none');
  }
  
  if (proc.processingErrors?.length > 0) {
    console.log('\n=== ERRORS ===');
    proc.processingErrors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.step}: ${err.message}`);
    });
  }
  
  await mongoose.disconnect();
}

checkLatestProcess().catch(console.error);