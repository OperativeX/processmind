const mongoose = require('mongoose');
const { Process } = require('../src/models');
const logger = require('../src/utils/logger');
require('dotenv').config();

async function consolidateTags() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for tag consolidation');

    // Get statistics first
    const totalProcesses = await Process.countDocuments();
    const processesWithOldTags = await Process.countDocuments({ 
      tags: { $exists: true, $not: { $size: 0 } },
      tagWeights: { $exists: false }
    });
    const processesWithTagWeights = await Process.countDocuments({ 
      tagWeights: { $exists: true, $not: { $size: 0 } }
    });
    const processesWithBoth = await Process.countDocuments({ 
      tags: { $exists: true, $not: { $size: 0 } },
      tagWeights: { $exists: true, $not: { $size: 0 } }
    });

    logger.info('Migration Statistics:', {
      totalProcesses,
      processesWithOldTags,
      processesWithTagWeights,
      processesWithBoth
    });

    // Backup current state (optional - for safety)
    const backupData = [];
    const allProcesses = await Process.find({
      $or: [
        { tags: { $exists: true, $not: { $size: 0 } } },
        { tagWeights: { $exists: true, $not: { $size: 0 } } }
      ]
    }).select('_id tags tagWeights');

    for (const process of allProcesses) {
      backupData.push({
        _id: process._id,
        oldTags: process.tags,
        oldTagWeights: process.tagWeights
      });
    }

    // Save backup to file
    const fs = require('fs');
    const backupPath = `./tag-backup-${new Date().toISOString()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    logger.info(`Backup saved to ${backupPath}`);

    // Perform migration
    let migrated = 0;
    let failed = 0;

    for (const process of allProcesses) {
      try {
        let newTags = [];

        // Priority 1: Use tagWeights if available
        if (process.tagWeights && process.tagWeights.length > 0) {
          newTags = process.tagWeights.map(tw => ({
            name: tw.name,
            weight: tw.weight || 0.5
          }));
        }
        // Priority 2: Convert old tags to new format
        else if (process.tags && process.tags.length > 0) {
          newTags = process.tags.map(tag => ({
            name: tag,
            weight: 0.5 // Default weight
          }));
        }

        // If both exist, merge them (avoiding duplicates)
        if (process.tags && process.tagWeights && process.tagWeights.length > 0) {
          const existingTagNames = new Set(process.tagWeights.map(tw => tw.name.toLowerCase()));
          
          // Add any tags that aren't in tagWeights
          for (const tag of process.tags) {
            if (!existingTagNames.has(tag.toLowerCase())) {
              newTags.push({
                name: tag,
                weight: 0.5
              });
            }
          }
        }

        // Update the process
        await Process.updateOne(
          { _id: process._id },
          {
            $set: { tags: newTags },
            $unset: { tagWeights: 1 } // Remove old field
          }
        );

        migrated++;
        logger.info(`Migrated process ${process._id} with ${newTags.length} tags`);

      } catch (error) {
        failed++;
        logger.error(`Failed to migrate process ${process._id}:`, error);
      }
    }

    logger.info(`Migration complete: ${migrated} successful, ${failed} failed`);

    // Verify migration
    const remainingOldFormat = await Process.countDocuments({ 
      tagWeights: { $exists: true }
    });
    const newFormatCount = await Process.countDocuments({ 
      'tags.0.name': { $exists: true }
    });

    logger.info('Verification:', {
      remainingOldFormat,
      newFormatCount
    });

    // Disconnect
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Add command line confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This script will consolidate tags and tagWeights into a single tags array.');
console.log('A backup will be created before any changes are made.');
console.log('\nThis will affect all processes in the database.');

rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    consolidateTags();
  } else {
    console.log('Migration cancelled.');
    rl.close();
    process.exit(0);
  }
});