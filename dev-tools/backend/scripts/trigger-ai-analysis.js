const mongoose = require('mongoose');
const { queueMethods } = require('./src/config/bullmq');
const Process = require('./src/models/Process');
require('dotenv').config();

async function triggerAIAnalysis(processId) {
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
      hasTranscript: !!processDoc.transcript?.text,
      transcriptLength: processDoc.transcript?.text?.length || 0
    });

    if (!processDoc.transcript?.text) {
      console.error('❌ No transcript found for this process');
      return;
    }

    const transcript = processDoc.transcript.text;
    console.log('📝 Transcript sample:', transcript.substring(0, 100) + '...');

    // Update process status
    await processDoc.updateProgress(70, 'ai_analysis', 'Starting AI content analysis');
    
    console.log('🤖 Starting AI analysis jobs...');

    // Start AI analysis jobs
    const aiJobs = {
      tags: await queueMethods.addTagGenerationJob(processDoc._id.toString(), transcript),
      todo: await queueMethods.addTodoGenerationJob(processDoc._id.toString(), transcript),
      title: await queueMethods.addTitleGenerationJob(processDoc._id.toString(), transcript)
    };
    
    console.log('✅ AI analysis jobs added:');
    console.log(`  • Tags job: ${aiJobs.tags.id}`);
    console.log(`  • Todo job: ${aiJobs.todo.id}`);
    console.log(`  • Title job: ${aiJobs.title.id}`);
    
    // Store AI job IDs
    processDoc.jobs.aiAnalysis = {
      tags: aiJobs.tags.id,
      todo: aiJobs.todo.id,
      title: aiJobs.title.id
    };
    
    processDoc.status = 'analyzing';
    await processDoc.save();

    console.log('🎉 AI analysis triggered successfully!');
    
  } catch (error) {
    console.error('❌ Error triggering AI analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Get process ID from command line or use the most recent one
const processId = process.argv[2] || '68b03b82813726681761c994';
console.log(`🚀 Triggering AI analysis for process: ${processId}`);

triggerAIAnalysis(processId);