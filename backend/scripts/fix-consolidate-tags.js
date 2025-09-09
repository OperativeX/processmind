const mongoose = require('mongoose');
const { Process } = require('../src/models');
const logger = require('../src/utils/logger');
require('dotenv').config();

// Helper function to reconstruct string from character object
function reconstructString(obj) {
  if (typeof obj === 'string') return obj;
  
  // If it's an object with numbered keys, reconstruct the string
  if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj)
      .filter(key => !isNaN(parseInt(key)))
      .map(key => parseInt(key))
      .sort((a, b) => a - b);
    
    if (keys.length > 0) {
      const chars = keys.map(key => obj[key.toString()]);
      return chars.join('');
    }
  }
  
  return '';
}

async function fixAndConsolidateTags() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for tag consolidation fix');

    // Get all processes
    const processes = await Process.find({
      $or: [
        { tags: { $exists: true } },
        { tagWeights: { $exists: true } }
      ]
    });

    logger.info(`Found ${processes.length} processes to fix`);

    let fixed = 0;
    let failed = 0;

    for (const process of processes) {
      try {
        let newTags = [];
        const seenTags = new Set();

        // Process tagWeights first (they have priority)
        if (process.tagWeights && process.tagWeights.length > 0) {
          for (const tw of process.tagWeights) {
            let tagName;
            
            // Check if name is a corrupted object
            if (typeof tw.name === 'object' && tw.name !== null) {
              tagName = reconstructString(tw.name);
            } else if (typeof tw.name === 'string') {
              tagName = tw.name;
            } else {
              continue; // Skip invalid entries
            }

            if (tagName && !seenTags.has(tagName.toLowerCase())) {
              seenTags.add(tagName.toLowerCase());
              newTags.push({
                name: tagName.toLowerCase().trim(),
                weight: tw.weight || 0.5
              });
            }
          }
        }
        
        // Process old tags array
        if (process.tags && process.tags.length > 0) {
          for (const tag of process.tags) {
            let tagName;
            
            // Check if tag is a corrupted object
            if (typeof tag === 'object' && tag !== null && !tag.name) {
              tagName = reconstructString(tag);
            } else if (typeof tag === 'string') {
              tagName = tag;
            } else if (typeof tag === 'object' && tag.name) {
              // Already in new format
              tagName = tag.name;
            } else {
              continue; // Skip invalid entries
            }

            if (tagName && !seenTags.has(tagName.toLowerCase())) {
              seenTags.add(tagName.toLowerCase());
              newTags.push({
                name: tagName.toLowerCase().trim(),
                weight: 0.5
              });
            }
          }
        }

        // Update using native MongoDB to bypass Mongoose validation temporarily
        await Process.collection.updateOne(
          { _id: process._id },
          {
            $set: { tags: newTags },
            $unset: { tagWeights: 1 }
          }
        );

        fixed++;
        logger.info(`Fixed process ${process._id} with ${newTags.length} tags`);

      } catch (error) {
        failed++;
        logger.error(`Failed to fix process ${process._id}:`, error.message);
      }
    }

    logger.info(`Migration complete: ${fixed} fixed, ${failed} failed`);

    // Verify migration
    const remainingOldFormat = await Process.countDocuments({ 
      tagWeights: { $exists: true }
    });
    
    logger.info('Verification:', {
      remainingOldFormat
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

console.log('\n⚠️  WARNING: This script will fix and consolidate corrupted tags into the new format.');
console.log('This will fix the character-by-character tag corruption issue.');
console.log('\nThis will affect all processes in the database.');

rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    fixAndConsolidateTags();
  } else {
    console.log('Migration cancelled.');
    rl.close();
    process.exit(0);
  }
});