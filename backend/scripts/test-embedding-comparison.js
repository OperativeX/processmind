#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
const { Process } = require('../src/models');
const aiService = require('../src/services/aiService');
const logger = require('../src/utils/logger');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB connected for testing');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function testEmbeddingGeneration() {
  try {
    // Find a process with transcript, title, and tags
    const testProcess = await Process.findOne({
      title: { $exists: true, $ne: '' },
      'tags.0': { $exists: true },
      'transcript.text': { $exists: true, $ne: '' }
    }).select('title tags transcript');

    if (!testProcess) {
      logger.error('No suitable test process found');
      return;
    }

    logger.info(`Testing with process: "${testProcess.title}"`);
    logger.info(`Tags: ${testProcess.tags.map(t => `${t.name} (${t.weight})`).join(', ')}`);

    // Generate embedding from transcript (old method)
    logger.info('\n1. Generating embedding from transcript...');
    const transcriptStartTime = Date.now();
    const transcriptResult = await aiService.generateEmbedding(
      testProcess.transcript.text.slice(0, 30000)
    );
    const transcriptTime = Date.now() - transcriptStartTime;

    // Generate embedding from title and tags (new method)
    logger.info('\n2. Generating embedding from title and tags...');
    const titleTagsStartTime = Date.now();
    const titleTagsResult = await aiService.generateEmbeddingFromTitleAndTags(
      testProcess.title,
      testProcess.tags
    );
    const titleTagsTime = Date.now() - titleTagsStartTime;

    // Calculate cosine similarity between the two embeddings
    const similarity = Process.calculateSimilarity(
      transcriptResult.embedding,
      titleTagsResult.embedding
    );

    // Display results
    logger.info('\n=== COMPARISON RESULTS ===');
    logger.info(`\nTranscript-based embedding:`);
    logger.info(`- Processing time: ${transcriptTime}ms`);
    logger.info(`- Tokens used: ${transcriptResult.tokensUsed}`);
    logger.info(`- Text length: ${testProcess.transcript.text.length} characters`);

    logger.info(`\nTitle/Tags-based embedding:`);
    logger.info(`- Processing time: ${titleTagsTime}ms`);
    logger.info(`- Tokens used: ${titleTagsResult.tokensUsed}`);
    logger.info(`- Text length: ~${testProcess.title.length + testProcess.tags.map(t => t.name).join(', ').length} characters`);

    logger.info(`\nPerformance improvement:`);
    logger.info(`- Speed: ${Math.round((1 - titleTagsTime / transcriptTime) * 100)}% faster`);
    logger.info(`- Tokens: ${Math.round((1 - titleTagsResult.tokensUsed / transcriptResult.tokensUsed) * 100)}% fewer tokens`);

    logger.info(`\nSimilarity between embeddings: ${(similarity * 100).toFixed(2)}%`);

    // Test similarity search with both embeddings
    logger.info('\n=== TESTING SIMILARITY SEARCH ===');
    
    // Find similar processes using the new embedding
    const similarProcesses = await Process.find({
      _id: { $ne: testProcess._id },
      embedding: { $exists: true, $ne: [] }
    })
      .select('title tags embedding embeddingMetadata')
      .limit(100);

    if (similarProcesses.length > 0) {
      // Calculate similarities with both methods
      const transcriptSimilarities = similarProcesses
        .map(p => ({
          title: p.title,
          similarity: Process.calculateSimilarity(transcriptResult.embedding, p.embedding),
          method: p.embeddingMetadata?.method || 'unknown'
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      const titleTagsSimilarities = similarProcesses
        .map(p => ({
          title: p.title,
          similarity: Process.calculateSimilarity(titleTagsResult.embedding, p.embedding),
          method: p.embeddingMetadata?.method || 'unknown'
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      logger.info('\nTop 5 similar processes (transcript-based):');
      transcriptSimilarities.forEach((p, i) => {
        logger.info(`${i + 1}. "${p.title}" - ${(p.similarity * 100).toFixed(2)}% (method: ${p.method})`);
      });

      logger.info('\nTop 5 similar processes (title/tags-based):');
      titleTagsSimilarities.forEach((p, i) => {
        logger.info(`${i + 1}. "${p.title}" - ${(p.similarity * 100).toFixed(2)}% (method: ${p.method})`);
      });
    }

    // Cost estimation
    const transcriptCost = (transcriptResult.tokensUsed / 1000) * 0.0001; // $0.0001 per 1K tokens
    const titleTagsCost = (titleTagsResult.tokensUsed / 1000) * 0.0001;
    
    logger.info('\n=== COST ANALYSIS ===');
    logger.info(`Transcript-based: $${transcriptCost.toFixed(6)} per embedding`);
    logger.info(`Title/Tags-based: $${titleTagsCost.toFixed(6)} per embedding`);
    logger.info(`Cost reduction: ${Math.round((1 - titleTagsCost / transcriptCost) * 100)}%`);

  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  }
}

async function main() {
  try {
    logger.info('Starting embedding generation comparison test');
    
    await connectDB();
    await testEmbeddingGeneration();
    
    logger.info('\nTest completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

main();