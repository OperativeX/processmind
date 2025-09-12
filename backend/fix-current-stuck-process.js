const mongoose = require('mongoose');
require('dotenv').config();

async function fixStuckProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  
  const processId = '68c2c1dff4c0aeef48b1f25a';
  const proc = await Process.findById(processId);
  
  if (!proc) {
    console.log('Process not found');
    await mongoose.disconnect();
    return;
  }

  console.log('Current status:', proc.status);
  console.log('Current progress:', proc.progress.percentage + '%');
  console.log('Errors:', proc.processingErrors.length);
  
  // Since S3 upload failed but the file is already marked as in S3, 
  // and all processing is complete, we can mark it as completed
  if (proc.status === 'finalizing' && 
      proc.files?.processed?.storageType === 's3' &&
      proc.transcript && 
      proc.tags?.length > 0 && 
      proc.title && proc.title !== 'New Process' &&
      proc.embedding) {
    
    console.log('All processing is complete except cleanup. Marking as completed.');
    
    proc.status = 'completed';
    proc.progress = {
      percentage: 100,
      currentStep: 'completed',
      stepDetails: 'Verarbeitung abgeschlossen',
      estimatedTimeRemaining: 0
    };
    
    await proc.save();
    console.log('Process marked as completed!');
  } else {
    console.log('Cannot fix - not all conditions met');
    console.log('Has transcript:', !!proc.transcript);
    console.log('Has tags:', proc.tags?.length > 0);
    console.log('Has title:', !!proc.title && proc.title !== 'New Process');
    console.log('Has embedding:', !!proc.embedding);
    console.log('Storage type:', proc.files?.processed?.storageType);
  }
  
  await mongoose.disconnect();
}

fixStuckProcess().catch(console.error);