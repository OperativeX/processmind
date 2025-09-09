const mongoose = require('mongoose');

/**
 * TenantStatistics Model
 * Stores daily/monthly statistics for detailed analytics
 */
const tenantStatisticsSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  type: {
    type: String,
    enum: ['daily', 'monthly'],
    required: true
  },

  metrics: {
    // Process metrics
    newProcesses: {
      type: Number,
      default: 0,
      min: 0
    },
    totalProcesses: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // User metrics
    activeUsers: {
      type: Number,
      default: 0,
      min: 0
    },
    newUsers: {
      type: Number,
      default: 0,
      min: 0
    },
    totalUsers: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Storage metrics
    storageUsedMB: {
      type: Number,
      default: 0,
      min: 0
    },
    newStorageMB: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // API usage metrics
    apiCalls: {
      type: Number,
      default: 0,
      min: 0
    },
    transcriptionMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    aiTokensUsed: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Cost metrics
    estimatedCost: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Performance metrics
    averageProcessingTime: {
      type: Number, // in seconds
      default: 0,
      min: 0
    },
    failedProcesses: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Calculated metrics
  summary: {
    growthRate: Number, // Percentage growth from previous period
    retentionRate: Number, // User retention rate
    successRate: Number // Process success rate
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
tenantStatisticsSchema.index({ tenantId: 1, date: -1, type: 1 }, { unique: true });
tenantStatisticsSchema.index({ tenantId: 1, type: 1, date: -1 });
tenantStatisticsSchema.index({ date: -1 });

// Static methods
tenantStatisticsSchema.statics.recordDailyStats = async function(tenantId, metrics) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await this.findOneAndUpdate(
    {
      tenantId,
      date: today,
      type: 'daily'
    },
    {
      $set: { metrics },
      $inc: { 'metrics.newProcesses': metrics.newProcesses || 0 }
    },
    {
      upsert: true,
      new: true
    }
  );
};

tenantStatisticsSchema.statics.getStatsByDateRange = async function(tenantId, startDate, endDate) {
  return await this.find({
    tenantId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

tenantStatisticsSchema.statics.getGrowthMetrics = async function(tenantId, period = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  const stats = await this.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        type: 'daily',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalNewProcesses: { $sum: '$metrics.newProcesses' },
        totalNewUsers: { $sum: '$metrics.newUsers' },
        avgActiveUsers: { $avg: '$metrics.activeUsers' },
        totalApiCalls: { $sum: '$metrics.apiCalls' },
        totalCost: { $sum: '$metrics.estimatedCost' }
      }
    }
  ]);
  
  return stats[0] || {
    totalNewProcesses: 0,
    totalNewUsers: 0,
    avgActiveUsers: 0,
    totalApiCalls: 0,
    totalCost: 0
  };
};

tenantStatisticsSchema.statics.aggregateMonthlyStats = async function() {
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  
  const lastDayOfMonth = new Date(firstDayOfMonth);
  lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
  lastDayOfMonth.setDate(0);
  
  const dailyStats = await this.aggregate([
    {
      $match: {
        type: 'daily',
        date: {
          $gte: firstDayOfMonth,
          $lte: lastDayOfMonth
        }
      }
    },
    {
      $group: {
        _id: '$tenantId',
        metrics: {
          $push: '$metrics'
        }
      }
    }
  ]);
  
  // Process and save monthly aggregates
  for (const tenantStats of dailyStats) {
    const monthlyMetrics = {
      newProcesses: 0,
      newUsers: 0,
      totalApiCalls: 0,
      totalCost: 0,
      averageActiveUsers: 0
    };
    
    tenantStats.metrics.forEach(daily => {
      monthlyMetrics.newProcesses += daily.newProcesses || 0;
      monthlyMetrics.newUsers += daily.newUsers || 0;
      monthlyMetrics.totalApiCalls += daily.apiCalls || 0;
      monthlyMetrics.totalCost += daily.estimatedCost || 0;
      monthlyMetrics.averageActiveUsers += daily.activeUsers || 0;
    });
    
    monthlyMetrics.averageActiveUsers /= tenantStats.metrics.length;
    
    await this.findOneAndUpdate(
      {
        tenantId: tenantStats._id,
        date: firstDayOfMonth,
        type: 'monthly'
      },
      {
        $set: { metrics: monthlyMetrics }
      },
      {
        upsert: true
      }
    );
  }
};

module.exports = mongoose.model('TenantStatistics', tenantStatisticsSchema);