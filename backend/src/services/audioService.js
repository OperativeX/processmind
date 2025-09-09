const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class AudioService {
  /**
   * Extract audio from video file
   * @param {string} videoPath - Input video file path
   * @param {string} audioPath - Output audio file path
   * @param {Object} options - Audio extraction options
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Extraction result
   */
  async extractAudio(videoPath, audioPath, options = {}, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(audioPath);
      await fs.mkdir(outputDir, { recursive: true });

      logger.info('Starting audio extraction', {
        video: videoPath,
        audio: audioPath,
        options
      });

      return new Promise((resolve, reject) => {
        const command = ffmpeg(videoPath);

        // Audio settings
        command
          .audioCodec(options.codec || 'pcm_s16le') // PCM for better Whisper compatibility
          .audioChannels(options.channels || 1) // Mono for Whisper
          .audioFrequency(options.sampleRate || 16000) // 16kHz for Whisper
          .format(options.format || 'wav');

        // Remove video stream
        command.noVideo();

        // Progress tracking
        if (progressCallback) {
          command.on('progress', (progress) => {
            if (progress.percent) {
              progressCallback(Math.round(progress.percent));
            }
          });
        }

        // Error handling
        command.on('error', (error) => {
          logger.error('Audio extraction error:', {
            error: error.message,
            video: videoPath,
            audio: audioPath
          });
          reject(error);
        });

        // Success handling
        command.on('end', async () => {
          try {
            const processingTime = (Date.now() - startTime) / 1000;
            const audioStats = await fs.stat(audioPath);

            // Validate extracted audio
            const metadata = await this.getAudioMetadata(audioPath);
            
            logger.info('Extracted audio metadata', {
              audioPath,
              duration: metadata.duration,
              size: metadata.size,
              format: metadata.format,
              codec: metadata.codec,
              sampleRate: metadata.sampleRate,
              channels: metadata.channels
            });

            // Warn if audio is very short or potentially silent
            if (metadata.duration < 0.5) {
              logger.warn('Extracted audio is very short', {
                duration: metadata.duration,
                audioPath
              });
            }

            const result = {
              videoPath,
              audioPath,
              processingTime,
              audioSize: audioStats.size,
              format: options.format || 'wav',
              codec: options.codec || 'pcm_s16le',
              sampleRate: options.sampleRate || 16000,
              channels: options.channels || 1,
              duration: metadata.duration
            };

            logger.info('Audio extraction completed', result);
            resolve(result);

          } catch (error) {
            logger.error('Error getting audio file stats:', error);
            reject(error);
          }
        });

        // Start extraction
        command.save(audioPath);
      });

    } catch (error) {
      logger.error('Audio extraction setup error:', error);
      throw error;
    }
  }

  /**
   * Segment audio file into chunks for transcription
   * @param {string} audioPath - Input audio file path
   * @param {string} outputDir - Output directory for segments
   * @param {number} segmentDuration - Duration of each segment in seconds
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Segmentation result
   */
  async segmentAudio(audioPath, outputDir, segmentDuration = 600, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Get audio duration first
      const audioDuration = await this.getAudioDuration(audioPath);
      const expectedSegments = Math.ceil(audioDuration / segmentDuration);

      logger.info('Starting audio segmentation', {
        audio: audioPath,
        outputDir,
        segmentDuration,
        audioDuration,
        expectedSegments
      });

      return new Promise(async (resolve, reject) => {
        const outputPattern = path.join(outputDir, 'segment_%03d.wav');
        
        // Check if audio is shorter than segment duration
        if (audioDuration <= segmentDuration) {
          logger.info('Audio duration is shorter than segment duration, skipping segmentation', {
            audioDuration,
            segmentDuration,
            audioPath
          });
          
          try {
            // Just copy the file to the output directory as a single segment
            const outputPath = path.join(outputDir, 'segment_000.wav');
            await fs.copyFile(audioPath, outputPath);
            
            const stats = await fs.stat(outputPath);
            
            const result = {
              audioPath,
              outputDir,
              processingTime: (Date.now() - startTime) / 1000,
              segmentDuration,
              totalDuration: audioDuration,
              segmentCount: 1,
              segments: [{
                index: 0,
                filename: 'segment_000.wav',
                path: outputPath,
                size: stats.size,
                startTime: 0,
                endTime: audioDuration
              }]
            };
            
            logger.info('Audio segmentation skipped (single segment)', result);
            resolve(result);
            return;
          } catch (error) {
            logger.error('Error copying audio file', error);
            reject(error);
            return;
          }
        }
        
        const command = ffmpeg(audioPath)
          .format('segment')
          .addOption('-segment_time', segmentDuration)
          .addOption('-f', 'segment')
          .addOption('-reset_timestamps', '1')
          .audioCodec('pcm_s16le') // Keep PCM format for Whisper
          .audioChannels(1)
          .audioFrequency(16000);

        // Progress tracking (estimate based on processing time)
        let progressTimer;
        if (progressCallback) {
          const estimatedDuration = audioDuration * 0.1; // Rough estimate
          let elapsed = 0;
          
          progressTimer = setInterval(() => {
            elapsed += 1;
            const progress = Math.min(95, (elapsed / estimatedDuration) * 100);
            progressCallback(Math.round(progress));
          }, 1000);
        }

        // Error handling
        command.on('error', (error) => {
          if (progressTimer) clearInterval(progressTimer);
          
          logger.error('Audio segmentation error:', {
            error: error.message,
            audio: audioPath,
            outputDir
          });
          reject(error);
        });

        // Success handling
        command.on('end', async () => {
          if (progressTimer) clearInterval(progressTimer);
          if (progressCallback) progressCallback(100);

          try {
            const processingTime = (Date.now() - startTime) / 1000;
            
            // Get list of created segments
            const files = await fs.readdir(outputDir);
            const segmentFiles = files
              .filter(file => file.startsWith('segment_') && file.endsWith('.wav'))
              .sort();

            // Calculate segment info
            const segments = await Promise.all(
              segmentFiles.map(async (filename, index) => {
                const filePath = path.join(outputDir, filename);
                const stats = await fs.stat(filePath);
                
                return {
                  index,
                  filename,
                  path: filePath,
                  size: stats.size,
                  startTime: index * segmentDuration,
                  endTime: Math.min((index + 1) * segmentDuration, audioDuration)
                };
              })
            );

            const result = {
              audioPath,
              outputDir,
              processingTime,
              segmentDuration,
              totalDuration: audioDuration,
              segmentCount: segments.length,
              segments
            };

            logger.info('Audio segmentation completed', {
              ...result,
              segments: result.segments.map(s => ({
                index: s.index,
                filename: s.filename,
                size: s.size
              }))
            });
            
            resolve(result);

          } catch (error) {
            logger.error('Error processing segmentation results:', error);
            reject(error);
          }
        });

        // Start segmentation
        command.save(outputPattern);
      });

    } catch (error) {
      logger.error('Audio segmentation setup error:', error);
      throw error;
    }
  }

  /**
   * Get audio file duration
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<number>} Duration in seconds
   */
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (error, metadata) => {
        if (error) {
          logger.error('Error getting audio duration:', error);
          reject(error);
        } else {
          resolve(parseFloat(metadata.format.duration));
        }
      });
    });
  }

  /**
   * Get audio metadata
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Audio metadata
   */
  async getAudioMetadata(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (error, metadata) => {
        if (error) {
          logger.error('Error getting audio metadata:', error);
          reject(error);
        } else {
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          resolve({
            duration: parseFloat(metadata.format.duration),
            size: parseInt(metadata.format.size),
            format: metadata.format.format_name,
            bitRate: parseInt(metadata.format.bit_rate),
            codec: audioStream?.codec_name,
            sampleRate: parseInt(audioStream?.sample_rate),
            channels: audioStream?.channels,
            bitDepth: audioStream?.bits_per_sample
          });
        }
      });
    });
  }

  /**
   * Validate audio file for transcription
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Validation result
   */
  async validateAudioForTranscription(audioPath) {
    try {
      const metadata = await this.getAudioMetadata(audioPath);
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata
      };

      // Check duration
      if (!metadata.duration || metadata.duration < 0.1) {
        validation.isValid = false;
        validation.errors.push('Audio duration too short');
      }

      // Check file size
      if (metadata.size < 100) { // Less than 100 bytes
        validation.isValid = false;
        validation.errors.push('Audio file too small');
      }

      // Whisper API file size limit (25MB)
      if (metadata.size > 25 * 1024 * 1024) {
        validation.isValid = false;
        validation.errors.push('Audio file too large for Whisper API (>25MB)');
      }

      // Check sample rate (Whisper works best with 16kHz)
      if (metadata.sampleRate && metadata.sampleRate < 8000) {
        validation.warnings.push('Low sample rate - transcription quality may be reduced');
      }

      // Check channels (Whisper prefers mono)
      if (metadata.channels > 1) {
        validation.warnings.push('Stereo audio - consider converting to mono for better transcription');
      }

      return validation;

    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to read audio metadata: ${error.message}`],
        warnings: [],
        metadata: null
      };
    }
  }

  /**
   * Convert audio to Whisper-optimal format
   * @param {string} inputPath - Input audio file path
   * @param {string} outputPath - Output audio file path
   * @returns {Promise<Object>} Conversion result
   */
  async convertToWhisperFormat(inputPath, outputPath) {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      logger.info('Converting audio to Whisper format', {
        input: inputPath,
        output: outputPath
      });

      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioCodec('pcm_s16le')
          .audioChannels(1) // Mono
          .audioFrequency(16000) // 16kHz
          .format('wav')
          .on('error', (error) => {
            logger.error('Audio conversion error:', error);
            reject(error);
          })
          .on('end', async () => {
            try {
              const processingTime = (Date.now() - startTime) / 1000;
              const outputStats = await fs.stat(outputPath);

              const result = {
                inputPath,
                outputPath,
                processingTime,
                outputSize: outputStats.size,
                format: 'wav',
                codec: 'pcm_s16le',
                sampleRate: 16000,
                channels: 1
              };

              logger.info('Audio conversion completed', result);
              resolve(result);

            } catch (error) {
              logger.error('Error getting converted audio stats:', error);
              reject(error);
            }
          })
          .save(outputPath);
      });

    } catch (error) {
      logger.error('Audio conversion setup error:', error);
      throw error;
    }
  }
}

module.exports = new AudioService();