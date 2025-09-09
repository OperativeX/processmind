const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');
const redis = require('redis');
const { promisify } = require('util');

async function fixEmbedding() {
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

    // Get embedding from Redis job
    const jobData = await redisClient.hGet('bull:ai-analysis:91', 'returnvalue');
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
    const processId = '68b2ec0bf14d1408ab74fca2';
    const processDoc = await ProcessModel.findById(processId);
    
    if (!processDoc) {
      console.error('Process not found');
      return;
    }

    processDoc.embedding = result.embedding;
    await processDoc.save();
    
    console.log('Embedding saved successfully!');
    console.log('Process ID:', processId);
    console.log('Embedding dimensions:', result.embedding.length);

    // Verify
    const updated = await ProcessModel.findById(processId);
    console.log('Verification - Embedding exists:', !!updated.embedding);
    console.log('Verification - Embedding length:', updated.embedding ? updated.embedding.length : 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

fixEmbedding();