const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');
const redis = require('redis');
const logger = require('../src/utils/logger');

async function autoFixMissingEmbeddings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    logger.info('Connected to MongoDB for embedding auto-fix');

    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('Connected to Redis for embedding auto-fix');

    // Find all processes with embedding job but empty embedding
    const processesWithMissingEmbedding = await ProcessModel.find({
      'jobs.aiAnalysis.embedding': { $exists: true, $ne: null },
      $or: [
        { embedding: { $size: 0 } },
        { embedding: { $exists: false } }
      ]
    }).select('_id title jobs.aiAnalysis.embedding');

    if (processesWithMissingEmbedding.length === 0) {
      logger.info('No processes with missing embeddings found');
      return;
    }

    logger.info(`Found ${processesWithMissingEmbedding.length} processes with missing embeddings`);

    for (const process of processesWithMissingEmbedding) {
      const jobId = process.jobs.aiAnalysis.embedding;
      
      try {
        // Get embedding from Redis
        const jobData = await redisClient.hGet(`bull:ai-analysis:${jobId}`, 'returnvalue');
        if (!jobData) {
          logger.warn(`No job data found in Redis for process ${process._id}, job ${jobId}`);
          continue;
        }

        const result = JSON.parse(jobData);
        if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length !== 1536) {
          logger.warn(`Invalid embedding in job result for process ${process._id}`);
          continue;
        }

        // Update process with embedding
        await ProcessModel.updateOne(
          { _id: process._id },
          { $set: { embedding: result.embedding } }
        );
        
        logger.info(`Fixed embedding for process ${process._id} - ${process.title}`);
      } catch (error) {
        logger.error(`Error fixing embedding for process ${process._id}:`, error);
      }
    }

    await redisClient.disconnect();
    await mongoose.disconnect();
    
  } catch (error) {
    logger.error('Auto-fix embeddings error:', error);
  }
}

// Export for use in other modules
module.exports = autoFixMissingEmbeddings;

// Run if called directly
if (require.main === module) {
  autoFixMissingEmbeddings().then(() => {
    console.log('Auto-fix completed');
    process.exit(0);
  }).catch(error => {
    console.error('Auto-fix failed:', error);
    process.exit(1);
  });
}