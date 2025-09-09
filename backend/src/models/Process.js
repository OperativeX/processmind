const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transcriptSegmentSchema = new mongoose.Schema({
  start: {
    type: Number,
    required: true,
    min: 0
  },
  end: {
    type: Number,
    required: true,
    min: 0
  },
  text: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const todoItemSchema = new mongoose.Schema({
  task: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Todo task cannot exceed 500 characters']
  },
  timestamp: {
    type: Number, // Timestamp in seconds from start of video
    min: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

const processSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    default: 'New Process'
  },

  originalFilename: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },

  // File information
  files: {
    original: {
      path: String, // Path to original uploaded file
      size: Number, // File size in bytes
      duration: Number, // Video duration in seconds
      format: String, // Original format (mp4, avi, etc.)
      resolution: {
        width: Number,
        height: Number
      },
      storageType: { 
        type: String, 
        enum: ['local', 's3', 'local_temp', 'deleted'], 
        default: 'local_temp' 
      }
    },
    
    processed: {
      path: String, // Path to compressed video file or S3 key
      size: Number, // Compressed file size
      format: { type: String, default: 'mp4' },
      codec: { type: String, default: 'h264' },
      resolution: {
        width: { type: Number, default: 1920 },
        height: { type: Number, default: 1080 }
      },
      skippedCompression: { type: Boolean, default: false }, // Track if compression was skipped
      compressionRatio: Number, // Percentage of size reduction (0 if skipped)
      storageType: { 
        type: String, 
        enum: ['local', 's3', 'local_temp', 'deleted'], 
        default: 'local' 
      },
      s3Location: String, // Full S3 URL for the file
      uploadedAt: Date // When uploaded to S3
    },

    audio: {
      path: String, // Path to extracted audio file
      size: Number, // Audio file size in bytes
      duration: Number, // Audio duration in seconds
      format: String, // Audio format (wav, mp3, etc.)
      extractedAt: Date // When audio was extracted
    }
  },

  // Pending video compression result (stored temporarily until AI analysis is complete)
  pendingVideoResult: {
    outputPath: String,
    compressedSize: Number,
    compressionRatio: Number,
    duration: Number,
    format: String,
    codec: String,
    completedAt: Date
  },

  // Transcription data
  transcript: {
    text: String, // Full transcript text
    segments: [transcriptSegmentSchema], // Timed segments
    language: {
      type: String,
      default: 'en' // Auto-detected or specified language, default to 'en' for MongoDB compatibility
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1 // Whisper confidence score
    }
  },

  // AI-generated content with weights
  tags: [{
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: [50, 'Tag cannot exceed 50 characters']
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.5
    }
  }],

  // Embedding vector for semantic similarity
  embedding: {
    type: [Number], // Float32Array stored as array of numbers
    validate: {
      validator: function(v) {
        return !v || v.length === 0 || v.length === 1536; // Allow empty array or OpenAI ada-002 embedding size
      },
      message: 'Embedding must be empty or have exactly 1536 dimensions'
    },
    default: [] // Default to empty array
  },

  // Track how the embedding was generated
  embeddingMetadata: {
    method: {
      type: String,
      enum: ['transcript', 'title-tags', null],
      default: null
    },
    generatedAt: Date,
    model: {
      type: String,
      default: 'text-embedding-ada-002'
    }
  },

  todoList: [todoItemSchema],

  // Processing status
  status: {
    type: String,
    enum: [
      'uploading',
      'uploaded', 
      'processing_media',  // Konsolidiert Audio-Extraktion und Video-Komprimierung
      'transcribing',
      'analyzing',
      'finalizing',
      'completed',
      'failed'
    ],
    default: 'uploading'
  },
  
  // Detail-Status für genauere Informationen
  processingDetails: {
    type: String,
    enum: [
      'extracting_audio',
      'video_compressing',
      'generating_tags',
      'generating_todos', 
      'generating_title',
      'generating_embeddings',
      'uploading_to_s3',
      'cleaning_local_files',
      null
    ],
    default: null
  },

  progress: {
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentStep: String,
    stepDetails: String,
    estimatedTimeRemaining: Number // in seconds
  },

  // Job tracking
  jobs: {
    videoProcessing: String, // BullMQ job ID
    audioExtraction: String,
    transcription: [String], // Array of job IDs for segments
    aiAnalysis: {
      tags: String,
      todo: String,
      title: String,
      embedding: String // Job ID for embedding generation
    }
  },

  // Error handling
  processingErrors: [{
    step: {
      type: String,
      enum: ['upload', 'pipeline_start', 'video_processing', 'video_compression_validation', 'audio_extraction', 'transcription', 'ai_analysis', 's3_upload', 'local_cleanup', 'cleanup', 'pipeline_progression']
    },
    message: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Transcript segments (temporary storage before merging)
  transcriptSegments: [{
    segmentIndex: Number,
    startTime: Number,
    text: String,
    confidence: Number,
    segments: mongoose.Schema.Types.Mixed
  }],

  // Sharing
  shareId: {
    type: String,
    unique: true,
    sparse: true // Allow null but ensure uniqueness when present
  },

  sharing: {
    enabled: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastViewedAt: Date
  },

  // Metadata
  metadata: {
    uploadedFrom: {
      userAgent: String,
      ipAddress: String
    },
    
    processingTime: {
      videoProcessing: Number, // seconds
      audioExtraction: Number,
      transcription: Number,
      aiAnalysis: Number,
      total: Number
    },
    
    fileHashes: {
      original: String, // SHA-256 hash of original file
      processed: String // SHA-256 hash of processed file
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  completedAt: Date,

  // Soft delete
  deletedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      
      // Don't expose internal job IDs and file paths in API responses
      if (ret.jobs) {
        delete ret.jobs;
      }
      
      // Only show file paths for authorized requests
      if (ret.files && ret.files.processed && ret.files.processed.path) {
        ret.files.processed.url = `/api/v1/processes/${ret.id}/video`; // Virtual URL
        delete ret.files.processed.path;
      }
      
      return ret;
    }
  }
});

// Indexes for performance
processSchema.index({ tenantId: 1, userId: 1 });
processSchema.index({ tenantId: 1, status: 1 });
processSchema.index({ tenantId: 1, createdAt: -1 });
processSchema.index({ tenantId: 1, 'tags.name': 1 });
processSchema.index({ shareId: 1 });
processSchema.index({ tenantId: 1, isDeleted: 1 });

// Text index for search functionality
processSchema.index({
  title: 'text',
  'transcript.text': 'text'
}, {
  weights: {
    title: 10,
    'transcript.text': 1
  }
});

// Separate compound index for tag search with weight
processSchema.index({ 'tags.name': 1, 'tags.weight': -1 });

// Pre-save middleware
processSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate share ID if sharing is enabled and no ID exists
  if (this.sharing.enabled && !this.shareId) {
    this.shareId = uuidv4();
  }
  
  // Calculate total processing time if all steps are completed
  if (this.status === 'completed' && this.metadata.processingTime) {
    const times = this.metadata.processingTime;
    times.total = (times.videoProcessing || 0) + 
                  (times.audioExtraction || 0) + 
                  (times.transcription || 0) + 
                  (times.aiAnalysis || 0);
  }
  
  next();
});

