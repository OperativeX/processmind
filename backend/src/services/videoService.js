const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Set FFmpeg paths if specified in environment
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

class VideoService {
  /**
   * Check if video is already optimized and doesn't need compression
   * @param {Object} metadata - Video metadata from getVideoMetadata
   * @returns {boolean} True if video is already optimal
   */
  isVideoOptimized(metadata) {
    if (!metadata || !metadata.video) {
      return false;
    }

    const { video, format } = metadata;
    
    // Check codec - H.264 or H.265/HEVC
    const isOptimalCodec = video.codec && (
      video.codec.toLowerCase() === 'h264' || 
      video.codec.toLowerCase() === 'hevc' ||
      video.codec.toLowerCase() === 'h265'
    );
    
    // Check resolution - Full HD or smaller
    const isOptimalResolution = video.width <= 1920 && video.height <= 1080;
    
    // Check bitrate - under 5 Mbps (5,000,000 bps)
    const isOptimalBitrate = !video.bitRate || video.bitRate < 5000000;
    
    // Check format - MP4 container
    const isOptimalFormat = format && format.includes('mp4');
    
    const isOptimized = isOptimalCodec && isOptimalResolution && isOptimalBitrate && isOptimalFormat;
    
    logger.info('Video optimization check', {
      isOptimized,
      codec: video.codec,
      isOptimalCodec,
      resolution: `${video.width}x${video.height}`,
      isOptimalResolution,
      bitRate: video.bitRate,
      isOptimalBitrate,
      format,
      isOptimalFormat
    });
    
    return isOptimized;
  }

  /**
   * Get video metadata using ffprobe
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} Video metadata
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          logger.error('Error getting video metadata:', error);
          reject(error);
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          resolve({
            duration: parseFloat(metadata.format.duration),
            size: parseInt(metadata.format.size),
            format: metadata.format.format_name,
            bitRate: parseInt(metadata.format.bit_rate),
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: eval(videoStream.r_frame_rate), // Convert fraction to decimal
              bitRate: parseInt(videoStream.bit_rate) || 0
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: parseInt(audioStream.sample_rate),
              channels: audioStream.channels,
              bitRate: parseInt(audioStream.bit_rate) || 0
            } : null
          });
        }
      });
    });
  }

  /**
   * Compress video to H.265 with specified settings
   * @param {string} inputPath - Input video file path
   * @param {string} outputPath - Output video file path
   * @param {Object} options - Compression options
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Compression result
   */
  async compressVideo(inputPath, outputPath, options = {}, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Get input metadata
      const inputMetadata = await this.getVideoMetadata(inputPath);
      
      // Check if video is already optimized
      const isOptimized = this.isVideoOptimized(inputMetadata);
      
      if (isOptimized && !options.forceCompression) {
        logger.info('Video is already optimized, skipping compression', {
          input: inputPath,
          output: outputPath,
          inputSize: inputMetadata.size,
          inputSizeMB: (inputMetadata.size / (1024 * 1024)).toFixed(2) + ' MB',
          inputDuration: inputMetadata.duration,
          inputDurationMinutes: (inputMetadata.duration / 60).toFixed(2) + ' minutes',
          inputResolution: inputMetadata.video ? `${inputMetadata.video.width}x${inputMetadata.video.height}` : 'unknown',
          codec: inputMetadata.video?.codec,
          bitRate: inputMetadata.video?.bitRate,
          bitRateMbps: inputMetadata.video?.bitRate ? (inputMetadata.video.bitRate / 1000000).toFixed(2) + ' Mbps' : 'unknown',
          format: inputMetadata.format,
          reason: 'Already meets optimization criteria (H.264/H.265, ≤1080p, <5Mbps, MP4)'
        });
        
        // Copy file instead of compressing
        try {
          // Report quick progress for UI
          if (progressCallback) {
            progressCallback(10);
          }
          
          await fs.copyFile(inputPath, outputPath);
          
          logger.info('Video file copied successfully (optimization skipped)', {
            from: inputPath,
            to: outputPath
          });
          
          if (progressCallback) {
            progressCallback(90);
          }
          
          // Get output file stats
          const outputStats = await fs.stat(outputPath);
          const processingTime = (Date.now() - startTime) / 1000;
          
          logger.info('Optimized video copy completed', {
            outputSize: outputStats.size,
            outputSizeMB: (outputStats.size / (1024 * 1024)).toFixed(2) + ' MB',
            processingTime: processingTime + 's',
            operation: 'copy'
          });
          
          if (progressCallback) {
            progressCallback(100);
          }
          
          return {
            inputPath,
            outputPath,
            processingTime,
            originalSize: inputMetadata.size,
            compressedSize: outputStats.size,
            compressionRatio: 0, // No compression
            duration: inputMetadata.duration,
            format: 'mp4',
            codec: inputMetadata.video?.codec || 'h264',
            skippedCompression: true,
            reason: 'Video already optimized'
          };
          
        } catch (copyError) {
          logger.error('Failed to copy optimized video, falling back to compression', {
            error: copyError.message,
            input: inputPath,
            output: outputPath
          });
          // Continue with normal compression
        }
      }
      
      logger.info('Starting video compression', {
        input: inputPath,
        output: outputPath,
        inputSize: inputMetadata.size,
        inputDuration: inputMetadata.duration,
        inputResolution: inputMetadata.video ? `${inputMetadata.video.width}x${inputMetadata.video.height}` : 'unknown',
        isPortrait: inputMetadata.video ? inputMetadata.video.height > inputMetadata.video.width : false,
        willScale: inputMetadata.video ? (inputMetadata.video.width > 1920 || inputMetadata.video.height > 1920 || (inputMetadata.video.height > inputMetadata.video.width && inputMetadata.video.width > 1080)) : false,
        codec: options.codec || 'libx264',
        options
      });

      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath);

