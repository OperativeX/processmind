const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },

  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },

  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  // Pricing fields
  plan_type: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  
  accountType: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },

  role: {
    type: String,
    enum: ['owner', 'admin', 'user'],
    default: 'user'
  },

  // System-wide role (only for platform administrators)
  systemRole: {
    type: String,
    enum: ['super_admin', 'user'],
    default: 'user'
  },

  avatar: {
    type: String, // URL to avatar image
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
      },
      message: 'Avatar must be a valid image URL'
    }
  },

  // Enhanced usage tracking
  usage: {
    processesThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    storageUsedMB: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },

  // New pricing fields
  license_count: {
    type: Number,
    default: 1,
    min: 1
  },
  
  monthly_uploads_used: {
    type: Number,
    default: 0,
    min: 0
  },
  
  uploads_reset_date: {
    type: Date,
    default: Date.now
  },
  
  stripe_customer_id: String,
  stripe_subscription_id: String,
  
  // Usage alerts tracking
  usage_alerts_sent: {
    upload_80_percent: {
      type: Boolean,
      default: false
    },
    storage_80_percent: {
      type: Boolean,
      default: false
    },
    last_alert_date: Date
  },

  preferences: {
    theme: {
      type: String,
      enum: ['dark', 'light', 'auto'],
      default: 'dark'
    },
    
    language: {
      type: String,
      enum: ['en', 'de', 'fr', 'es'],
      default: 'en'
    },
    
    notifications: {
      email: {
        processCompleted: { type: Boolean, default: true },
        processFailed: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: false }
      },
      
      browser: {
        processCompleted: { type: Boolean, default: true },
        processFailed: { type: Boolean, default: true }
      }
    },
    
    dashboard: {
      defaultView: {
        type: String,
        enum: ['list', 'grid', 'graph'],
        default: 'list'
      },
      
      processesPerPage: {
        type: Number,
        default: 20,
        min: 5,
        max: 100
      }
    },

    favoritesList: {
      defaultView: {
        type: String,
        enum: ['grid', 'list'],
        default: 'grid'
      },
      showSharedLists: {
        type: Boolean,
        default: true
      },
      autoAddToDefaultList: {
        type: Boolean,
        default: false
      }
    }
  },

  lastLogin: Date,

  loginAttempts: {
    type: Number,
    default: 0,
    max: 5
  },

  lockUntil: Date,

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: String,

  passwordResetToken: String,
  passwordResetExpires: Date,

  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '7d' // Auto-expire after 7 days
    },
    lastUsed: Date,
    userAgent: String,
    ipAddress: String
  }],

  isActive: {
    type: Boolean,
    default: true
  },
  
  deactivatedAt: Date,
  
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  deactivationReason: {
    type: String,
    enum: ['manual_removal', 'tenant_downgraded_to_free', 'account_suspended', 'other'],
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
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  }
});

// Compound indexes for performance
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it's been modified
  if (!this.isModified('password')) {
    this.updatedAt = Date.now();
    return next();
  }

  // Skip hashing if explicitly requested (for pre-hashed passwords)
  if (this.$skipPasswordHash) {
    this.updatedAt = Date.now();
    return next();
  }

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function() {
  // Handle both ObjectId and populated objects
  const tenantIdValue = this.tenantId._id || this.tenantId;
  
  return jwt.sign(
    {
      userId: this._id,
      tenantId: tenantIdValue.toString(),
      email: this.email,
      role: this.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    }
  );
};

