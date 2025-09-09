const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');
const redis = require('redis');

async function fixBothEmbeddings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('Connected to MongoDB');

    // Connect to Redis
    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('Connected to Redis');

    // Fix both processes
    const processesToFix = [
      { processId: '68b2ec0bf14d1408ab74fca2', jobId: '91' },
      { processId: '68b33d443b23c36b528f2c48', jobId: '95' }
    ];

    for (const { processId, jobId } of processesToFix) {
      console.log(`\nProcessing ${processId} with job ${jobId}...`);
      
      // Get embedding from Redis job
      const jobData = await redisClient.hGet(`bull:ai-analysis:${jobId}`, 'returnvalue');
      if (!jobData) {
        console.error(`Job data not found in Redis for job ${jobId}`);
        continue;
      }

      const result = JSON.parse(jobData);
      if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length !== 1536) {
        console.error(`Invalid embedding in job result for job ${jobId}`);
        continue;
      }

      // Update process with embedding
      const processDoc = await ProcessModel.findById(processId);
      
      if (!processDoc) {
        console.error(`Process ${processId} not found`);
        continue;
      }

      // Update embedding
      processDoc.embedding = result.embedding;
      
      // Also update the job ID if missing
      if (!processDoc.jobs.aiAnalysis.embedding) {
        processDoc.jobs.aiAnalysis.embedding = jobId;
        console.log(`Added missing embedding job ID: ${jobId}`);
      }
      
      await processDoc.save();
      
      console.log(`Embedding saved successfully for process ${processId}!`);
      console.log(`Embedding dimensions: ${result.embedding.length}`);

      // Verify
      const updated = await ProcessModel.findById(processId);
      console.log(`Verification - Embedding exists: ${!!updated.embedding}`);
      console.log(`Verification - Embedding length: ${updated.embedding ? updated.embedding.length : 0}`);
      console.log(`Verification - Job ID: ${updated.jobs.aiAnalysis.embedding}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

fixBothEmbeddings();