        // Video codec and settings
        command
          .videoCodec(options.codec || 'libx264')
          .addOption('-crf', options.crf || 23) // Quality setting (lower = better quality)
          .addOption('-preset', options.preset || 'fast') // Encoding speed vs compression
          .addOption('-pix_fmt', 'yuv420p'); // Ensure compatibility

        // Intelligent resolution scaling
        if (options.resolution && options.resolution !== 'auto') {
          // Manual resolution specified
          command.size(options.resolution);
        } else if (inputMetadata.video) {
          // Auto scaling - only downscale, never upscale
          const { width, height } = inputMetadata.video;
          const isPortrait = height > width;
          
          if (isPortrait && width > 1080) {
            // Portrait video: limit width to 1080px
            command.addOption('-vf', 'scale=1080:-2');
            logger.info('Scaling portrait video to max width 1080px');
          } else if (!isPortrait && width > 1920) {
            // Landscape video: limit width to 1920px
            command.addOption('-vf', 'scale=1920:-2');
            logger.info('Scaling landscape video to max width 1920px');
          } else if (height > 1920) {
            // Very tall video: limit height to 1920px
            command.addOption('-vf', 'scale=-2:1920');
            logger.info('Scaling tall video to max height 1920px');
          }
          // -2 ensures height is divisible by 2 (required for H.264)
        }

        // Audio settings - copy or re-encode
        if (inputMetadata.audio) {
          command.audioCodec('aac').audioBitrate('128k');
        }

        // Output format
        command.format('mp4');

        // Progress tracking
        if (progressCallback && inputMetadata.duration) {
          command.on('progress', (progress) => {
            if (progress.timemark) {
              // Convert timemark to seconds
              const timemarkParts = progress.timemark.split(':');
              const seconds = parseInt(timemarkParts[0]) * 3600 + 
                             parseInt(timemarkParts[1]) * 60 + 
                             parseFloat(timemarkParts[2]);
              
              const progressPercent = Math.min(100, (seconds / inputMetadata.duration) * 100);
              progressCallback(Math.round(progressPercent));
            }
          });
        }

        // Error handling
        command.on('error', (error) => {
          logger.error('Video compression error:', {
            error: error.message,
            input: inputPath,
            output: outputPath
          });
          reject(error);
        });