userSchema.methods.generateRefreshToken = function() {
  // Handle both ObjectId and populated objects
  const tenantIdValue = this.tenantId._id || this.tenantId;
  
  return jwt.sign(
    {
      userId: this._id,
      tenantId: tenantIdValue.toString(),
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

userSchema.methods.addRefreshToken = function(token, userAgent, ipAddress) {
  // Remove old tokens (keep only last 5)
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.sort((a, b) => b.createdAt - a.createdAt);
    this.refreshTokens = this.refreshTokens.slice(0, 4);
  }

  this.refreshTokens.push({
    token,
    userAgent,
    ipAddress,
    lastUsed: new Date()
  });

  return this.save();
};

userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

userSchema.methods.removeAllRefreshTokens = function() {
  this.refreshTokens = [];
  return this.save();
};

userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we're at max attempts and not already locked, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // Lock for 2 hours
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Enhanced usage tracking with smart alerts
userSchema.methods.canCreateProcess = function() {
  if (this.accountType === 'pro' || this.plan_type === 'pro') return true;
  
  // Check monthly limit for free accounts
  const currentMonth = new Date().getMonth();
  const resetMonth = new Date(this.uploads_reset_date || this.usage.lastResetDate).getMonth();
  
  // Reset usage if it's a new month
  if (currentMonth !== resetMonth) {
    this.monthly_uploads_used = 0;
    this.usage.processesThisMonth = 0;
    this.uploads_reset_date = new Date();
    this.usage.lastResetDate = new Date();
    // Reset alerts for new month
    this.usage_alerts_sent.upload_80_percent = false;
    this.usage_alerts_sent.storage_80_percent = false;
  }
  
  const uploadsUsed = this.monthly_uploads_used || this.usage.processesThisMonth || 0;
  return uploadsUsed < 10; // Free limit: 10 processes/month
};

// Get current upload usage percentage
userSchema.methods.getUploadUsagePercentage = function() {
  if (this.accountType === 'pro' || this.plan_type === 'pro') return 0;
  
  const uploadsUsed = this.monthly_uploads_used || this.usage.processesThisMonth || 0;
  return Math.round((uploadsUsed / 10) * 100);
};

// Check if user should receive usage alert
userSchema.methods.shouldReceiveUploadAlert = function() {
  if (this.accountType === 'pro' || this.plan_type === 'pro') return false;
  
  const percentage = this.getUploadUsagePercentage();
  if (percentage >= 80 && !this.usage_alerts_sent.upload_80_percent) {
    return true;
  }
  return false;
};

// Mark alert as sent
userSchema.methods.markAlertSent = function(alertType) {
  if (alertType === 'upload') {
    this.usage_alerts_sent.upload_80_percent = true;
  } else if (alertType === 'storage') {
    this.usage_alerts_sent.storage_80_percent = true;
  }
  this.usage_alerts_sent.last_alert_date = new Date();
  return this.save();
};

userSchema.methods.canUploadSize = function(fileSizeMB) {
  if (this.accountType === 'pro') return true;
  
  // Check storage limit for free accounts (20GB = 20,480 MB)
  return (this.usage.storageUsedMB + fileSizeMB) <= 20480;
};

userSchema.methods.incrementProcessUsage = function() {
  if (this.accountType === 'free' || this.plan_type === 'free') {
    this.usage.processesThisMonth += 1;
    this.monthly_uploads_used = (this.monthly_uploads_used || 0) + 1;
    
    // Check if we should trigger an alert
    if (this.shouldReceiveUploadAlert()) {
      // This will be handled by the upload middleware
      this._needsUploadAlert = true;
    }
    
    return this.save();
  }
  return Promise.resolve();
};

userSchema.methods.addStorageUsage = function(sizeMB) {
  if (this.accountType === 'free') {
    this.usage.storageUsedMB += sizeMB;
    return this.save();
  }
  return Promise.resolve();
};

userSchema.methods.removeStorageUsage = function(sizeMB) {
  if (this.accountType === 'free') {
    this.usage.storageUsedMB = Math.max(0, this.usage.storageUsedMB - sizeMB);
    return this.save();
  }
  return Promise.resolve();
};

// New S3-based storage tracking methods
userSchema.methods.getDetailedStorageUsage = async function() {
  try {
    const storageTrackingService = require('../services/storageTrackingService');
    const detailedUsage = await storageTrackingService.getUserUsageReport(
      this._id.toString(), 
      this.tenantId.toString()
    );
    
    return detailedUsage || {
      storage: { usedMB: this.usage.storageUsedMB, totalGB: this.usage.storageUsedMB / 1024 },
      processes: { totalCount: 0, completedCount: 0, failedCount: 0 },
      currentMonth: { uploads: this.usage.processesThisMonth }
    };
  } catch (error) {
    // Fallback to legacy data if tracking service fails
    return {
      storage: { usedMB: this.usage.storageUsedMB, totalGB: this.usage.storageUsedMB / 1024 },
      processes: { totalCount: 0, completedCount: 0, failedCount: 0 },
      currentMonth: { uploads: this.usage.processesThisMonth }
    };
  }
};

userSchema.methods.syncStorageWithS3 = async function() {
  try {
    const storageTrackingService = require('../services/storageTrackingService');
    // This will sync tenant storage, which includes this user's files
    await storageTrackingService.syncTenantStorageWithS3(this.tenantId.toString());
    return true;
  } catch (error) {
    logger.error('Failed to sync user storage with S3', {
      userId: this._id,
      tenantId: this.tenantId,
      error: error.message
    });
    return false;
  }
};

userSchema.methods.upgradeToProAccount = function() {
  this.accountType = 'pro';
  this.plan_type = 'pro';
  // Reset usage tracking as it's no longer needed
  this.usage.processesThisMonth = 0;
  this.usage.storageUsedMB = 0;
  this.monthly_uploads_used = 0;
  return this.save();
};

userSchema.methods.downgradeToFreeAccount = function() {
  this.accountType = 'free';
  this.plan_type = 'free';
  // Reset monthly uploads to 10 for immediate use
  this.monthly_uploads_used = 0;
  this.uploads_reset_date = new Date();
  // Reset usage alerts
  this.usage_alerts_sent.upload_80_percent = false;
  this.usage_alerts_sent.storage_80_percent = false;
  return this.save();
};

// Static methods
userSchema.statics.findByEmail = function(email, tenantId) {
  return this.findOne({ 
    email: email.toLowerCase(), 
    tenantId,
    isActive: true 
  }).select('+password');
};

userSchema.statics.findByTenant = function(tenantId, options = {}) {
  const query = { tenantId, isActive: true };
  
  if (options.role) {
    query.role = options.role;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 0)
    .skip(options.skip || 0);
};

module.exports = mongoose.model('User', userSchema);