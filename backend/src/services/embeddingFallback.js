const mongoose = require('mongoose');
const Process = require('../models/Process');
const redis = require('redis');
const logger = require('../utils/logger');

/**
 * Fallback function to ensure embeddings are saved
 * Checks Redis for completed embedding jobs and saves them to MongoDB
 */
async function ensureEmbeddingsSaved() {
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? 'redis://redis:6379' : 'redis://localhost:6379')
  });
  
  try {
    await redisClient.connect();
    
    // Find processes with embedding job but empty embedding
    const processesWithMissingEmbedding = await Process.find({
      'jobs.aiAnalysis.embedding': { $exists: true, $ne: null },
      $or: [
        { embedding: { $size: 0 } },
        { embedding: { $exists: false } }
      ]
    }).select('_id jobs.aiAnalysis.embedding').limit(10);

    for (const process of processesWithMissingEmbedding) {
      const jobId = process.jobs.aiAnalysis.embedding;
      
      try {
        // Get embedding from Redis
        const jobData = await redisClient.hGet(`bull:ai-analysis:${jobId}`, 'returnvalue');
        if (!jobData) continue;

        const result = JSON.parse(jobData);
        if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length !== 1536) continue;

        // Update process with embedding
        await Process.updateOne(
          { _id: process._id },
          { $set: { embedding: result.embedding } }
        );
        
        logger.info('Embedding recovered from Redis', {
          processId: process._id.toString(),
          jobId: jobId
        });
      } catch (error) {
        logger.error('Error recovering embedding', {
          processId: process._id.toString(),
          error: error.message
        });
      }
    }
  } catch (error) {
    logger.error('Embedding fallback error:', error);
  } finally {
    await redisClient.disconnect();
  }
}

// Run every 30 seconds
if (process.env.ENABLE_EMBEDDING_FALLBACK !== 'false') {
  setInterval(ensureEmbeddingsSaved, 30000);
  
  // Run once after 5 seconds
  setTimeout(ensureEmbeddingsSaved, 5000);
}

module.exports = { ensureEmbeddingsSaved };