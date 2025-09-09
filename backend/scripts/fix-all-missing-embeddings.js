const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');
const redis = require('redis');

async function fixAllMissingEmbeddings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('Connected to MongoDB');

    const redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('Connected to Redis');

    // Find all processes with embedding job but empty embedding
    const processesWithMissingEmbedding = await ProcessModel.find({
      'jobs.aiAnalysis.embedding': { $exists: true },
      $or: [
        { embedding: { $size: 0 } },
        { embedding: { $exists: false } }
      ]
    }).select('_id title jobs.aiAnalysis.embedding embedding');

    console.log(`\nFound ${processesWithMissingEmbedding.length} processes with missing embeddings\n`);

    for (const process of processesWithMissingEmbedding) {
      const jobId = process.jobs.aiAnalysis.embedding;
      console.log(`Processing: ${process._id}`);
      console.log(`Title: ${process.title}`);
      console.log(`Job ID: ${jobId}`);
      
      try {
        // Get embedding from Redis
        const jobData = await redisClient.hGet(`bull:ai-analysis:${jobId}`, 'returnvalue');
        if (!jobData) {
          console.log(`❌ No job data found in Redis for job ${jobId}\n`);
          continue;
        }

        const result = JSON.parse(jobData);
        if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length !== 1536) {
          console.log(`❌ Invalid embedding in job result\n`);
          continue;
        }

        // Update process with embedding
        process.embedding = result.embedding;
        await process.save();
        
        console.log(`✅ Embedding saved successfully! (${result.embedding.length} dimensions)\n`);
      } catch (error) {
        console.error(`❌ Error processing ${process._id}:`, error.message, '\n');
      }
    }

    // Verify all embeddings
    console.log('\n=== Verification ===');
    const allProcesses = await ProcessModel.find({
      'jobs.aiAnalysis.embedding': { $exists: true }
    }).select('_id title embedding');

    let withEmbedding = 0;
    let withoutEmbedding = 0;

    allProcesses.forEach(p => {
      if (p.embedding && p.embedding.length === 1536) {
        withEmbedding++;
      } else {
        withoutEmbedding++;
        console.log(`Missing: ${p._id} - ${p.title}`);
      }
    });

    console.log(`\nTotal: ${allProcesses.length}`);
    console.log(`With embedding: ${withEmbedding}`);
    console.log(`Without embedding: ${withoutEmbedding}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

fixAllMissingEmbeddings();