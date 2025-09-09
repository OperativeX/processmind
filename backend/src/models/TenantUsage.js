const mongoose = require('mongoose');

const tenantUsageSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true
  },

  storage: {
    totalMB: {
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

  files: {
    totalCount: {
      type: Number,
      default: 0,
      min: 0
    },
    videosCount: {
      type: Number,
      default: 0,
      min: 0
    },
    audioCount: {
      type: Number,
      default: 0,
      min: 0
    },
    processesCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Monthly breakdown for billing and analytics
  monthlyStats: [{
    month: {
      type: Date,
      required: true
    },
    storage: {
      startOfMonthMB: { type: Number, default: 0 },
      endOfMonthMB: { type: Number, default: 0 },
      peakUsageMB: { type: Number, default: 0 },
      averageUsageMB: { type: Number, default: 0 }
    },
    activity: {
      processesCreated: { type: Number, default: 0 },
      filesUploaded: { type: Number, default: 0 },
      filesDeleted: { type: Number, default: 0 },
      storageAdded: { type: Number, default: 0 },
      storageRemoved: { type: Number, default: 0 }
    }
  }],

  // Cost estimation (based on current usage)
  estimatedCosts: {
    storageEUR: {
      type: Number,
      default: 0
    },
    transferEUR: {
      type: Number,
      default: 0
    },
    lastCalculated: Date
  },

  lastSyncWithS3: {
    type: Date,
    default: null
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

// Indexes
tenantUsageSchema.index({ tenantId: 1 }, { unique: true });
tenantUsageSchema.index({ 'monthlyStats.month': 1 });
tenantUsageSchema.index({ updatedAt: -1 });

// Static methods
tenantUsageSchema.statics.findOrCreateByTenant = async function(tenantId) {
  let usage = await this.findOne({ tenantId });
  
  if (!usage) {
    usage = new this({ 
      tenantId,
      storage: { totalMB: 0, videosMB: 0, audioMB: 0, otherMB: 0 },
      files: { totalCount: 0, videosCount: 0, audioCount: 0, processesCount: 0 }
    });
    await usage.save();
  }
  
  return usage;
};

tenantUsageSchema.statics.getTopConsumers = function(limit = 10) {
  return this.find({})
    .sort({ 'storage.totalMB': -1 })
    .limit(limit)
    .populate('tenantId', 'name domain');
};

// Instance methods
tenantUsageSchema.methods.addStorage = function(sizeMB, fileType = 'other') {
  this.storage.totalMB += sizeMB;
  
  switch (fileType) {
    case 'video':
      this.storage.videosMB += sizeMB;
      this.files.videosCount += 1;
      break;
    case 'audio':
      this.storage.audioMB += sizeMB;
      this.files.audioCount += 1;
      break;
    default:
      this.storage.otherMB += sizeMB;
  }
  
  this.files.totalCount += 1;
  this.updatedAt = new Date();
  
  return this.save();
};

tenantUsageSchema.methods.removeStorage = function(sizeMB, fileType = 'other') {
  this.storage.totalMB = Math.max(0, this.storage.totalMB - sizeMB);
  
  switch (fileType) {
    case 'video':
      this.storage.videosMB = Math.max(0, this.storage.videosMB - sizeMB);
      this.files.videosCount = Math.max(0, this.files.videosCount - 1);
      break;
    case 'audio':
      this.storage.audioMB = Math.max(0, this.storage.audioMB - sizeMB);
      this.files.audioCount = Math.max(0, this.files.audioCount - 1);
      break;
    default:
      this.storage.otherMB = Math.max(0, this.storage.otherMB - sizeMB);
  }
  
  this.files.totalCount = Math.max(0, this.files.totalCount - 1);
  this.updatedAt = new Date();
  
  return this.save();
};

tenantUsageSchema.methods.addMonthlyStats = function(month, activityData) {
  const monthKey = new Date(month.getFullYear(), month.getMonth(), 1);
  
  // Find or create monthly stats entry
  let monthStats = this.monthlyStats.find(stat => 
    stat.month.getTime() === monthKey.getTime()
  );
  
  if (!monthStats) {
    monthStats = {
      month: monthKey,
      storage: {
        startOfMonthMB: this.storage.totalMB,
        endOfMonthMB: this.storage.totalMB,
        peakUsageMB: this.storage.totalMB,
        averageUsageMB: this.storage.totalMB
      },
      activity: {
        processesCreated: 0,
        filesUploaded: 0,
        filesDeleted: 0,
        storageAdded: 0,
        storageRemoved: 0
      }
    };
    this.monthlyStats.push(monthStats);
  }
  
  // Update activity data
  Object.assign(monthStats.activity, activityData);
  monthStats.storage.endOfMonthMB = this.storage.totalMB;
  monthStats.storage.peakUsageMB = Math.max(monthStats.storage.peakUsageMB, this.storage.totalMB);
  
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('TenantUsage', tenantUsageSchema);