// Instance methods
processSchema.methods.updateProgress = function(percentage, step, details, estimatedTime) {
  this.progress = {
    percentage: Math.min(100, Math.max(0, percentage)),
    currentStep: step,
    stepDetails: details,
    estimatedTimeRemaining: estimatedTime
  };
  this.updatedAt = Date.now();
  return this.save();
};

processSchema.methods.addError = function(step, message, details) {
  this.processingErrors.push({
    step,
    message,
    details: details || {},
    timestamp: new Date()
  });
  return this.save();
};

processSchema.methods.enableSharing = function(expiresAt) {
  if (!this.shareId) {
    this.shareId = uuidv4();
  }
  
  this.sharing = {
    enabled: true,
    expiresAt: expiresAt || null,
    viewCount: this.sharing.viewCount || 0,
    lastViewedAt: this.sharing.lastViewedAt || null
  };
  
  return this.save();
};

processSchema.methods.disableSharing = function() {
  this.sharing.enabled = false;
  return this.save();
};

processSchema.methods.incrementViewCount = function() {
  this.sharing.viewCount = (this.sharing.viewCount || 0) + 1;
  this.sharing.lastViewedAt = new Date();
  return this.save();
};

processSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static methods
processSchema.statics.findByTenant = function(tenantId, options = {}) {
  const query = { 
    tenantId, 
    isDeleted: false 
  };
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.tags && options.tags.length > 0) {
    query['tags.name'] = { $in: options.tags };
  }
  
  // Add search functionality for tags and title
  if (options.search) {
    query.$or = [
      { 'tags.name': { $regex: options.search, $options: 'i' } },
      { title: { $regex: options.search, $options: 'i' } }
    ];
  }
  
  let dbQuery = this.find(query);
  
  if (options.populate) {
    dbQuery = dbQuery.populate('userId', 'firstName lastName email');
  }
  
  if (options.sort) {
    dbQuery = dbQuery.sort(options.sort);
  } else {
    dbQuery = dbQuery.sort({ createdAt: -1 });
  }
  
  if (options.limit) {
    dbQuery = dbQuery.limit(options.limit);
  }
  
  if (options.skip) {
    dbQuery = dbQuery.skip(options.skip);
  }
  
  return dbQuery;
};

