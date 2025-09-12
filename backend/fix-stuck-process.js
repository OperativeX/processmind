const mongoose = require('mongoose');
require('dotenv').config();

async function fixStuckProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  
  const processId = '68c2b9af931ec7fb6faf8722';
  const proc = await Process.findById(processId);
  
  if (!proc) {
    console.log('Process not found');
    await mongoose.disconnect();
    return;
  }

  console.log('Current status:', proc.status);
  console.log('Current progress:', proc.progress.percentage + '%');
  
  // Check if video file exists
  const fs = require('fs');
  const path = require('path');
  const expectedVideoPath = path.join(__dirname, 'uploads/processed', 
    proc.tenantId.toString(), processId, 'video.mp4');
  
  console.log('Checking video at:', expectedVideoPath);
  const videoExists = fs.existsSync(expectedVideoPath);
  console.log('Video exists:', videoExists);
  
  if (videoExists) {
    // Update the process with the video path
    proc.videoPath = expectedVideoPath.replace(__dirname + '/', '');
    proc.status = 'completed';
    proc.progress = {
      percentage: 100,
      currentStep: 'completed',
      stepDetails: 'Verarbeitung abgeschlossen',
      estimatedTimeRemaining: 0
    };
    
    await proc.save();
    console.log('Process fixed! Status set to completed.');
  } else {
    // Mark as failed if video doesn't exist
    proc.status = 'failed';
    proc.progress = {
      percentage: 96,
      currentStep: 'failed',
      stepDetails: 'Video-Verarbeitung fehlgeschlagen',
      estimatedTimeRemaining: 0
    };
    proc.processingErrors.push({
      step: 'video_compression',
      message: 'Video file not found after processing',
      details: { expectedPath: expectedVideoPath },
      timestamp: new Date()
    });
    
    await proc.save();
    console.log('Process marked as failed - video file not found.');
  }
  
  await mongoose.disconnect();
}

fixStuckProcess().catch(console.error);