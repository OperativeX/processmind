#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import services
const s3Service = require('../src/services/s3Service');
const storageTrackingService = require('../src/services/storageTrackingService');
const { Process } = require('../src/models');
const logger = require('../src/utils/logger');

class VideoS3Migration {
  constructor() {
    this.stats = {
      totalProcesses: 0,
      localVideos: 0,
      alreadyMigrated: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      errors: []
    };
    this.dryRun = process.argv.includes('--dry-run');
    this.deleteLocal = process.argv.includes('--delete-local');
  }

  async connectDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }

  async validateS3Connection() {
    try {
      const canConnect = await s3Service.testConnection();
      if (!canConnect) {
        throw new Error('S3 connection test failed');
      }
      console.log('✅ S3 connection validated');
    } catch (error) {
      console.error('❌ S3 connection validation failed:', error.message);
      process.exit(1);
    }
  }

  async findLocalVideoProcesses() {
    console.log('\n🔍 Searching for processes with local videos...');

    const processes = await Process.find({
      'files.processed.path': { $exists: true },
      $or: [
        { 'files.processed.storageType': { $ne: 's3' } },
        { 'files.processed.storageType': { $exists: false } }
      ],
      isDeleted: false
    }).select('_id tenantId userId files.processed title status').lean();

    this.stats.totalProcesses = processes.length;
    
    // Filter out processes that already have S3 storage
    const localProcesses = processes.filter(process => {
      if (process.files?.processed?.storageType === 's3') {
        this.stats.alreadyMigrated++;
        return false;
      }
      return true;
    });

    this.stats.localVideos = localProcesses.length;

    console.log(`📊 Migration Overview:`);
    console.log(`   Total processes: ${this.stats.totalProcesses}`);
    console.log(`   Already in S3: ${this.stats.alreadyMigrated}`);
    console.log(`   Need migration: ${this.stats.localVideos}`);

    return localProcesses;
  }

  async migrateProcess(process) {
    const processId = process._id.toString();
    const localVideoPath = process.files.processed.path;

    try {
      console.log(`\n📹 Migrating process: ${process.title || processId}`);
      console.log(`   Local path: ${localVideoPath}`);

      // Check if local file exists
      if (!fs.existsSync(localVideoPath)) {
        throw new Error(`Local video file not found: ${localVideoPath}`);
      }

      // Get file stats
      const fileStats = fs.statSync(localVideoPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);

      console.log(`   File size: ${fileSizeMB.toFixed(2)} MB`);

      if (this.dryRun) {
        console.log('   🔄 DRY RUN - Would upload to S3');
        this.stats.successfulMigrations++;
        return;
      }

      // Generate S3 key for the video
      const s3Key = s3Service.generateS3Key(
        process.tenantId.toString(), 
        processId, 
        'video.mp4', 
        'processed'
      );

      console.log(`   S3 key: ${s3Key}`);

      // Upload to S3
      console.log('   ⬆️  Uploading to S3...');
      const uploadResult = await s3Service.uploadFile(localVideoPath, s3Key, {
        originalName: 'video.mp4',
        userId: process.userId?.toString(),
        tenantId: process.tenantId.toString(),
        processId: processId,
        fileType: 'processed_video',
        uploadedAt: new Date().toISOString()
      });

      console.log(`   ✅ Uploaded successfully: ${uploadResult.location}`);

      // Update database record
      const updateResult = await Process.updateOne(
        { _id: process._id },
        {
          $set: {
            'files.processed.path': s3Key,
            'files.processed.s3Location': uploadResult.location,
            'files.processed.storageType': 's3',
            'files.processed.size': fileStats.size,
            'files.processed.uploadedAt': new Date()
          }
        }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Failed to update database record');
      }

      console.log('   📝 Database updated');

      // Track storage usage
      if (process.userId && process.tenantId) {
        await storageTrackingService.trackFileUpload(
          process.userId.toString(), 
          process.tenantId.toString(), 
          fileSizeMB, 
          'video'
        );
        console.log('   📊 Storage usage tracked');
      }

      // Delete local file if requested
      if (this.deleteLocal) {
        fs.unlinkSync(localVideoPath);
        console.log('   🗑️  Local file deleted');
      } else {
        console.log('   💾 Local file preserved');
      }

      this.stats.successfulMigrations++;
      console.log(`   🎉 Migration completed successfully`);

    } catch (error) {
      console.error(`   ❌ Migration failed: ${error.message}`);
      this.stats.failedMigrations++;
      this.stats.errors.push({
        processId,
        error: error.message,
        localPath: localVideoPath
      });

      // Log detailed error
      logger.error('Video migration failed', {
        processId,
        localPath: localVideoPath,
        error: error.message,
        stack: error.stack
      });
    }
  }

  async runMigration() {
    console.log('🚀 Starting Video S3 Migration');
    console.log(`🔧 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    if (!this.dryRun && this.deleteLocal) {
      console.log('🗑️  Local files will be DELETED after successful migration');
    }

    // Validate connections
    await this.connectDatabase();
    await this.validateS3Connection();

    // Find processes to migrate
    const processesToMigrate = await this.findLocalVideoProcesses();

    if (processesToMigrate.length === 0) {
      console.log('\n✨ All videos are already migrated to S3!');
      return;
    }

    // Confirm migration
    if (!this.dryRun) {
      console.log('\n⚠️  This will migrate all local videos to S3.');
      if (this.deleteLocal) {
        console.log('⚠️  Local files will be DELETED after successful migration.');
      }
      console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Migrate each process
    for (let i = 0; i < processesToMigrate.length; i++) {
      const process = processesToMigrate[i];
      console.log(`\n[${i + 1}/${processesToMigrate.length}]`);
      await this.migrateProcess(process);
    }

    // Print final statistics
    this.printFinalStats();
  }

  printFinalStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processes examined: ${this.stats.totalProcesses}`);
    console.log(`Already in S3: ${this.stats.alreadyMigrated}`);
    console.log(`Videos to migrate: ${this.stats.localVideos}`);
    console.log(`Successful migrations: ${this.stats.successfulMigrations}`);
    console.log(`Failed migrations: ${this.stats.failedMigrations}`);

    if (this.stats.errors.length > 0) {
      console.log('\n❌ FAILED MIGRATIONS:');
      this.stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. Process ${error.processId}`);
        console.log(`   Path: ${error.localPath}`);
        console.log(`   Error: ${error.error}`);
      });
    }

    const successRate = this.stats.localVideos > 0 
      ? ((this.stats.successfulMigrations / this.stats.localVideos) * 100).toFixed(1)
      : 100;

    console.log(`\n🎯 Success Rate: ${successRate}%`);

    if (this.stats.failedMigrations === 0) {
      console.log('\n🎉 All migrations completed successfully!');
    } else {
      console.log(`\n⚠️  ${this.stats.failedMigrations} migrations failed. Check logs for details.`);
    }

    console.log('='.repeat(60));
  }

  async cleanup() {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

// Script execution
if (require.main === module) {
  const migration = new VideoS3Migration();

  migration.runMigration()
    .then(() => {
      return migration.cleanup();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = VideoS3Migration;