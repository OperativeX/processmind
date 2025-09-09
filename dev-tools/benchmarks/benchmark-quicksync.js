const ffmpeg = require('./backend/node_modules/fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Benchmark configuration
const INPUT_FILE = './test.MP4';
const OUTPUT_DIR = '/tmp/benchmark-results';
const SOFTWARE_OUTPUT = path.join(OUTPUT_DIR, 'normal-preset.mp4');
const OPTIMIZED_OUTPUT = path.join(OUTPUT_DIR, 'ultrafast-preset.mp4');

class FFmpegBenchmark {
  async setup() {
    console.log('🚀 Setting up benchmark environment...');
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Check if input file exists
    try {
      await fs.access(INPUT_FILE);
      console.log('✅ Input file found:', INPUT_FILE);
    } catch (error) {
      throw new Error(`❌ Input file not found: ${INPUT_FILE}`);
    }
    
    // Get input file info
    const inputStats = await fs.stat(INPUT_FILE);
    console.log(`📊 Input file size: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
  }

  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          resolve({
            duration: parseFloat(metadata.format.duration),
            size: parseInt(metadata.format.size),
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: eval(videoStream.r_frame_rate)
            } : null
          });
        }
      });
    });
  }

  async benchmarkSoftwareEncoding() {
    console.log('\n🔧 Testing Current Settings (libx264 fast)...');
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg(INPUT_FILE);
      
      command
        .videoCodec('libx264')
        .addOption('-crf', 23)
        .addOption('-preset', 'fast')
        .addOption('-pix_fmt', 'yuv420p')
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4');

      // Progress tracking
      command.on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r📈 Progress: ${Math.round(progress.percent)}%`);
        }
      });

      command.on('error', (error) => {
        console.log('\n❌ Software encoding failed:', error.message);
        reject(error);
      });

      command.on('end', async () => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        try {
          const outputStats = await fs.stat(SOFTWARE_OUTPUT);
          console.log(`\n✅ Software encoding completed in ${duration.toFixed(2)}s`);
          
          resolve({
            method: 'Current (libx264 fast)',
            duration: duration,
            outputSize: outputStats.size,
            outputPath: SOFTWARE_OUTPUT
          });
        } catch (error) {
          reject(error);
        }
      });

      command.save(SOFTWARE_OUTPUT);
    });
  }

  async benchmarkFastPresetEncoding() {
    console.log('\n⚡ Testing Optimized Encoding (ultrafast preset)...');
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg(INPUT_FILE);
      
      command
        .videoCodec('libx264')
        .addOption('-crf', 23)
        .addOption('-preset', 'ultrafast')  // Fastest CPU preset
        .addOption('-pix_fmt', 'yuv420p')
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4');

      // Progress tracking
      command.on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r📈 Progress: ${Math.round(progress.percent)}%`);
        }
      });

      command.on('error', (error) => {
        console.log('\n❌ Fast preset encoding failed:', error.message);
        reject(error);
      });

      command.on('end', async () => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        try {
          const outputStats = await fs.stat(OPTIMIZED_OUTPUT);
          console.log(`\n✅ Ultrafast encoding completed in ${duration.toFixed(2)}s`);
          
          resolve({
            method: 'Optimized (libx264 ultrafast)',
            duration: duration,
            outputSize: outputStats.size,
            outputPath: OPTIMIZED_OUTPUT
          });
        } catch (error) {
          reject(error);
        }
      });

      command.save(OPTIMIZED_OUTPUT);
    });
  }

  async compareResults(softwareResult, hardwareResult, inputMetadata) {
    console.log('\n📊 BENCHMARK RESULTS');
    console.log('='.repeat(50));
    
    const inputSizeMB = inputMetadata.size / 1024 / 1024;
    const softwareSizeMB = softwareResult.outputSize / 1024 / 1024;
    const hardwareSizeMB = hardwareResult.outputSize / 1024 / 1024;
    
    console.log(`📹 Input: ${inputSizeMB.toFixed(2)} MB, ${inputMetadata.duration.toFixed(1)}s`);
    console.log(`   Resolution: ${inputMetadata.video.width}x${inputMetadata.video.height}`);
    console.log(`   Codec: ${inputMetadata.video.codec}`);
    
    console.log('\n🔧 Current Settings (libx264 fast):');
    console.log(`   Time: ${softwareResult.duration.toFixed(2)}s`);
    console.log(`   Size: ${softwareSizeMB.toFixed(2)} MB`);
    console.log(`   Speed: ${(inputMetadata.duration / softwareResult.duration).toFixed(1)}x realtime`);
    
    console.log('\n⚡ Optimized Settings (libx264 ultrafast):');
    console.log(`   Time: ${hardwareResult.duration.toFixed(2)}s`);
    console.log(`   Size: ${hardwareSizeMB.toFixed(2)} MB`);
    console.log(`   Speed: ${(inputMetadata.duration / hardwareResult.duration).toFixed(1)}x realtime`);
    
    const speedImprovement = ((softwareResult.duration - hardwareResult.duration) / softwareResult.duration) * 100;
    const sizeChange = ((hardwareResult.outputSize - softwareResult.outputSize) / softwareResult.outputSize) * 100;
    
    console.log('\n📈 PERFORMANCE COMPARISON:');
    console.log(`   Speed improvement: ${speedImprovement.toFixed(1)}% faster`);
    console.log(`   Size difference: ${sizeChange > 0 ? '+' : ''}${sizeChange.toFixed(1)}%`);
    console.log(`   Speedup factor: ${(softwareResult.duration / hardwareResult.duration).toFixed(1)}x`);
    
    console.log('\n💡 RECOMMENDATION:');
    if (speedImprovement > 30) {
      console.log('   ✅ Ultrafast preset shows significant speed improvement!');
      console.log('   🚀 Consider switching to ultrafast for production');
    } else if (speedImprovement > 15) {
      console.log('   ✅ Ultrafast preset shows moderate improvement');
      console.log('   💭 Consider switch based on quality/size trade-off');
    } else {
      console.log('   ⚠️  Limited performance improvement with ultrafast');
      console.log('   💭 Current "fast" preset is good balance');
    }
    
    if (Math.abs(sizeChange) < 10) {
      console.log('   📦 File sizes are comparable');
    } else if (sizeChange > 0) {
      console.log(`   📦 Ultrafast files are ${sizeChange.toFixed(1)}% larger (expected trade-off)`);
    } else {
      console.log(`   📦 Ultrafast files are ${Math.abs(sizeChange).toFixed(1)}% smaller`);
    }
    
    console.log('\n🔍 NOTE: Quick Sync hardware encoding not available on this system.');
    console.log('   For Windows/proper Intel driver setup, expect 3-5x additional speedup.');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    try {
      await fs.unlink(SOFTWARE_OUTPUT);
      await fs.unlink(OPTIMIZED_OUTPUT);
      await fs.rmdir(OUTPUT_DIR);
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup failed:', error.message);
      console.log(`   Files left in: ${OUTPUT_DIR}`);
    }
  }

  async run() {
    try {
      await this.setup();
      
      // Get input metadata
      const inputMetadata = await this.getVideoMetadata(INPUT_FILE);
      console.log(`📹 Video duration: ${inputMetadata.duration.toFixed(1)}s`);
      console.log(`📐 Resolution: ${inputMetadata.video.width}x${inputMetadata.video.height}`);
      
      // Run both encoding tests
      const softwareResult = await this.benchmarkSoftwareEncoding();
      const hardwareResult = await this.benchmarkFastPresetEncoding();
      
      // Compare and display results
      await this.compareResults(softwareResult, hardwareResult, inputMetadata);
      
      // Optional: Keep files for manual inspection
      console.log('\n📁 Output files (for manual inspection):');
      console.log(`   Current: ${SOFTWARE_OUTPUT}`);
      console.log(`   Optimized: ${OPTIMIZED_OUTPUT}`);
      console.log('\n💡 Run with --cleanup flag to auto-delete output files');
      
      if (process.argv.includes('--cleanup')) {
        await this.cleanup();
      }
      
    } catch (error) {
      console.error('\n❌ Benchmark failed:', error.message);
      
      console.log('\n💡 Note: Hardware encoding setup may require additional configuration.');
      
      process.exit(1);
    }
  }
}

// Run benchmark
const benchmark = new FFmpegBenchmark();
benchmark.run();