processSchema.statics.findByShareId = function(shareId) {
  return this.findOne({ 
    shareId, 
    'sharing.enabled': true,
    isDeleted: false,
    $or: [
      { 'sharing.expiresAt': { $gt: new Date() } },
      { 'sharing.expiresAt': null }
    ]
  });
};

processSchema.statics.searchByText = function(tenantId, searchText, options = {}) {
  // Search in text fields and tags separately, then combine results
  const textQuery = {
    tenantId,
    isDeleted: false,
    $text: { $search: searchText }
  };
  
  const tagQuery = {
    tenantId,
    isDeleted: false,
    'tags.name': { $regex: searchText, $options: 'i' }
  };
  
  // Use $or to combine both queries
  const combinedQuery = {
    tenantId,
    isDeleted: false,
    $or: [
      { $text: { $search: searchText } },
      { 'tags.name': { $regex: searchText, $options: 'i' } }
    ]
  };
  
  return this.find(combinedQuery)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

processSchema.statics.getUniqueTagsForTenant = function(tenantId) {
  return this.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isDeleted: false } },
    { $unwind: '$tags' },
    { $group: { 
      _id: '$tags.name', 
      count: { $sum: 1 },
      avgWeight: { $avg: '$tags.weight' }
    }},
    { $sort: { count: -1, _id: 1 } },
    { $project: { 
      tag: '$_id', 
      count: 1, 
      avgWeight: 1,
      _id: 0 
    }}
  ]);
};

processSchema.statics.getProcessingStats = function(tenantId, startDate, endDate) {
  const matchQuery = { 
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false
  };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalProcesses: { $sum: 1 },
        completedProcesses: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedProcesses: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        averageProcessingTime: {
          $avg: '$metadata.processingTime.total'
        },
        totalStorageUsed: {
          $sum: '$files.processed.size'
        }
      }
    }
  ]);
};

// Calculate cosine similarity between two embedding vectors
processSchema.statics.calculateSimilarity = function(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    console.log('Similarity calculation failed - embedding check:', {
      embedding1Exists: !!embedding1,
      embedding2Exists: !!embedding2,
      embedding1Length: embedding1?.length,
      embedding2Length: embedding2?.length
    });
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // Debug: Check first few values
  const debugSample = 5;
  const sample1 = embedding1.slice(0, debugSample);
  const sample2 = embedding2.slice(0, debugSample);
  
  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i];
    const val2 = embedding2[i];
    
    // Type check
    if (typeof val1 !== 'number' || typeof val2 !== 'number') {
      console.log(`Non-numeric value at index ${i}:`, { val1, val2, type1: typeof val1, type2: typeof val2 });
      continue;
    }
    
    dotProduct += val1 * val2;
    norm1 += val1 * val1;
    norm2 += val2 * val2;
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  // Debug logging for first calculation
  if (this._debugFirstCalculation !== false) {
    console.log('Cosine similarity calculation details:', {
      sample1,
      sample2,
      dotProduct,
      norm1,
      norm2,
      similarity: norm1 === 0 || norm2 === 0 ? 0 : dotProduct / (norm1 * norm2)
    });
    this._debugFirstCalculation = false; // Only log once
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (norm1 * norm2);
};

// Find similar processes based on embeddings
processSchema.statics.findSimilarProcesses = async function(processId, tenantId, options = {}) {
  const limit = options.limit || 10;
  const threshold = options.threshold || 0.7;
  
  // Get the source process with embedding
  const sourceProcess = await this.findOne({ 
    _id: processId, 
    tenantId,
    isDeleted: false 
  }).select('embedding title tags');
  
  if (!sourceProcess || !sourceProcess.embedding) {
    return [];
  }
  
  // Get all other processes with embeddings
  const processes = await this.find({
    tenantId,
    _id: { $ne: processId },
    embedding: { $exists: true, $ne: [] },
    isDeleted: false
  }).select('embedding title tags createdAt status');
  
  // Calculate similarities
  const similarities = processes
    .map(process => ({
      process,
      similarity: this.calculateSimilarity(sourceProcess.embedding, process.embedding)
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return similarities;
};

module.exports = mongoose.model('Process', processSchema);