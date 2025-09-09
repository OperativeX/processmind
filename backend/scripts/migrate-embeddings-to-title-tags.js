#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
const { Process } = require('../src/models');
const aiService = require('../src/services/aiService');
const logger = require('../src/utils/logger');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration
const BATCH_SIZE = 10; // Process 10 documents at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB connected for migration');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function migrateEmbeddings() {
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    // Find all processes with embeddings but without the new metadata
    const totalCount = await Process.countDocuments({
      $or: [
        { 'embeddingMetadata.method': { $exists: false } },
        { 'embeddingMetadata.method': 'transcript' }
      ],
      title: { $exists: true, $ne: '' },
      'tags.0': { $exists: true } // Has at least one tag
    });

    logger.info(`Found ${totalCount} processes to migrate`);

    if (totalCount === 0) {
      logger.info('No processes to migrate');
      return;
    }

    // Process in batches
    for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
      const processes = await Process.find({
        $or: [
          { 'embeddingMetadata.method': { $exists: false } },
          { 'embeddingMetadata.method': 'transcript' }
        ],
        title: { $exists: true, $ne: '' },
        'tags.0': { $exists: true }
      })
        .skip(skip)
        .limit(BATCH_SIZE)
        .select('_id title tags embedding embeddingMetadata');

      logger.info(`Processing batch ${Math.floor(skip / BATCH_SIZE) + 1} of ${Math.ceil(totalCount / BATCH_SIZE)}`);

      // Process each document in the batch
      for (const process of processes) {
        try {
          processedCount++;

          // Check if we really need to regenerate
          if (process.embeddingMetadata?.method === 'title-tags') {
            logger.info(`Process ${process._id} already migrated, skipping`);
            skippedCount++;
            continue;
          }

          logger.info(`Migrating process ${process._id}: "${process.title}"`);

          // Generate new embedding from title and tags
          const result = await aiService.generateEmbeddingFromTitleAndTags(
            process.title,
            process.tags
          );

          // Update the process with new embedding
          process.embedding = result.embedding;
          process.embeddingMetadata = {
            method: 'title-tags',
            generatedAt: new Date(),
            model: result.model || 'text-embedding-ada-002'
          };

          await process.save();

          successCount++;
          logger.info(`Successfully migrated process ${process._id}`);

        } catch (error) {
          errorCount++;
          logger.error(`Failed to migrate process ${process._id}:`, error.message);
        }

        // Progress update
        if (processedCount % 5 === 0) {
          const progress = Math.round((processedCount / totalCount) * 100);
          logger.info(`Progress: ${progress}% (${processedCount}/${totalCount})`);
        }
      }

      // Delay between batches to avoid rate limiting
      if (skip + BATCH_SIZE < totalCount) {
        logger.info(`Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Final report
    logger.info('\n=== Migration Complete ===');
    logger.info(`Total processed: ${processedCount}`);
    logger.info(`Successfully migrated: ${successCount}`);
    logger.info(`Skipped (already migrated): ${skippedCount}`);
    logger.info(`Errors: ${errorCount}`);
    logger.info(`Success rate: ${Math.round((successCount / (processedCount - skippedCount)) * 100)}%`);

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    logger.info('Starting embedding migration from transcript to title-tags method');
    
    await connectDB();
    await migrateEmbeddings();
    
    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This will regenerate embeddings for all processes using the title-tags method.');
console.log('This operation will make API calls to OpenAI and may incur costs.');
console.log('It\'s recommended to run this script during off-peak hours.\n');

rl.question('Do you want to continue? (yes/no): ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    main();
  } else {
    console.log('Migration cancelled');
    process.exit(0);
  }
});