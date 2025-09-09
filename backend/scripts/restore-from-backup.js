const mongoose = require('mongoose');
const { Process } = require('../src/models');
const logger = require('../src/utils/logger');
const fs = require('fs');
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

async function restoreFromBackup() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for backup restoration');

    // Read backup file
    const backupPath = './tag-backup-2025-08-31T10:33:14.526Z.json';
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    logger.info(`Found ${backupData.length} processes in backup`);

    let restored = 0;
    let failed = 0;

    for (const backup of backupData) {
      try {
        let newTags = [];
        const seenTags = new Set();

        // Process oldTagWeights first (if they exist)
        if (backup.oldTagWeights && backup.oldTagWeights.length > 0) {
          for (const tw of backup.oldTagWeights) {
            let tagName;
            
            // Check if name is a corrupted object
            if (typeof tw.name === 'object' && tw.name !== null) {
              tagName = reconstructString(tw.name);
            } else if (typeof tw.name === 'string') {
              tagName = tw.name;
            } else {
              continue;
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
        
        // Process oldTags
        if (backup.oldTags && backup.oldTags.length > 0) {
          for (const tag of backup.oldTags) {
            let tagName;
            
            // This is definitely a corrupted object
            tagName = reconstructString(tag);

            if (tagName && !seenTags.has(tagName.toLowerCase())) {
              seenTags.add(tagName.toLowerCase());
              newTags.push({
                name: tagName.toLowerCase().trim(),
                weight: tag.weight || 0.5
              });
            }
          }
        }

        if (newTags.length > 0) {
          // Update using native MongoDB
          await Process.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(backup._id) },
            {
              $set: { tags: newTags },
              $unset: { tagWeights: 1 }
            }
          );

          restored++;
          logger.info(`Restored process ${backup._id} with ${newTags.length} tags:`, 
            newTags.map(t => t.name).join(', '));
        }

      } catch (error) {
        failed++;
        logger.error(`Failed to restore process ${backup._id}:`, error.message);
      }
    }

    logger.info(`Restoration complete: ${restored} restored, ${failed} failed`);

    // Disconnect
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('Restoration failed:', error);
    process.exit(1);
  }
}

// Add command line confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This script will restore tags from backup.');
console.log('This will reconstruct the corrupted character-by-character tags.');

rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    rl.close();
    restoreFromBackup();
  } else {
    console.log('Restoration cancelled.');
    rl.close();
    process.exit(0);
  }
});