const mongoose = require('mongoose');
require('dotenv').config();

async function checkProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  
  const processId = '68c2c1dff4c0aeef48b1f25a';
  const proc = await Process.findById(processId);
  
  if (!proc) {
    console.log('Process not found');
    await mongoose.disconnect();
    return;
  }

  console.log('=== PROCESS STATUS ===');
  console.log('Status:', proc.status);
  console.log('Progress:', proc.progress.percentage + '%');
  console.log('Current Step:', proc.progress.currentStep);
  console.log('Step Details:', proc.progress.stepDetails);
  console.log('Created:', proc.createdAt);
  console.log('Last Updated:', proc.updatedAt);
  console.log('Time Running:', Math.round((Date.now() - proc.createdAt.getTime()) / 1000 / 60), 'minutes');
  
  console.log('\n=== FILE STATUS ===');
  console.log('Has Video Path:', !!proc.videoPath);
  console.log('S3 Video Key:', proc.s3VideoKey || 'none');
  console.log('Processed Storage Type:', proc.files?.processed?.storageType || 'none');
  
  console.log('\n=== PROCESSING STATUS ===');
  console.log('Has Transcript:', !!proc.transcript);
  console.log('Has Tags:', proc.tags?.length > 0);
  console.log('Has Title:', !!proc.title && proc.title !== 'New Process');
  console.log('Has Todos:', proc.todoList?.length > 0);
  console.log('Has Embedding:', !!proc.embedding);
  console.log('Processing Errors:', proc.processingErrors?.length || 0);
  
  if (proc.processingErrors?.length > 0) {
    console.log('\n=== ERRORS ===');
    proc.processingErrors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.step}: ${err.message}`);
    });
  }
  
  await mongoose.disconnect();
}

checkProcess().catch(console.error);