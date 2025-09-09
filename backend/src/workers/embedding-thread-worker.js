/**
 * Embedding Thread Worker - Processes embeddings in separate thread
 * Optimizes memory usage for 1536-dimensional vector operations
 */

const { parentPort, workerData } = require('worker_threads');
const axios = require('axios');

// Worker identification
const workerId = workerData.workerId || 0;
// Removed console.log for production

// OpenAI client setup
const openaiClient = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 1 minute timeout
});

// Handle messages from main thread
parentPort.on('message', async (data) => {
  const { type, processId, transcript, title, tags, options } = data;
  
  try {
    switch (type) {
      case 'embedding':
        const result = await generateOptimizedEmbedding(processId, transcript, title, tags, options);
        parentPort.postMessage({ success: true, result });
        break;
        
      case 'batch-similarity':
        const similarities = await calculateBatchSimilarities(data.embeddings, data.targetEmbedding);
        parentPort.postMessage({ success: true, result: similarities });
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
 * Generate optimized embedding with memory-efficient processing
 */
async function generateOptimizedEmbedding(processId, transcript, title, tags, options = {}) {
  const startTime = Date.now();
  
  try {
    // Prefer title and tags over full transcript for better performance
    let embeddingText = '';
    
    if (title && tags && tags.length > 0) {
      // Optimized approach: Use title and weighted tags
      embeddingText = title.trim();
      
      // Add tags sorted by weight
      const sortedTags = [...tags]
        .filter(tag => tag.name && tag.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 20) // Limit to top 20 tags
        .map(tag => tag.name);
      
      if (sortedTags.length > 0) {
        embeddingText += '\n\nTags: ' + sortedTags.join(', ');
      }
      
      // Add a small excerpt from transcript if space allows
      if (transcript && embeddingText.length < 1000) {
        const excerptLength = Math.min(2000 - embeddingText.length, 500);
        embeddingText += '\n\nExcerpt: ' + transcript.substring(0, excerptLength);
      }
    } else if (transcript) {
      // Fallback to transcript-based embedding
      const maxChars = 8000; // Conservative limit for token count
      embeddingText = transcript.length > maxChars 
        ? transcript.slice(0, maxChars) + '...'
        : transcript;
    } else {
      throw new Error('No content available for embedding generation');
    }
    
    // Call OpenAI API
    const response = await openaiClient.post('/embeddings', {
      model: options.model || 'text-embedding-ada-002',
      input: embeddingText
    });
    
    const embedding = response.data.data[0]?.embedding;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error('Invalid embedding received from OpenAI API');
    }
    
    // Convert to Float32Array for memory efficiency
    const optimizedEmbedding = new Float32Array(embedding);
    
    return {
      embedding: Array.from(optimizedEmbedding), // Convert back to regular array for serialization
      dimensions: embedding.length,
      processingTime: Date.now() - startTime,
      model: options.model || 'text-embedding-ada-002',
      tokensUsed: response.data.usage?.total_tokens || 0,
      method: title && tags ? 'title-tags' : 'transcript',
      workerId,
      textLength: embeddingText.length
    };
    
  } catch (error) {
    console.error(`Worker ${workerId} embedding generation error:`, error);
    throw error;
  }
}

/**
 * Calculate batch similarities efficiently
 */
async function calculateBatchSimilarities(embeddings, targetEmbedding) {
  const startTime = Date.now();
  
  try {
    // Convert to Float32Arrays for efficient computation
    const target = new Float32Array(targetEmbedding);
    const targetMagnitude = calculateMagnitude(target);
    
    const similarities = embeddings.map((embedding, index) => {
      if (!embedding || embedding.length !== 1536) {
        return { index, similarity: 0 };
      }
      
      const emb = new Float32Array(embedding);
      const similarity = cosineSimilarity(emb, target, targetMagnitude);
      
      return { index, similarity };
    });
    
    return {
      similarities,
      processingTime: Date.now() - startTime,
      count: embeddings.length,
      workerId
    };
    
  } catch (error) {
    console.error(`Worker ${workerId} batch similarity error:`, error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB, magnitudeB = null) {
  let dotProduct = 0;
  let magnitudeA = 0;
  
  // Calculate dot product and magnitude of A in single pass
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = magnitudeB || calculateMagnitude(vecB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate vector magnitude
 */
function calculateMagnitude(vec) {
  let magnitude = 0;
  for (let i = 0; i < vec.length; i++) {
    magnitude += vec[i] * vec[i];
  }
  return Math.sqrt(magnitude);
}

// Handle thread termination
process.on('exit', () => {
  console.log(`Embedding thread worker ${workerId} exiting`);
});