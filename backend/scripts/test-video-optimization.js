#!/usr/bin/env node

const path = require('path');
const videoService = require('../src/services/videoService');
const logger = require('../src/utils/logger');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testVideoOptimization() {
  console.log('\n=== Video Optimization Test ===\n');
  
  // Test cases
  const testCases = [
    {
      name: 'Optimal H.264 Full HD Video',
      metadata: {
        video: {
          codec: 'h264',
          width: 1920,
          height: 1080,
          bitRate: 3000000 // 3 Mbps
        },
        format: 'mp4,mov,m4a,3gp,3g2,mj2',
        size: 50000000
      },
      expectedResult: true
    },
    {
      name: 'Optimal H.265 HD Video',
      metadata: {
        video: {
          codec: 'hevc',
          width: 1280,
          height: 720,
          bitRate: 2000000 // 2 Mbps
        },
        format: 'mp4',
        size: 30000000
      },
      expectedResult: true
    },
    {
      name: '4K Video (needs compression)',
      metadata: {
        video: {
          codec: 'h264',
          width: 3840,
          height: 2160,
          bitRate: 15000000 // 15 Mbps
        },
        format: 'mp4',
        size: 200000000
      },
      expectedResult: false
    },
    {
      name: 'High Bitrate Full HD (needs compression)',
      metadata: {
        video: {
          codec: 'h264',
          width: 1920,
          height: 1080,
          bitRate: 8000000 // 8 Mbps - over limit
        },
        format: 'mp4',
        size: 100000000
      },
      expectedResult: false
    },
    {
      name: 'Non-optimal codec (VP9)',
      metadata: {
        video: {
          codec: 'vp9',
          width: 1920,
          height: 1080,
          bitRate: 3000000
        },
        format: 'webm',
        size: 50000000
      },
      expectedResult: false
    },
    {
      name: 'AVI container (needs conversion)',
      metadata: {
        video: {
          codec: 'h264',
          width: 1920,
          height: 1080,
          bitRate: 3000000
        },
        format: 'avi',
        size: 50000000
      },
      expectedResult: false
    }
  ];
  
  // Run tests
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = videoService.isVideoOptimized(testCase.metadata);
    const success = result === testCase.expectedResult;
    
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Metadata:`, {
      codec: testCase.metadata.video?.codec,
      resolution: `${testCase.metadata.video?.width}x${testCase.metadata.video?.height}`,
      bitRate: testCase.metadata.video?.bitRate,
      format: testCase.metadata.format
    });
    console.log(`Expected: ${testCase.expectedResult}, Got: ${result}`);
    console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${Math.round((passed / testCases.length) * 100)}%`);
  
  // Test actual file processing (if test video provided)
  const testVideoPath = process.argv[2];
  if (testVideoPath) {
    console.log('\n=== Testing with actual video file ===');
    console.log(`File: ${testVideoPath}`);
    
    try {
      const metadata = await videoService.getVideoMetadata(testVideoPath);
      console.log('\nVideo metadata:', {
        duration: `${Math.round(metadata.duration)}s`,
        size: `${Math.round(metadata.size / 1024 / 1024)}MB`,
        format: metadata.format,
        video: metadata.video ? {
          codec: metadata.video.codec,
          resolution: `${metadata.video.width}x${metadata.video.height}`,
          bitRate: `${Math.round(metadata.video.bitRate / 1000)}kbps`
        } : null
      });
      
      const isOptimized = videoService.isVideoOptimized(metadata);
      console.log(`\nOptimization check: ${isOptimized ? '✅ Already optimized' : '❌ Needs compression'}`);
      
      // Test compression
      if (process.argv[3] === '--compress') {
        const outputPath = path.join(path.dirname(testVideoPath), 'test-output.mp4');
        console.log('\nTesting compression...');
        
        const startTime = Date.now();
        const result = await videoService.compressVideo(
          testVideoPath, 
          outputPath,
          {},
          (progress) => {
            process.stdout.write(`\rProgress: ${progress}%`);
          }
        );
        
        console.log('\n\nCompression result:', {
          processingTime: `${result.processingTime}s`,
          originalSize: `${Math.round(result.originalSize / 1024 / 1024)}MB`,
          compressedSize: `${Math.round(result.compressedSize / 1024 / 1024)}MB`,
          compressionRatio: `${result.compressionRatio}%`,
          skippedCompression: result.skippedCompression || false,
          reason: result.reason || 'N/A'
        });
      }
      
    } catch (error) {
      console.error('\nError processing video:', error.message);
    }
  }
}

// Run tests
testVideoOptimization().catch(console.error);