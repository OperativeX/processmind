#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const s3Service = require('./src/services/s3Service');
const { Process } = require('./src/models');
const logger = require('./src/utils/logger');

async function testS3Streaming() {
  console.log('🎬 Testing S3-Only Video Streaming');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test S3 connection
    const canConnect = await s3Service.testConnection();
    if (!canConnect) {
      throw new Error('S3 connection failed');
    }
    console.log('✅ S3 connection validated');

    // Find some processes to test with
    const testProcesses = await Process.find({
      'files.processed.path': { $exists: true }
    }).limit(3).select('_id files.processed sharing').lean();

    console.log(`\n🔍 Found ${testProcesses.length} processes to test`);

    for (const process of testProcesses) {
      console.log(`\n📹 Testing process: ${process._id}`);
      
      const videoPath = process.files.processed?.path;
      const storageType = process.files.processed?.storageType;

      console.log(`   Storage type: ${storageType || 'undefined'}`);
      console.log(`   Video path: ${videoPath}`);

      if (!videoPath) {
        console.log('   ⚠️  No video path found');
        continue;
      }

      if (storageType === 's3') {
        // Test S3 streaming
        console.log('   🌐 Testing S3 streaming...');
        
        try {
          const fileExists = await s3Service.fileExists(videoPath);
          console.log(`   File exists in S3: ${fileExists ? '✅' : '❌'}`);

          if (fileExists) {
            const presignedUrl = await s3Service.generateVideoStreamUrl(videoPath, 300); // 5 min
            console.log(`   Pre-signed URL: ${presignedUrl.substring(0, 80)}...`);
            console.log('   ✅ S3 streaming ready');
          }
        } catch (error) {
          console.log(`   ❌ S3 streaming test failed: ${error.message}`);
        }

      } else {
        // Local file - should be migrated
        console.log('   🏠 Local file detected - needs migration');
        
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          console.log(`   Local file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          console.log('   📋 Ready for migration script');
        } else {
          console.log('   ❌ Local file not found');
        }
      }

      // Test sharing URL generation if shared
      if (process.sharing?.shareId) {
        console.log(`   🔗 Share ID available: ${process.sharing.shareId}`);
        console.log(`   📺 Public URL: /api/v1/public/processes/${process.sharing.shareId}/video`);
      }
    }

    console.log('\n📈 S3 Bucket Statistics');
    try {
      const bucketStats = await s3Service.getBucketStats();
      console.log(`   Total files: ${bucketStats.totalFiles}`);
      console.log(`   Total size: ${bucketStats.totalSizeMB.toFixed(2)} MB`);
      console.log(`   Tenant count: ${bucketStats.tenantCount}`);
    } catch (error) {
      console.log(`   ❌ Could not get bucket stats: ${error.message}`);
    }

    console.log('\n✨ S3 Streaming Test Completed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
  }
}

// Script execution
if (require.main === module) {
  testS3Streaming()
    .then(() => {
      console.log('\n🎉 All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testS3Streaming };