const mongoose = require('mongoose');
require('dotenv').config();

async function fixStuckProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  const { queueMethods } = require('./src/config/bullmq');
  
  const processId = '68c2c7ab8c674605640f2c53';
  const proc = await Process.findById(processId);
  
  if (!proc) {
    console.log('Process not found');
    await mongoose.disconnect();
    return;
  }

  console.log('Current status:', proc.status);
  console.log('Current progress:', proc.progress.percentage + '%');
  console.log('Has S3 Upload Job:', !!proc.jobs?.s3Upload);
  
  // Process is stuck at 70% with all AI analysis complete but no S3 upload job
  if (proc.status === 'analyzing' && 
      proc.progress.percentage === 70 &&
      !proc.jobs?.s3Upload &&
      proc.files?.processed?.path) {
    
    console.log('Creating missing S3 upload job...');
    
    // Create S3 upload job
    const s3UploadJob = await queueMethods.addS3UploadJob(
      proc._id.toString(),
      proc.files.processed.path,
      proc.tenantId.toString(),
      proc.userId.toString()
    );
    
    console.log('S3 upload job created:', s3UploadJob.id);
    
    // Update process with job ID and status
    proc.jobs = proc.jobs || {};
    proc.jobs.s3Upload = s3UploadJob.id;
    proc.status = 'uploading';
    proc.progress = {
      percentage: 91,
      currentStep: 'uploading_to_s3',
      stepDetails: 'Video wird zu S3 hochgeladen...',
      estimatedTimeRemaining: 60
    };
    
    await proc.save();
    console.log('Process updated with S3 upload job!');
    
    // The S3 worker will handle the rest
  } else {
    console.log('Cannot fix - conditions not met');
    console.log('Status:', proc.status);
    console.log('Progress:', proc.progress.percentage);
    console.log('Has processed path:', !!proc.files?.processed?.path);
  }
  
  await mongoose.disconnect();
}

fixStuckProcess().catch(console.error);