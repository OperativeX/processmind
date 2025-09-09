const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const logger = require('../utils/logger');

class TranscriptionService {
  constructor() {
    this.openaiAPIKey = process.env.OPENAI_API_KEY;
    this.openaiBaseURL = 'https://api.openai.com/v1';
    
    if (!this.openaiAPIKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    // Configure axios for OpenAI API
    this.client = axios.create({
      baseURL: this.openaiBaseURL,
      headers: {
        'Authorization': `Bearer ${this.openaiAPIKey}`,
      },
      timeout: 300000, // 5 minutes timeout for transcription
    });
  }

  /**
   * Transcribe a single audio segment using OpenAI Whisper API
   * @param {string} audioPath - Path to audio segment file
   * @param {number} segmentIndex - Index of the segment
   * @param {number} startTime - Start time offset in seconds
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudioSegment(audioPath, segmentIndex, startTime = 0, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      logger.info('Starting transcription', {
        audioPath,
        segmentIndex,
        startTime,
        options
      });

      // Check if file exists and get size
      const fileStats = await fs.stat(audioPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      logger.info('Audio file details', {
        audioPath,
        fileSize: fileStats.size,
        fileSizeMB: fileSizeMB.toFixed(2),
        segmentIndex
      });
      
      // Whisper API has a 25MB file size limit
      if (fileSizeMB > 25) {
        throw new Error(`Audio file too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)`);
      }
      
      // Check for very small files that might be silent
      if (fileStats.size < 1000) {
        logger.warn('Audio file is very small, might be silent', {
          audioPath,
          fileSize: fileStats.size
        });
      }

      // Validate audio duration before sending to Whisper
      try {
        const audioService = require('./audioService');
        const metadata = await audioService.getAudioMetadata(audioPath);
        
        logger.info('Audio metadata for transcription', {
          audioPath,
          duration: metadata.duration,
          format: metadata.format,
          codec: metadata.codec,
          sampleRate: metadata.sampleRate
        });
        
        if (!metadata.duration || metadata.duration < 0.1) {
          logger.error('Audio file is too short for transcription', {
            audioPath,
            duration: metadata.duration
          });
          
          // Return empty transcription for very short audio
          return {
            segmentIndex,
            startTimeOffset: startTime,
            text: '',
            processingTime: 0,
            fileSizeMB: Math.round(fileSizeMB * 100) / 100,
            skipped: true,
            reason: 'audio_too_short'
          };
        }
      } catch (metadataError) {
        logger.error('Failed to get audio metadata', {
          audioPath,
          error: metadataError.message
        });
      }

      // Create form data for multipart upload
      const formData = new FormData();
      const audioBuffer = await fs.readFile(audioPath);
      
      // Additional validation for buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        logger.error('Audio buffer is empty', {
          audioPath,
          bufferLength: audioBuffer ? audioBuffer.length : 0
        });
        
        return {
          segmentIndex,
          startTimeOffset: startTime,
          text: '',
          processingTime: 0,
          fileSizeMB: Math.round(fileSizeMB * 100) / 100,
          skipped: true,
          reason: 'empty_buffer'
        };
      }
      
      logger.info('Audio buffer loaded', {
        audioPath,
        bufferLength: audioBuffer.length,
        segmentIndex
      });
      
      formData.append('file', audioBuffer, {
        filename: `segment_${segmentIndex.toString().padStart(3, '0')}.wav`,
        contentType: 'audio/wav'
      });
      
      // Set transcription parameters
      formData.append('model', options.model || 'whisper-1');
      formData.append('response_format', options.responseFormat || 'verbose_json');
      
      // Language detection (auto by default)
      if (options.language) {
        formData.append('language', options.language);
      }
      
      // Temperature for creativity (0.0 - 1.0)
      formData.append('temperature', (options.temperature || 0).toString());
      
      // Timestamp granularities
      if (options.timestampGranularities) {
        options.timestampGranularities.forEach(granularity => {
          formData.append('timestamp_granularities[]', granularity);
        });
      }

      // Optional prompt for context/style
      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      // Make API request
      const response = await this.client.post('/audio/transcriptions', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const transcriptionData = response.data;

      logger.info('Whisper API response received', {
        segmentIndex,
        responseType: typeof transcriptionData,
        hasText: !!transcriptionData?.text,
        textLength: transcriptionData?.text?.length || 0,
        textPreview: transcriptionData?.text?.substring(0, 100),
        language: transcriptionData?.language,
        duration: transcriptionData?.duration
      });

      // Check for bell emoji or other non-speech indicators
      if (transcriptionData?.text === '🔔' || transcriptionData?.text?.trim() === '') {
        logger.warn('Whisper returned bell emoji or empty text - audio might be silent', {
          segmentIndex,
          audioPath,
          text: transcriptionData?.text
        });
      }

      // Process the response based on format
      let result;
      if (options.responseFormat === 'verbose_json') {
        result = {
          segmentIndex,
          startTimeOffset: startTime,
          text: transcriptionData.text,
          language: transcriptionData.language,
          duration: transcriptionData.duration,
          segments: transcriptionData.segments?.map(segment => ({
            id: segment.id,
            start: segment.start + startTime, // Adjust timing for segment offset
            end: segment.end + startTime,
            text: segment.text,
            temperature: segment.temperature,
            avgLogprob: segment.avg_logprob,
            compressionRatio: segment.compression_ratio,
            noSpeechProb: segment.no_speech_prob,
            tokens: segment.tokens
          })) || [],
          processingTime,
          fileSizeMB: Math.round(fileSizeMB * 100) / 100
        };
      } else {
        // Simple text format
        result = {
          segmentIndex,
          startTimeOffset: startTime,
          text: typeof transcriptionData === 'string' ? transcriptionData : transcriptionData.text,
          processingTime,
          fileSizeMB: Math.round(fileSizeMB * 100) / 100
        };
      }

      logger.info('Transcription completed', {
        segmentIndex,
        textLength: result.text.length,
        processingTime,
        fileSizeMB,
        language: result.language || 'auto'
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Transcription failed', {
        error: error.message,
        segmentIndex,
        audioPath,
        processingTime,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // Handle specific OpenAI API errors
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 413) {
          throw new Error('Audio file too large for Whisper API (max 25MB)');
        } else if (status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (status === 400) {
          throw new Error(`Invalid request: ${data.error?.message || 'Unknown error'}`);
        }
      }

      throw error;
    }
  }

  /**
   * Merge multiple transcript segments into a single transcript
   * @param {Array} transcriptSegments - Array of transcription results
   * @returns {Promise<Object>} Merged transcript
   */
  async mergeTranscriptSegments(transcriptSegments) {
    try {
      logger.info('Merging transcript segments', {
        segmentCount: transcriptSegments.length
      });

      if (!transcriptSegments || transcriptSegments.length === 0) {
        throw new Error('No transcript segments to merge');
      }

      // Sort segments by index to ensure correct order
      const sortedSegments = transcriptSegments.sort((a, b) => a.segmentIndex - b.segmentIndex);

      // Filter out skipped segments and merge text
      const validSegments = sortedSegments.filter(segment => !segment.skipped);
      
      if (validSegments.length === 0) {
        logger.warn('All segments were skipped', {
          totalSegments: sortedSegments.length,
          reasons: sortedSegments.map(s => s.reason).filter(Boolean)
        });
      }
      
      const fullText = validSegments
        .map(segment => segment.text?.trim())
        .filter(text => text && text.length > 0)
        .join(' ');

      // Merge detailed segments if available
      const allSegments = [];
      let totalDuration = 0;
      const languages = new Set();
      let totalProcessingTime = 0;

      for (const segment of validSegments) {
        if (segment.segments && segment.segments.length > 0) {
          allSegments.push(...segment.segments);
        }
        
        if (segment.duration) {
          totalDuration += segment.duration;
        }
        
        if (segment.language) {
          languages.add(segment.language);
        }
        
        if (segment.processingTime) {
          totalProcessingTime += segment.processingTime;
        }
      }

      // Sort merged segments by start time
      allSegments.sort((a, b) => a.start - b.start);

      // Detect primary language (most common)
      const languageArray = Array.from(languages);
      const primaryLanguage = languageArray.length > 0 ? languageArray[0] : 'unknown';

      // Calculate confidence metrics
      const avgLogprobs = allSegments
        .map(s => s.avgLogprob)
        .filter(logprob => logprob !== undefined);
      
      const averageConfidence = avgLogprobs.length > 0 
        ? avgLogprobs.reduce((sum, logprob) => sum + logprob, 0) / avgLogprobs.length
        : null;

      // Calculate compression ratio
      const compressionRatios = allSegments
        .map(s => s.compressionRatio)
        .filter(ratio => ratio !== undefined);
      
      const averageCompressionRatio = compressionRatios.length > 0
        ? compressionRatios.reduce((sum, ratio) => sum + ratio, 0) / compressionRatios.length
        : null;

      const mergedTranscript = {
        text: fullText,
        segments: allSegments,
        language: primaryLanguage,
        confidence: averageConfidence ? Math.exp(averageConfidence) : null, // Convert from log probability
        statistics: {
          totalSegments: sortedSegments.length,
          totalDetailedSegments: allSegments.length,
          totalDuration: Math.round(totalDuration * 100) / 100,
          totalProcessingTime: Math.round(totalProcessingTime * 100) / 100,
          averageConfidence: averageConfidence,
          averageCompressionRatio: averageCompressionRatio,
          detectedLanguages: languageArray,
          wordCount: fullText.split(/\s+/).length,
          characterCount: fullText.length
        }
      };

      logger.info('Transcript segments merged successfully', {
        totalSegments: sortedSegments.length,
        finalTextLength: fullText.length,
        totalDuration,
        primaryLanguage,
        wordCount: mergedTranscript.statistics.wordCount
      });

      return mergedTranscript;

    } catch (error) {
      logger.error('Failed to merge transcript segments', {
        error: error.message,
        segmentCount: transcriptSegments?.length || 0
      });
      
      throw error;
    }
  }

  /**
   * Validate audio file for transcription
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Validation result
   */
  async validateAudioForTranscription(audioPath) {
    try {
      const fileStats = await fs.stat(audioPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        fileSize: fileStats.size,
        fileSizeMB: Math.round(fileSizeMB * 100) / 100
      };

      // Check file size (Whisper API limit)
      if (fileSizeMB > 25) {
        validation.isValid = false;
        validation.errors.push(`File too large: ${validation.fileSizeMB}MB (max 25MB)`);
      }

      // Check minimum file size
      if (fileStats.size < 100) {
        validation.isValid = false;
        validation.errors.push('File too small (less than 100 bytes)');
      }

      // Warnings
      if (fileSizeMB > 20) {
        validation.warnings.push('Large file size may result in slower processing');
      }

      return validation;

    } catch (error) {
      return {
        isValid: false,
        errors: [`File validation failed: ${error.message}`],
        warnings: [],
        fileSize: null,
        fileSizeMB: null
      };
    }
  }

  /**
   * Get supported languages for Whisper
   * @returns {Array} Array of supported language codes
   */
  getSupportedLanguages() {
    return [
      'af', 'am', 'ar', 'as', 'az', 'ba', 'be', 'bg', 'bn', 'bo', 'br', 'bs', 'ca', 'cs', 'cy',
      'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fo', 'fr', 'gl', 'gu', 'ha', 'haw',
      'he', 'hi', 'hr', 'ht', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'jw', 'ka', 'kk', 'km', 'kn',
      'ko', 'la', 'lb', 'ln', 'lo', 'lt', 'lv', 'mg', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt',
      'my', 'ne', 'nl', 'nn', 'no', 'oc', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru', 'sa', 'sd', 'si',
      'sk', 'sl', 'sn', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'tk', 'tl',
      'tr', 'tt', 'uk', 'ur', 'uz', 'vi', 'yi', 'yo', 'zh'
    ];
  }

  /**
   * Estimate transcription cost
   * @param {number} durationMinutes - Audio duration in minutes
   * @returns {Object} Cost estimation
   */
  estimateTranscriptionCost(durationMinutes) {
    // OpenAI Whisper pricing (as of 2024): $0.006 per minute
    const pricePerMinute = 0.006;
    const estimatedCost = durationMinutes * pricePerMinute;
    
    return {
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      pricePerMinute,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      currency: 'USD'
    };
  }
}

module.exports = new TranscriptionService();