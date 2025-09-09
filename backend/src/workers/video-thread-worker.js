/**
 * Video Thread Worker - Runs in worker thread for CPU-intensive video processing
 */

const { parentPort, workerData } = require('worker_threads');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Configure FFmpeg paths if needed
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

// Worker identification
const workerId = workerData.workerId || 0;
// Removed console.log for production

// Handle messages from main thread
parentPort.on('message', async (data) => {
  const { type, inputPath, outputPath, compressionOptions, jobId } = data;
  
  try {
    switch (type) {
      case 'compress':
        const result = await compressVideo(inputPath, outputPath, compressionOptions, jobId);
        parentPort.postMessage({ success: true, result });
        break;
        
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

/**
 * Compress video with optimized settings
 */
async function compressVideo(inputPath, outputPath, options = {}, jobId) {
  const startTime = Date.now();
  
  // Get input file info
  const inputStats = await fs.stat(inputPath);
  const inputSizeMB = inputStats.size / (1024 * 1024);
  
  // Check if compression should be skipped
  if (inputSizeMB < 50 && !options.forceCompression) {
    // Skipping compression for small file
    
    // Just copy the file
    await fs.copyFile(inputPath, outputPath);
    
    return {
      outputPath,
      originalSize: inputStats.size,
      compressedSize: inputStats.size,
      compressionRatio: 0,
      skippedCompression: true,
      processingTime: Date.now() - startTime,
      workerId
    };
  }
  
  return new Promise((resolve, reject) => {
    // Configure compression settings
    const codec = options.codec || (inputSizeMB > 500 ? 'libx265' : 'libx264');
    const crf = options.crf || (codec === 'libx265' ? 28 : 23);
    const preset = options.preset || 'fast';
    
    let ffmpegCommand = ffmpeg(inputPath)
      .videoCodec(codec)
      .outputOptions([
        `-crf ${crf}`,
        `-preset ${preset}`,
        '-movflags +faststart', // Enable streaming
        '-pix_fmt yuv420p', // Compatibility
        '-tag:v hvc1' // For HEVC compatibility
      ])
      .audioCodec('aac')
      .audioBitrate('128k');
    
    // Resolution settings
    if (options.maxWidth || options.maxHeight) {
      const maxWidth = options.maxWidth || 1920;
      const maxHeight = options.maxHeight || 1080;
      ffmpegCommand = ffmpegCommand.size(`${maxWidth}x${maxHeight}`);
    } else {
      // Default to 1080p max
      ffmpegCommand = ffmpegCommand.outputOptions([
        '-vf scale=\'min(1920,iw)\':\'min(1080,ih)\':force_original_aspect_ratio=decrease'
      ]);
    }
    
    // Multi-threading for better performance
    const threads = Math.min(4, require('os').cpus().length);
    ffmpegCommand = ffmpegCommand.outputOptions([`-threads ${threads}`]);
    
    let lastProgress = 0;
    
    ffmpegCommand
      .on('start', (commandLine) => {
        console.log(`Worker ${workerId} starting compression: ${commandLine}`);
      })
      .on('progress', (progress) => {
        const currentProgress = Math.round(progress.percent || 0);
        if (currentProgress - lastProgress >= 10) {
          console.log(`Worker ${workerId} compression progress: ${currentProgress}%`);
          lastProgress = currentProgress;
        }
      })
      .on('end', async () => {
        try {
          const outputStats = await fs.stat(outputPath);
          const compressionRatio = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2);
          
          resolve({
            outputPath,
            originalSize: inputStats.size,
            compressedSize: outputStats.size,
            compressionRatio: parseFloat(compressionRatio),
            codec,
            crf,
            preset,
            processingTime: Date.now() - startTime,
            workerId,
            skippedCompression: false
          });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error(`Worker ${workerId} compression error:`, error);
        reject(error);
      })
      .save(outputPath);
  });
}

// Handle thread termination
process.on('exit', () => {
  console.log(`Video thread worker ${workerId} exiting`);
});