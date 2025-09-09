const mongoose = require('mongoose');

const userUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },

  storage: {
    usedMB: {
      type: Number,
      default: 0,
      min: 0
    },
    videosMB: {
      type: Number,
      default: 0,
      min: 0
    },
    audioMB: {
      type: Number,
      default: 0,
      min: 0
    },
    otherMB: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  processes: {
    totalCount: {
      type: Number,
      default: 0,
      min: 0
    },
    completedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    failedCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Monthly breakdown for detailed analytics
  monthlyStats: [{
    month: {
      type: Date,
      required: true
    },
    uploads: {
      type: Number,
      default: 0,
      min: 0
    },
    storageMB: {
      type: Number,
      default: 0,
      min: 0
    },
    processingMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    apiCalls: {
      whisper: { type: Number, default: 0 },
      gpt: { type: Number, default: 0 }
    }
  }],

  // Real-time activity tracking
  lastActivity: {
    uploadedAt: Date,
    processCompletedAt: Date,
    lastLoginAt: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient queries
userUsageSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
userUsageSchema.index({ tenantId: 1, 'storage.usedMB': -1 });
userUsageSchema.index({ 'monthlyStats.month': 1 });
userUsageSchema.index({ updatedAt: -1 });

// Static methods
userUsageSchema.statics.findOrCreateByUser = async function(userId, tenantId) {
  let usage = await this.findOne({ userId, tenantId });
  
  if (!usage) {
    usage = new this({ 
      userId,
      tenantId,
      storage: { usedMB: 0, videosMB: 0, audioMB: 0, otherMB: 0 },
      processes: { totalCount: 0, completedCount: 0, failedCount: 0 }
    });
    await usage.save();
  }
  
  return usage;
};

userUsageSchema.statics.getTopUsersByTenant = function(tenantId, limit = 10) {
  return this.find({ tenantId })
    .sort({ 'storage.usedMB': -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email accountType');
};

userUsageSchema.statics.getMonthlyUsageStats = function(tenantId, startDate, endDate) {
  return this.aggregate([
    {
      $match: { tenantId: mongoose.Types.ObjectId(tenantId) }
    },
    {
      $unwind: '$monthlyStats'
    },
    {
      $match: {
        'monthlyStats.month': {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$monthlyStats.month',
        totalUploads: { $sum: '$monthlyStats.uploads' },
        totalStorageMB: { $sum: '$monthlyStats.storageMB' },
        totalProcessingMinutes: { $sum: '$monthlyStats.processingMinutes' },
        uniqueUsers: { $addToSet: '$userId' },
        whisperCalls: { $sum: '$monthlyStats.apiCalls.whisper' },
        gptCalls: { $sum: '$monthlyStats.apiCalls.gpt' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Instance methods
userUsageSchema.methods.addStorageUsage = function(sizeMB, fileType = 'other') {
  this.storage.usedMB += sizeMB;
  
  switch (fileType) {
    case 'video':
      this.storage.videosMB += sizeMB;
      break;
    case 'audio':
      this.storage.audioMB += sizeMB;
      break;
    default:
      this.storage.otherMB += sizeMB;
  }
  
  this.updatedAt = new Date();
  return this.save();
};

userUsageSchema.methods.removeStorageUsage = function(sizeMB, fileType = 'other') {
  this.storage.usedMB = Math.max(0, this.storage.usedMB - sizeMB);
  
  switch (fileType) {
    case 'video':
      this.storage.videosMB = Math.max(0, this.storage.videosMB - sizeMB);
      break;
    case 'audio':
      this.storage.audioMB = Math.max(0, this.storage.audioMB - sizeMB);
      break;
    default:
      this.storage.otherMB = Math.max(0, this.storage.otherMB - sizeMB);
  }
  
  this.updatedAt = new Date();
  return this.save();
};

userUsageSchema.methods.incrementProcessCount = function() {
  this.processes.totalCount += 1;
  this.lastActivity.uploadedAt = new Date();
  this.updatedAt = new Date();
  
  return this.save();
};

userUsageSchema.methods.markProcessCompleted = function() {
  this.processes.completedCount += 1;
  this.lastActivity.processCompletedAt = new Date();
  this.updatedAt = new Date();
  
  return this.save();
};

userUsageSchema.methods.markProcessFailed = function() {
  this.processes.failedCount += 1;
  this.updatedAt = new Date();
  
  return this.save();
};

userUsageSchema.methods.addMonthlyActivity = function(month, activityData = {}) {
  const monthKey = new Date(month.getFullYear(), month.getMonth(), 1);
  
  // Find existing monthly stats
  let monthStats = this.monthlyStats.find(stat => 
    stat.month.getTime() === monthKey.getTime()
  );
  
  if (!monthStats) {
    monthStats = {
      month: monthKey,
      uploads: 0,
      storageMB: 0,
      processingMinutes: 0,
      apiCalls: { whisper: 0, gpt: 0 }
    };
    this.monthlyStats.push(monthStats);
  }
  
  // Update activity data
  if (activityData.uploads) monthStats.uploads += activityData.uploads;
  if (activityData.storageMB) monthStats.storageMB += activityData.storageMB;
  if (activityData.processingMinutes) monthStats.processingMinutes += activityData.processingMinutes;
  if (activityData.whisperCalls) monthStats.apiCalls.whisper += activityData.whisperCalls;
  if (activityData.gptCalls) monthStats.apiCalls.gpt += activityData.gptCalls;
  
  this.updatedAt = new Date();
  return this.save();
};

userUsageSchema.methods.getCurrentMonthStats = function() {
  const currentMonth = new Date();
  const monthKey = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  
  return this.monthlyStats.find(stat => 
    stat.month.getTime() === monthKey.getTime()
  ) || {
    month: monthKey,
    uploads: 0,
    storageMB: 0,
    processingMinutes: 0,
    apiCalls: { whisper: 0, gpt: 0 }
  };
};

module.exports = mongoose.model('UserUsage', userUsageSchema);