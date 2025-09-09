const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');
const redis = require('redis');

async function fixSingleEmbedding() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('Connected to MongoDB');

    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('Connected to Redis');

    const processId = '68b3640b8b1a41378a6d12aa';
    const jobId = '115';
    
    console.log(`\nFixing embedding for process ${processId}...`);
    
    // Get embedding from Redis
    const jobData = await redisClient.hGet(`bull:ai-analysis:${jobId}`, 'returnvalue');
    if (!jobData) {
      console.error('Job data not found in Redis');
      return;
    }

    const result = JSON.parse(jobData);
    if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length !== 1536) {
      console.error('Invalid embedding in job result');
      return;
    }

    // Update process with embedding
    const processDoc = await ProcessModel.findById(processId);
    if (!processDoc) {
      console.error('Process not found');
      return;
    }

    processDoc.embedding = result.embedding;
    await processDoc.save();
    
    console.log('✅ Embedding saved successfully!');
    console.log('Title:', processDoc.title);
    console.log('Embedding dimensions:', result.embedding.length);

    // Verify
    const updated = await ProcessModel.findById(processId);
    console.log('Verification - Embedding length:', updated.embedding ? updated.embedding.length : 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

fixSingleEmbedding();