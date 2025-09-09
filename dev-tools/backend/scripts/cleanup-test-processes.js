#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Load models
require('./src/models');

async function cleanup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('✅ Connected to MongoDB');

    const Process = mongoose.model('Process');
    
    // Count existing processes
    const count = await Process.countDocuments();
    console.log(`\n📊 Found ${count} processes in database`);
    
    if (count > 0) {
      // Delete all processes
      const result = await Process.deleteMany({});
      console.log(`\n🗑️  Deleted ${result.deletedCount} processes`);
      
      // Also clean up any orphaned files
      const fs = require('fs').promises;
      const path = require('path');
      const processedDir = path.join(__dirname, 'uploads', 'processed');
      
      try {
        const dirs = await fs.readdir(processedDir);
        console.log(`\n📁 Found ${dirs.length} directories in uploads/processed`);
        
        for (const dir of dirs) {
          const dirPath = path.join(processedDir, dir);
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log(`   ✅ Deleted ${dir}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`\n⚠️  Error cleaning up files: ${error.message}`);
        }
      }
    } else {
      console.log('\n✨ Database is already clean');
    }
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanup();