#!/usr/bin/env node

/**
 * Test script for the midnight deep cleanup functionality
 * This allows testing the cleanup without waiting until midnight
 */

require('dotenv').config();
const connectDB = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const logger = require('./src/utils/logger');

// Import the cleanup function from scheduler
const schedulerPath = './src/workers/scheduler-process.js';
delete require.cache[require.resolve(schedulerPath)]; // Clear cache to get latest version

async function testMidnightCleanup() {
  try {
    console.log('\n🧪 Starting midnight cleanup test...\n');
    
    // Connect to databases
    console.log('📦 Connecting to MongoDB...');
    await connectDB();
    
    console.log('📦 Connecting to Redis...');
    await connectRedis();
    
    console.log('\n✅ Connections established\n');
    
    // Get current state of directories
    const fs = require('fs').promises;
    const path = require('path');
    
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const processedDir = path.join(process.cwd(), 'uploads', 'processed');
    
    // Count files before cleanup
    async function countFiles(dir) {
      let fileCount = 0;
      let totalSize = 0;
      
      try {
        const tenants = await fs.readdir(dir).catch(() => []);
        for (const tenant of tenants) {
          const tenantPath = path.join(dir, tenant);
          const processes = await fs.readdir(tenantPath).catch(() => []);
          
          for (const processDir of processes) {
            const processPath = path.join(tenantPath, processDir);
            const files = await fs.readdir(processPath).catch(() => []);
            
            for (const file of files) {
              const filePath = path.join(processPath, file);
              const stat = await fs.stat(filePath).catch(() => null);
              if (stat && stat.isFile()) {
                fileCount++;
                totalSize += stat.size;
              }
            }
          }
        }
      } catch (err) {
        // Ignore errors
      }
      
      return { fileCount, totalSize };
    }
    
    console.log('📊 Current state:');
    const tempBefore = await countFiles(tempDir);
    const processedBefore = await countFiles(processedDir);
    
    console.log(`  Temp directory: ${tempBefore.fileCount} files (${(tempBefore.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  Processed directory: ${processedBefore.fileCount} files (${(processedBefore.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Run the cleanup
    console.log('\n🌙 Running midnight deep cleanup...\n');
    
    // Dynamically require and execute the cleanup function
    const { deepCleanupAtMidnight } = require(schedulerPath);
    await deepCleanupAtMidnight();
    
    // Count files after cleanup
    console.log('\n📊 State after cleanup:');
    const tempAfter = await countFiles(tempDir);
    const processedAfter = await countFiles(processedDir);
    
    console.log(`  Temp directory: ${tempAfter.fileCount} files (${(tempAfter.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  Processed directory: ${processedAfter.fileCount} files (${(processedAfter.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Calculate results
    console.log('\n✨ Cleanup results:');
    console.log(`  Temp files deleted: ${tempBefore.fileCount - tempAfter.fileCount}`);
    console.log(`  Temp space freed: ${((tempBefore.totalSize - tempAfter.totalSize) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Processed files deleted: ${processedBefore.fileCount - processedAfter.fileCount}`);
    console.log(`  Processed space freed: ${((processedBefore.totalSize - processedAfter.totalSize) / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n✅ Test completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Disconnect
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run test
testMidnightCleanup();