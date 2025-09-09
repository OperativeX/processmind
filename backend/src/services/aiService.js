const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
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
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes timeout
    });

    // Default model settings
    this.defaultModel = 'gpt-3.5-turbo';
    this.defaultMaxTokens = 2000;
    this.defaultTemperature = 0.7;
  }

  /**
   * Generate tags for video content based on transcript
   * @param {string} transcript - Video transcript text
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of generated tags
   */
  async generateTags(transcript, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      logger.info('Starting tag generation', {
        transcriptLength: transcript.length,
        options
      });

      if (!transcript || transcript.trim().length < 10) {
        logger.warn('Transcript too short for tag generation, using fallback', {
          transcriptLength: transcript ? transcript.length : 0,
          transcript: transcript
        });
        
        // Fallback tags for short/empty transcripts
        return {
          tags: [
            { name: 'video', weight: 0.3 },
            { name: 'content', weight: 0.2 },
            { name: 'media', weight: 0.2 }
          ],
          processingTime: 0,
          model: 'fallback',
          tokensUsed: 0
        };
      }

      const systemPrompt = `You are an expert in content analysis who creates relevant, searchable tags with weights for video content.

Analyze the provided video transcript and generate high-quality tags with relevance scores that help users find and categorize this content.

Guidelines:
1. Generate a maximum of 10 tags with weights
2. Each tag receives a weight from 0.0 to 1.0 based on relevance:
   - 0.8-1.0: Core topics, main focus of the video, specific technical terms
   - 0.5-0.7: Important secondary topics, mentioned technologies
   - 0.2-0.4: Casually mentioned concepts
   - Below 0.2: DO NOT output (too generic/irrelevant)
3. Use single words or short phrases (max 2-3 words)
4. Focus on main topics, concepts, technologies, processes or specific content
5. Avoid generic tags like "video", "content", "information", "tutorial", "guide"
6. Use lowercase for consistency
7. Consider both explicitly mentioned and implied topics
8. Include technical terms when relevant
9. IMPORTANT: Respond in the same language as the transcript
10. Only output tags with weight >= 0.2

You MUST only return a valid JSON array with objects. Each object has "tag" and "weight". No additional explanations or markdown.

Example output format:
[
  {"tag": "machine learning", "weight": 0.95},
  {"tag": "neural networks", "weight": 0.88},
  {"tag": "python", "weight": 0.72},
  {"tag": "tensorflow", "weight": 0.65},
  {"tag": "data science", "weight": 0.55}
]`;

      const userPrompt = `Analyze this video transcript and generate relevant tags:

"${transcript.slice(0, 4000)}"${transcript.length > 4000 ? '...' : ''}`;

      const response = await this.client.post('/chat/completions', {
        model: options.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.3 // Lower temperature for more focused tags
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI API');
      }

      // Parse JSON response
      let tagsData;
      try {
        tagsData = JSON.parse(content);
      } catch (parseError) {
        // Fallback: try to extract tags from non-JSON response
        const tagRegex = /"([^"]+)"/g;
        const matches = content.match(tagRegex);
        if (matches) {
          tagsData = matches.map(match => match.replace(/"/g, ''));
        } else {
          throw new Error('Failed to parse tags from AI response');
        }
      }

      // Extract tags array (handle different response formats)
      let tags = [];
      if (Array.isArray(tagsData)) {
        tags = tagsData;
      } else if (tagsData.tags && Array.isArray(tagsData.tags)) {
        tags = tagsData.tags;
      } else {
        throw new Error('Invalid tags format in AI response');
      }

      // Process weighted tags
      let processedTags = [];
      
      // Check if we have weighted tags or legacy string tags
      if (tags.length > 0 && typeof tags[0] === 'object' && tags[0].tag !== undefined) {
        // New weighted format
        processedTags = tags
          .filter(item => item && item.tag && typeof item.weight === 'number')
          .map(item => ({
            name: item.tag.toLowerCase().trim(),
            weight: Math.max(0, Math.min(1, item.weight)) // Clamp between 0 and 1
          }))
          .filter(item => item.name.length > 0 && item.name.length <= 50 && item.weight >= 0.2)
          .slice(0, options.maxTags || 10);
      } else {
        // Legacy string format - convert to weighted format
        const uniqueTagSet = new Set();
        tags.forEach(tag => {
          if (typeof tag === 'string') {
            const cleanTag = tag.toLowerCase().trim();
            if (cleanTag.length > 0 && cleanTag.length <= 50 && !uniqueTagSet.has(cleanTag)) {
              uniqueTagSet.add(cleanTag);
              processedTags.push({
                name: cleanTag,
                weight: 0.5 // Default weight for legacy tags
              });
            }
          }
        });
        processedTags = processedTags.slice(0, options.maxTags || 10);
      }

      const result = {
        tags: processedTags, // New consolidated format
        processingTime,
        model: options.model || this.defaultModel,
        tokensUsed: response.data.usage?.total_tokens || 0
      };

      logger.info('Tag generation completed', {
        generatedTags: processedTags.length,
        processingTime,
        tokensUsed: result.tokensUsed
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Tag generation failed', {
        error: error.message,
        processingTime,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      this.handleAPIError(error);
      // Create a clean error object without circular references
      const cleanError = new Error(error.message);
      cleanError.name = error.name;
      cleanError.status = error.response?.status;
      cleanError.statusText = error.response?.statusText;
      throw cleanError;
    }
  }

  /**
   * Generate todo list from video transcript
   * @param {string|Object} transcript - Video transcript text or object with text and segments
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of todo items with timestamps
   */
  async generateTodoList(transcript, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      // Handle both string and object inputs
      let transcriptText = '';
      let segments = [];
      
      if (typeof transcript === 'object' && transcript.text) {
        transcriptText = transcript.text;
        segments = transcript.segments || [];
      } else if (typeof transcript === 'string') {
        transcriptText = transcript;
      } else {
        throw new Error('Invalid transcript format');
      }

      logger.info('Starting todo list generation', {
        transcriptLength: transcriptText.length,
        segmentsCount: segments.length,
        options
      });

      if (!transcriptText || transcriptText.trim().length < 20) {
        logger.warn('Transcript too short for todo list generation, returning empty list', {
          transcriptLength: transcriptText ? transcriptText.length : 0
        });
        
        // Return empty todo list for short/empty transcripts
        return {
          todoList: [],
          processingTime: 0,
          model: 'fallback',
          tokensUsed: 0
        };
      }

      const systemPrompt = `You are an expert in analyzing video content and creating actionable todo lists based on the activities, processes, or steps mentioned in the content.

Your task is to identify specific actions, tasks, or steps that a viewer might want to follow or remember.

Guidelines:
1. Extract only concrete, actionable items
2. Each item should be a specific task or action in the language of the transcript
3. IMPORTANT: Use the provided timestamps from transcript segments to determine exact timestamps for each todo item
4. Focus on "how-to" steps, processes, or actionable advice
5. Maximum 20 items
6. Prioritize the most important and clearest actions
7. Use clear, precise language
8. Skip vague or non-actionable content
9. IMPORTANT: The todo list must be in the same language as the transcript.

When transcript segments with timestamps are provided:
- Use the "start" time of the segment where the action is mentioned
- Pay attention to the chronological order of actions
- If an action spans multiple segments, use the timestamp of the first relevant segment

You MUST only return a valid JSON object with a "todoItems" array. No markdown formatting, code blocks, or explanations. Each item should have:
- "task": string (description of the todo task)
- "timestamp": number (exact seconds from start based on segment times, or null if no segments available)
- "priority": string ("high", "medium", or "low")

Example output:
{
  "todoItems": [
    {
      "task": "Install Node.js from the official website",
      "timestamp": 120,
      "priority": "high"
    },
    {
      "task": "Create package.json file",
      "timestamp": 180,
      "priority": "medium"
    }
  ]
}`;

      // Build user prompt with segments if available
      let userPrompt = '';
      
      if (segments.length > 0) {
        // Include transcript with time-stamped segments
        userPrompt = `Analyze this video transcript with time-stamped segments and extract actionable todo items. Each segment shows [START_TIME - END_TIME] followed by the text:

`;
        
        segments.forEach((segment, index) => {
          if (index < 200) { // Limit to first 200 segments to avoid token limits
            userPrompt += `[${segment.start}s - ${segment.end}s] ${segment.text}\n`;
          }
        });
        
        if (segments.length > 200) {
          userPrompt += `\n... (${segments.length - 200} more segments)`;
        }
      } else {
        // Fallback to plain text
        userPrompt = `Analyze this video transcript and extract actionable todo items:

"${transcriptText.slice(0, 6000)}"${transcriptText.length > 6000 ? '...' : ''}`;
      }

      const response = await this.client.post('/chat/completions', {
        model: options.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: options.maxTokens || 1500,
        temperature: options.temperature || 0.5
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI API');
      }

      // Parse JSON response
      let todoData;
      try {
        todoData = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Failed to parse todo list from AI response');
      }

      // Extract todo items
      let todoItems = [];
      if (todoData.todoItems && Array.isArray(todoData.todoItems)) {
        todoItems = todoData.todoItems;
      } else if (todoData.items && Array.isArray(todoData.items)) {
        todoItems = todoData.items;
      } else if (Array.isArray(todoData)) {
        todoItems = todoData;
      } else {
        throw new Error('Invalid todo list format in AI response');
      }

      // Clean and validate todo items
      const videoDuration = options.videoDuration || null;
      const cleanedTodos = todoItems
        .filter(item => item && typeof item === 'object' && item.task)
        .map(item => {
          let timestamp = null;
          
          // Validate timestamp
          if (typeof item.timestamp === 'number') {
            timestamp = Math.max(0, item.timestamp);
            
            // If video duration is provided, ensure timestamp is within bounds
            if (videoDuration && timestamp > videoDuration) {
              logger.warn('Todo timestamp exceeds video duration', {
                task: item.task,
                timestamp,
                videoDuration
              });
              timestamp = null;
            }
          }
          
          return {
            task: item.task.trim(),
            timestamp,
            priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
            completed: false
          };
        })
        .filter(item => item.task.length > 0 && item.task.length <= 500)
        .slice(0, options.maxItems || 20);

      const result = {
        todoList: cleanedTodos,
        processingTime,
        model: options.model || this.defaultModel,
        tokensUsed: response.data.usage?.total_tokens || 0
      };

      logger.info('Todo list generation completed', {
        generatedItems: cleanedTodos.length,
        processingTime,
        tokensUsed: result.tokensUsed
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Todo list generation failed', {
        error: error.message,
        processingTime,
        status: error.response?.status
      });

      this.handleAPIError(error);
      // Create a clean error object without circular references
      const cleanError = new Error(error.message);
      cleanError.name = error.name;
      cleanError.status = error.response?.status;
      cleanError.statusText = error.response?.statusText;
      throw cleanError;
    }
  }

  /**
   * Generate title for video content
   * @param {string} transcript - Video transcript text
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated title
   */
  async generateTitle(transcript, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      logger.info('Starting title generation', {
        transcriptLength: transcript.length,
        options
      });

      if (!transcript || transcript.trim().length < 10) {
        logger.warn('Transcript too short for title generation, using default', {
          transcriptLength: transcript ? transcript.length : 0
        });
        
        // Return default title for short/empty transcripts
        return {
          title: 'Untitled Video',
          processingTime: 0,
          model: 'fallback',
          tokensUsed: 0
        };
      }

      const systemPrompt = `You are an expert in content analysis and create engaging, descriptive titles for video content.

Your task is to analyze the video transcript and create a clear, meaningful title in the same language as the transcript that accurately represents the main topic or purpose of the content.

Guidelines:
1. Keep the title concise (5-15 words ideal, max 100 characters)
2. Make it descriptive and specific
3. Focus on the main topic, process, or outcome
4. Use active language when possible
5. Avoid clickbait or misleading titles
6. Include important technical terms when relevant
7. Make it searchable and SEO-friendly
8. Consider the target audience
9. IMPORTANT: The title must use the same language as the transcript

You MUST only return a valid JSON object with a "title" field containing the generated title. No markdown formatting, code blocks, or explanations.

Example output:
{
  "title": "Building a React Authentication System with JWT Tokens"
}`;

      const userPrompt = `Analyze this video transcript and generate an appropriate title:

"${transcript.slice(0, 3000)}"${transcript.length > 3000 ? '...' : ''}`;

      const response = await this.client.post('/chat/completions', {
        model: options.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: options.maxTokens || 200,
        temperature: options.temperature || 0.6
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI API');
      }

      // Parse JSON response
      let titleData;
      try {
        titleData = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Failed to parse title from AI response');
      }

      // Extract title
      let title = '';
      if (titleData.title && typeof titleData.title === 'string') {
        title = titleData.title;
      } else if (typeof titleData === 'string') {
        title = titleData;
      } else {
        throw new Error('Invalid title format in AI response');
      }

      // Clean and validate title
      const cleanedTitle = title
        .trim()
        .replace(/^["']|["']$/g, '') // Remove quotes
        .substring(0, options.maxLength || 200);

      if (!cleanedTitle || cleanedTitle.length < 3) {
        throw new Error('Generated title is too short or empty');
      }

      const result = {
        title: cleanedTitle,
        processingTime,
        model: options.model || this.defaultModel,
        tokensUsed: response.data.usage?.total_tokens || 0
      };

      logger.info('Title generation completed', {
        titleLength: cleanedTitle.length,
        processingTime,
        tokensUsed: result.tokensUsed
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Title generation failed', {
        error: error.message,
        processingTime,
        status: error.response?.status
      });

      this.handleAPIError(error);
      // Create a clean error object without circular references
      const cleanError = new Error(error.message);
      cleanError.name = error.name;
      cleanError.status = error.response?.status;
      cleanError.statusText = error.response?.statusText;
      throw cleanError;
    }
  }

  /**
   * Generate embedding for text using OpenAI's embedding model
   * @param {string} text - Text to generate embedding for
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Embedding array and metadata
   */
  async generateEmbedding(text, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      logger.info('Starting embedding generation', {
        textLength: text.length,
        options
      });

      if (!text || text.trim().length < 10) {
        throw new Error('Text too short for embedding generation');
      }

      // Truncate text to avoid token limits (8191 tokens max for ada-002)
      // Roughly 1 token per 4 characters
      const maxChars = 30000;
      const truncatedText = text.length > maxChars 
        ? text.slice(0, maxChars) + '...'
        : text;

      const response = await this.client.post('/embeddings', {
        model: options.model || 'text-embedding-ada-002',
        input: truncatedText
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const embedding = response.data.data[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('No embedding received from OpenAI API');
      }

      const result = {
        embedding,
        dimensions: embedding.length,
        processingTime,
        model: options.model || 'text-embedding-ada-002',
        tokensUsed: response.data.usage?.total_tokens || 0
      };

      logger.info('Embedding generation completed', {
        dimensions: result.dimensions,
        processingTime,
        tokensUsed: result.tokensUsed
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Embedding generation failed', {
        error: error.message,
        processingTime,
        status: error.response?.status
      });

      this.handleAPIError(error);
      const cleanError = new Error(error.message);
      cleanError.name = error.name;
      cleanError.status = error.response?.status;
      cleanError.statusText = error.response?.statusText;
      throw cleanError;
    }
  }

  /**
   * Generate embedding from title and tags instead of transcript
   * @param {string} title - Process title
   * @param {Array} tags - Array of tags with weights
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Embedding array and metadata
   */
  async generateEmbeddingFromTitleAndTags(title, tags, options = {}) {
    const requestStartTime = Date.now();
    
    try {
      logger.info('Starting embedding generation from title and tags', {
        titleLength: title?.length || 0,
        tagsCount: tags?.length || 0,
        options
      });

      if (!title || title.trim().length < 3) {
        throw new Error('Title too short for embedding generation');
      }

      // Build optimized text from title and tags
      let embeddingText = title.trim();
      
      // Add tags sorted by weight (highest first)
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const sortedTags = [...tags]
          .filter(tag => tag.name && tag.weight > 0)
          .sort((a, b) => b.weight - a.weight)
          .map(tag => tag.name);
        
        if (sortedTags.length > 0) {
          embeddingText += '\n\nTags: ' + sortedTags.join(', ');
        }
      }

      logger.info('Prepared embedding text', {
        textLength: embeddingText.length,
        text: embeddingText.substring(0, 200) + (embeddingText.length > 200 ? '...' : '')
      });

      const response = await this.client.post('/embeddings', {
        model: options.model || 'text-embedding-ada-002',
        input: embeddingText
      });

      const processingTime = (Date.now() - requestStartTime) / 1000;
      const embedding = response.data.data[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('No embedding received from OpenAI API');
      }

      const result = {
        embedding,
        dimensions: embedding.length,
        processingTime,
        model: options.model || 'text-embedding-ada-002',
        tokensUsed: response.data.usage?.total_tokens || 0,
        method: 'title-tags' // Track the generation method
      };

      logger.info('Embedding generation from title/tags completed', {
        dimensions: result.dimensions,
        processingTime,
        tokensUsed: result.tokensUsed,
        method: result.method
      });

      return result;

    } catch (error) {
      const processingTime = (Date.now() - requestStartTime) / 1000;
      
      logger.error('Embedding generation from title/tags failed', {
        error: error.message,
        processingTime,
        status: error.response?.status
      });

      this.handleAPIError(error);
      const cleanError = new Error(error.message);
      cleanError.name = error.name;
      cleanError.status = error.response?.status;
      cleanError.statusText = error.response?.statusText;
      throw cleanError;
    }
  }

  /**
   * Generate comprehensive content analysis
   * @param {string} transcript - Video transcript text
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Complete analysis including title, tags, and todos
   */
  async generateCompleteAnalysis(transcript, options = {}) {
    try {
      logger.info('Starting complete content analysis', {
        transcriptLength: transcript.length
      });

      // Run all analyses in parallel for efficiency
      const [titleResult, tagsResult, todoResult, embeddingResult] = await Promise.all([
        this.generateTitle(transcript, options.title || {}),
        this.generateTags(transcript, options.tags || {}),
        this.generateTodoList(transcript, options.todo || {}),
        this.generateEmbedding(transcript, options.embedding || {})
      ]);

      const result = {
        title: titleResult.title,
        tags: tagsResult.tags,
        tagWeights: tagsResult.tagWeights,
        todoList: todoResult.todoList,
        embedding: embeddingResult.embedding,
        analysis: {
          totalProcessingTime: titleResult.processingTime + tagsResult.processingTime + todoResult.processingTime + embeddingResult.processingTime,
          totalTokensUsed: titleResult.tokensUsed + tagsResult.tokensUsed + todoResult.tokensUsed + embeddingResult.tokensUsed,
          models: {
            title: titleResult.model,
            tags: tagsResult.model,
            todo: todoResult.model,
            embedding: embeddingResult.model
          }
        }
      };

      logger.info('Complete analysis finished', {
        title: !!result.title,
        tagsCount: result.tags.length,
        todoCount: result.todoList.length,
        totalProcessingTime: result.analysis.totalProcessingTime,
        totalTokensUsed: result.analysis.totalTokensUsed
      });

      return result;

    } catch (error) {
      logger.error('Complete analysis failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle OpenAI API errors with specific error messages
   * @param {Error} error - The error object
   */
  handleAPIError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        logger.error('OpenAI API authentication failed - invalid API key');
      } else if (status === 429) {
        logger.error('OpenAI API rate limit exceeded', {
          retryAfter: error.response.headers['retry-after']
        });
      } else if (status === 400) {
        logger.error('OpenAI API bad request', {
          error: data.error?.message || 'Unknown bad request'
        });
      } else if (status >= 500) {
        logger.error('OpenAI API server error', {
          status,
          message: data.error?.message || 'Internal server error'
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      logger.error('OpenAI API request timeout');
    } else {
      logger.error('OpenAI API network error', {
        message: error.message
      });
    }
  }

  /**
   * Estimate API costs for analysis
   * @param {string} transcript - Transcript text
   * @param {Object} options - Analysis options
   * @returns {Object} Cost estimation
   */
  estimateAnalysisCost(transcript, options = {}) {
    // Rough token estimation (1 token ≈ 4 characters)
    const inputTokens = Math.ceil(transcript.length / 4);
    
    // Output tokens estimation
    const titleTokens = 50;
    const tagsTokens = 200;
    const todoTokens = 800;
    const totalOutputTokens = titleTokens + tagsTokens + todoTokens;
    
    // GPT-3.5-turbo pricing (as of 2024)
    const gptInputCostPer1000 = 0.0005;   // $0.0005 per 1K input tokens
    const gptOutputCostPer1000 = 0.0015;  // $0.0015 per 1K output tokens
    
    // Embedding pricing (text-embedding-ada-002)
    const embeddingCostPer1000 = 0.0001;  // $0.0001 per 1K tokens
    
    // Calculate costs
    const gptInputCost = (inputTokens * 3 / 1000) * gptInputCostPer1000; // 3 GPT requests
    const gptOutputCost = (totalOutputTokens / 1000) * gptOutputCostPer1000;
    const embeddingCost = (inputTokens / 1000) * embeddingCostPer1000;
    
    const totalCost = gptInputCost + gptOutputCost + embeddingCost;
    
    return {
      estimatedInputTokens: inputTokens * 4, // 3 GPT + 1 embedding
      estimatedOutputTokens: totalOutputTokens,
      estimatedTotalTokens: (inputTokens * 4) + totalOutputTokens,
      gptInputCost: Math.round(gptInputCost * 10000) / 10000,
      gptOutputCost: Math.round(gptOutputCost * 10000) / 10000,
      embeddingCost: Math.round(embeddingCost * 10000) / 10000,
      totalCost: Math.round(totalCost * 10000) / 10000,
      currency: 'USD'
    };
  }
}

module.exports = new AIService();