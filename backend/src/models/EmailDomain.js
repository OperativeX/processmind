const mongoose = require('mongoose');

const emailDomainSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validate domain format (e.g., example.com)
        return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(v);
      },
      message: 'Please provide a valid domain name'
    }
  },

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  tenantName: {
    type: String,
    required: true,
    trim: true
  },

  isPublicDomain: {
    type: Boolean,
    default: false
  },

  isPrimary: {
    type: Boolean,
    default: false
  },

  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },

  verificationToken: String,
  verificationDate: Date,

  // For public domains (gmail.com, yahoo.com), store specific mappings
  userMappings: [{
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Statistics for optimization
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    lastAccessed: Date,
    accessCount: {
      type: Number,
      default: 0
    }
  },

  settings: {
    allowAutoRegistration: {
      type: Boolean,
      default: false
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    allowedEmailPatterns: [String], // e.g., ["*@company.com", "contractor-*@company.com"]
    blockedEmailPatterns: [String]
  },

  isActive: {
    type: Boolean,
    default: true
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
      delete ret.verificationToken;
      return ret;
    }
  }
});

// Indexes for performance
emailDomainSchema.index({ domain: 1, isActive: 1 });
emailDomainSchema.index({ tenantId: 1, isPrimary: 1 });
emailDomainSchema.index({ 'userMappings.email': 1 });
emailDomainSchema.index({ 'stats.accessCount': -1, 'stats.lastAccessed': -1 });

// Pre-save middleware
emailDomainSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
emailDomainSchema.methods.incrementAccessCount = function() {
  this.stats.accessCount += 1;
  this.stats.lastAccessed = new Date();
  return this.save();
};

emailDomainSchema.methods.addUserMapping = function(email, userId) {
  // Check if mapping already exists
  const exists = this.userMappings.some(mapping => 
    mapping.email === email.toLowerCase()
  );
  
  if (!exists) {
    this.userMappings.push({ email: email.toLowerCase(), userId });
    this.stats.totalUsers += 1;
  }
  
  return this.save();
};

emailDomainSchema.methods.removeUserMapping = function(email) {
  const initialLength = this.userMappings.length;
  this.userMappings = this.userMappings.filter(mapping => 
    mapping.email !== email.toLowerCase()
  );
  
  if (this.userMappings.length < initialLength) {
    this.stats.totalUsers = Math.max(0, this.stats.totalUsers - 1);
  }
  
  return this.save();
};

emailDomainSchema.methods.isEmailAllowed = function(email) {
  const emailLower = email.toLowerCase();
  
  // Check blocked patterns first
  if (this.settings.blockedEmailPatterns && this.settings.blockedEmailPatterns.length > 0) {
    for (const pattern of this.settings.blockedEmailPatterns) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(emailLower)) {
        return false;
      }
    }
  }
  
  // Check allowed patterns
  if (this.settings.allowedEmailPatterns && this.settings.allowedEmailPatterns.length > 0) {
    for (const pattern of this.settings.allowedEmailPatterns) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(emailLower)) {
        return true;
      }
    }
    return false; // If allowed patterns exist, email must match one
  }
  
  return true; // No patterns defined, allow all
};

// Static methods
emailDomainSchema.statics.findByDomain = function(domain) {
  return this.findOne({ 
    domain: domain.toLowerCase(), 
    isActive: true 
  }).populate('tenantId', 'name subscription.status');
};

emailDomainSchema.statics.findByTenant = function(tenantId) {
  return this.find({ 
    tenantId, 
    isActive: true 
  }).sort({ isPrimary: -1, domain: 1 });
};

emailDomainSchema.statics.findPublicDomains = function() {
  return this.find({ 
    isPublicDomain: true, 
    isActive: true 
  });
};

emailDomainSchema.statics.findByEmail = async function(email) {
  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1];
  
  if (!domain) return null;
  
  // First, check if it's a specific user mapping in a public domain
  const publicDomainMapping = await this.findOne({
    isPublicDomain: true,
    'userMappings.email': emailLower,
    isActive: true
  }).populate('tenantId', 'name subscription.status');
  
  if (publicDomainMapping) {
    return publicDomainMapping;
  }
  
  // Then, check for regular domain mapping
  return this.findByDomain(domain);
};

emailDomainSchema.statics.getMostAccessedDomains = function(limit = 100) {
  return this.find({ isActive: true })
    .sort({ 'stats.accessCount': -1, 'stats.lastAccessed': -1 })
    .limit(limit)
    .select('domain tenantName stats');
};

// Initialize public domains
emailDomainSchema.statics.initializePublicDomains = async function() {
  const publicDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'yandex.com',
    'zoho.com'
  ];
  
  for (const domain of publicDomains) {
    await this.findOneAndUpdate(
      { domain },
      { 
        $setOnInsert: {
          domain,
          isPublicDomain: true,
          tenantId: null,
          tenantName: 'Public Domain',
          verificationStatus: 'verified',
          settings: {
            allowAutoRegistration: false,
            requireEmailVerification: true
          }
        }
      },
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('EmailDomain', emailDomainSchema);