        // Success handling
        command.on('end', async () => {
          try {
            const processingTime = (Date.now() - startTime) / 1000;
            
            // Wait for file system to flush and file to be fully written
            logger.info('Waiting for file system to complete write operations...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            
            // Validate file existence with retry logic
            let retries = 5;
            let outputStats = null;
            
            while (retries > 0) {
              try {
                await fs.access(outputPath);
                outputStats = await fs.stat(outputPath);
                
                // Verify file size is reasonable (at least 1KB)
                if (outputStats.size > 1024) {
                  break;
                }
                
                logger.warn(`Output file size too small (${outputStats.size} bytes), retrying...`);
              } catch (error) {
                logger.warn(`Output file not ready yet, retrying... (${retries} retries left)`);
              }
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
            }
            
            if (!outputStats || outputStats.size < 1024) {
              throw new Error('Video compression failed - output file is invalid or too small');
            }
            
            const compressionRatio = (1 - (outputStats.size / inputMetadata.size)) * 100;

            const result = {
              inputPath,
              outputPath,
              processingTime,
              originalSize: inputMetadata.size,
              compressedSize: outputStats.size,
              compressionRatio: Math.round(compressionRatio * 100) / 100,
              duration: inputMetadata.duration,
              format: 'mp4',
              codec: options.codec || 'libx264',
              skippedCompression: false
            };

            logger.info('Video compression completed and validated', {
              ...result,
              inputResolution: inputMetadata.video ? `${inputMetadata.video.width}x${inputMetadata.video.height}` : 'unknown'
            });
            resolve(result);

          } catch (error) {
            logger.error('Error validating output file:', error);
            reject(error);
          }
        });

        // Start compression
        command.save(outputPath);
      });

    } catch (error) {
      logger.error('Video compression setup error:', error);
      throw error;
    }
  }

  /**
   * Extract video thumbnail at specific time
   * @param {string} videoPath - Path to video file
   * @param {string} outputPath - Output thumbnail path
   * @param {number} timeOffset - Time offset in seconds (default: 10% of duration)
   * @returns {Promise<string>} Thumbnail path
   */
  async extractThumbnail(videoPath, outputPath, timeOffset = null) {
    try {
      const metadata = await this.getVideoMetadata(videoPath);
      const seekTime = timeOffset || Math.max(1, metadata.duration * 0.1);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(seekTime)
          .frames(1)
          .size('320x240')
          .format('jpg')
          .on('error', (error) => {
            logger.error('Thumbnail extraction error:', error);
            reject(error);
          })
          .on('end', () => {
            logger.info('Thumbnail extracted successfully', {
              video: videoPath,
              thumbnail: outputPath,
              seekTime
            });
            resolve(outputPath);
          })
          .save(outputPath);
      });

    } catch (error) {
      logger.error('Thumbnail extraction setup error:', error);
      throw error;
    }
  }

  /**
   * Validate video file
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} Validation result
   */
  async validateVideo(videoPath) {
    try {
      const metadata = await this.getVideoMetadata(videoPath);
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata
      };

      // Check if video stream exists
      if (!metadata.video) {
        validation.isValid = false;
        validation.errors.push('No video stream found');
      }

      // Check duration
      if (!metadata.duration || metadata.duration < 1) {
        validation.isValid = false;
        validation.errors.push('Video duration too short or invalid');
      }

      // Check file size
      if (metadata.size < 1000) { // Less than 1KB
        validation.isValid = false;
        validation.errors.push('File size too small');
      }

      // Warnings for suboptimal settings
      if (metadata.video && metadata.video.width < 480) {
        validation.warnings.push('Low resolution video (width < 480px)');
      }

      if (metadata.duration > 7200) { // 2 hours
        validation.warnings.push('Very long video (>2 hours) - processing may take significant time');
      }

      return validation;

    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to read video metadata: ${error.message}`],
        warnings: [],
        metadata: null
      };
    }
  }

  /**
   * Get video frame count
   * @param {string} videoPath - Path to video file
   * @returns {Promise<number>} Total frame count
   */
  async getFrameCount(videoPath) {
    return new Promise((resolve, reject) => {
      let frameCount = 0;
      
      ffmpeg(videoPath)
        .videoFilters('select=n\\=0') // Select every frame
        .format('null')
        .on('progress', (progress) => {
          frameCount = progress.frames || 0;
        })
        .on('error', (error) => {
          logger.error('Frame count error:', error);
          reject(error);
        })
        .on('end', () => {
          resolve(frameCount);
        })
        .pipe(require('stream').PassThrough(), { end: false });
    });
  }
}

module.exports = new VideoService();