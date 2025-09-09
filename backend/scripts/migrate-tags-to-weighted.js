const mongoose = require('mongoose');
const { Process } = require('../src/models');
const logger = require('../src/utils/logger');
require('dotenv').config();

async function migrateTags() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for migration');

    // Find all processes with tags but no tagWeights
    const processesToMigrate = await Process.find({
      tags: { $exists: true, $not: { $size: 0 } },
      tagWeights: { $exists: false }
    });

    logger.info(`Found ${processesToMigrate.length} processes to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const process of processesToMigrate) {
      try {
        // Convert tags to tagWeights with default weight
        const tagWeights = process.tags.map(tag => ({
          name: tag,
          weight: 0.5 // Default weight for existing tags
        }));

        // Update the process
        process.tagWeights = tagWeights;
        process.embedding = []; // Initialize empty embedding array
        await process.save();

        migrated++;
        logger.info(`Migrated process ${process._id} with ${tagWeights.length} tags`);
      } catch (error) {
        failed++;
        logger.error(`Failed to migrate process ${process._id}:`, error);
      }
    }

    logger.info(`Migration complete: ${migrated} successful, ${failed} failed`);

    // Disconnect
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateTags();