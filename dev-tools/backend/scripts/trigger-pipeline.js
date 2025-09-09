const mongoose = require('mongoose');
const { queueMethods } = require('./src/config/bullmq');
const Process = require('./src/models/Process');
require('dotenv').config();

async function triggerPipelineForProcess(processId) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the process
    const processDoc = await Process.findById(processId);
    if (!processDoc) {
      console.error('❌ Process not found:', processId);
      return;
    }

    console.log('📄 Process found:', {
      id: processDoc._id,
      status: processDoc.status,
      originalFilename: processDoc.originalFilename
    });

    // Check if audio segmentation was completed (looking at Redis for completed segment job)
    const processedDir = `uploads/processed/${processId}`;
    const audioSegmentsDir = `${processedDir}/segments`;
    
    // Simulate the audio segmentation result (since it's already completed)
    const segmentationResult = {
      audioPath: `${processedDir}/audio.wav`,
      outputDir: audioSegmentsDir,
      processingTime: 0.33,
      segmentDuration: 600,
      totalDuration: 46.04375,
      segmentCount: 1,
      segments: [{
        index: 0,
        filename: 'segment_000.wav',
        path: `${audioSegmentsDir}/segment_000.wav`,
        size: 1473478,
        startTime: 0,
        endTime: 46.04375
      }]
    };

    console.log('🎤 Triggering transcription for audio segments...');

    // Update process status
    await processDoc.updateProgress(20, 'transcription', 'Starting audio transcription');

    // Add transcription jobs for each segment
    const transcriptionJobs = [];
    for (let i = 0; i < segmentationResult.segments.length; i++) {
      const segment = segmentationResult.segments[i];
      console.log(`Adding transcription job for segment ${i}: ${segment.path}`);
      
      const job = await queueMethods.addTranscriptionJob(
        processDoc._id.toString(),
        segment.path,
        i,
        segment.startTime
      );
      transcriptionJobs.push(job.id);
      console.log(`✅ Transcription job added: ${job.id}`);
    }

    // Store transcription job IDs for tracking
    processDoc.jobs.transcription = transcriptionJobs;
    processDoc.status = 'transcribing';
    await processDoc.save();

    console.log('🎉 Pipeline triggered successfully!');
    console.log(`📝 Transcription jobs: ${transcriptionJobs.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error triggering pipeline:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Get process ID from command line or use the most recent one
const processId = process.argv[2] || '68b038804bc365c2e01408c9';
console.log(`🚀 Triggering pipeline for process: ${processId}`);

triggerPipelineForProcess(processId);