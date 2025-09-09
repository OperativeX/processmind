const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    minlength: [2, 'Tenant name must be at least 2 characters long'],
    maxlength: [100, 'Tenant name cannot exceed 100 characters']
  },
  
  domain: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but ensure uniqueness when present
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        return /^[a-z0-9-]+$/.test(v); // Only lowercase letters, numbers, and hyphens
      },
      message: 'Domain can only contain lowercase letters, numbers, and hyphens'
    }
  },

  settings: {
    maxFileSize: {
      type: Number,
      default: 500 * 1024 * 1024, // 500MB default
      min: [10 * 1024 * 1024, 'Minimum file size is 10MB'],
      max: [2 * 1024 * 1024 * 1024, 'Maximum file size is 2GB']
    },
    
    maxProcessesPerMonth: {
      type: Number,
      default: 100,
      min: [1, 'Minimum 1 process per month']
    },
    
    allowedVideoFormats: [{
      type: String,
      enum: ['mp4', 'avi', 'mov', 'wmv', 'webm', 'ogg', '3gp', 'flv'],
      default: ['mp4', 'avi', 'mov', 'webm']
    }],
    
    enablePublicSharing: {
      type: Boolean,
      default: true
    },
    
    customBranding: {
      logoUrl: String,
      primaryColor: {
        type: String,
        default: '#7c3aed',
        validate: {
          validator: function(v) {
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
          },
          message: 'Primary color must be a valid hex color'
        }
      },
      companyName: String
    }
  },

  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free'
    },
    
    status: {
      type: String,
      enum: ['active', 'suspended', 'cancelled'],
      default: 'active'
    },
    
    startDate: {
      type: Date,
      default: Date.now
    },
    
    endDate: Date,
    
    billingEmail: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please provide a valid billing email address'
      }
    }
  },

  billing: {
    // Stripe integration
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripeSubscriptionItemId: String, // For license quantity updates
    
    // License pricing (from env)
    pricePerLicense: {
      type: Number,
      default: function() {
        return parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
      }
    },
    
    // Billing cycle info
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    lastInvoiceDate: Date,
    nextBillingDate: Date,
    
    // Payment status
    paymentStatus: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'trialing'],
      default: 'active'
    }
  },

  limits: {
    // License management
    purchasedLicenses: {
      type: Number,
      default: 1, // Start with 1 license for Pro accounts
      min: 0 // 0 for free accounts
    },
    
    // Active team members count
    activeTeamMembers: {
      type: Number,
      default: 1, // Account owner
      min: 0
    },
    
    // Team features
    allowTeams: {
      type: Boolean,
      default: false // Only Pro accounts can have teams
    },
    
    // Pending invitations count
    pendingInvitations: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Usage tracking moved to User model for Free accounts
  // Pro accounts don't need usage tracking (unlimited)

  statistics: {
    totalProcesses: {
      type: Number,
      default: 0,
      min: 0
    },
    processesLast30Days: {
      type: Number,
      default: 0,
      min: 0
    },
    processesLast90Days: {
      type: Number,
      default: 0,
      min: 0
    },
    processesLast365Days: {
      type: Number,
      default: 0,
      min: 0
    },
    lastProcessDate: Date,
    firstProcessDate: Date,
    totalStorageUsedMB: {
      type: Number,
      default: 0,
      min: 0
    },
    averageProcessSizeMB: {
      type: Number,
      default: 0,
      min: 0
    }
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
      return ret;
    }
  }
});

// Indexes for performance
tenantSchema.index({ domain: 1 });
tenantSchema.index({ 'subscription.status': 1 });
tenantSchema.index({ isActive: 1 });

// Pre-save middleware to update updatedAt
tenantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
tenantSchema.methods.isWithinUsageLimits = function() {
  return this.usage.processesThisMonth < this.settings.maxProcessesPerMonth;
};

tenantSchema.methods.incrementProcessCount = function() {
  this.usage.processesThisMonth += 1;
  this.limits.currentProcessesThisMonth += 1;
  return this.save();
};

tenantSchema.methods.resetMonthlyUsage = function() {
  this.usage.processesThisMonth = 0;
  this.limits.currentProcessesThisMonth = 0;
  this.usage.lastResetDate = new Date();
  return this.save();
};

// License-based billing methods
tenantSchema.methods.calculateMonthlyPrice = function() {
  if (this.subscription.plan !== 'pro') return 0;
  
  const pricePerLicense = this.billing.pricePerLicense || parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
  return this.limits.purchasedLicenses * pricePerLicense;
};

tenantSchema.methods.getAvailableLicenses = function() {
  if (this.subscription.plan !== 'pro') return 0;
  return Math.max(0, this.limits.purchasedLicenses - this.limits.activeTeamMembers);
};

tenantSchema.methods.hasAvailableLicense = function() {
  if (this.subscription.plan !== 'pro') return false;
  return this.getAvailableLicenses() > 0;
};

tenantSchema.methods.canAddMoreUsers = function() {
  // Free accounts: no teams allowed
  if (this.subscription.plan === 'free') return false;
  
  // Pro accounts: check available licenses
  return this.hasAvailableLicense();
};

tenantSchema.methods.upgradeToProPlan = function() {
  this.subscription.plan = 'pro';
  this.subscription.status = 'active';
  this.limits.allowTeams = true;
  // Initialize with 1 purchased license if not set
  if (!this.limits.purchasedLicenses || this.limits.purchasedLicenses < 1) {
    this.limits.purchasedLicenses = 1;
  }
  // Ensure price is set from env
  this.billing.pricePerLicense = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
  return this.save();
};

// Team member management
tenantSchema.methods.incrementTeamMemberCount = function() {
  this.limits.activeTeamMembers += 1;
  return this.save();
};

tenantSchema.methods.decrementTeamMemberCount = function() {
  this.limits.activeTeamMembers = Math.max(1, this.limits.activeTeamMembers - 1); // Keep at least 1 (owner)
  return this.save();
};

// Invitation management
tenantSchema.methods.incrementPendingInvitations = function() {
  this.limits.pendingInvitations += 1;
  return this.save();
};

tenantSchema.methods.decrementPendingInvitations = function() {
  this.limits.pendingInvitations = Math.max(0, this.limits.pendingInvitations - 1);
  return this.save();
};

// Compatibility methods
tenantSchema.methods.incrementUserCount = function() {
  return this.incrementTeamMemberCount();
};

tenantSchema.methods.decrementUserCount = function() {
  return this.decrementTeamMemberCount();
};

// License purchase and management

tenantSchema.methods.purchaseLicenses = async function(quantity) {
  if (this.subscription.plan !== 'pro') {
    throw new Error('Only Pro accounts can purchase licenses');
  }
  
  this.limits.purchasedLicenses += quantity;
  
  // Update Stripe subscription quantity
  if (this.billing.stripeSubscriptionId) {
    const stripeService = require('../services/stripeService');
    await stripeService.updateSubscriptionLicenses(this, this.limits.purchasedLicenses);
  }
  
  return this.save();
};

tenantSchema.methods.reduceLicenses = async function(quantity) {
  if (this.subscription.plan !== 'pro') {
    throw new Error('Only Pro accounts can manage licenses');
  }
  
  const newTotal = this.limits.purchasedLicenses - quantity;
  const activeTeamMembers = this.limits.activeTeamMembers || 1;
  
  if (newTotal < activeTeamMembers) {
    const usersToRemove = activeTeamMembers - newTotal;
    throw new Error(`Cannot reduce licenses below current active team size. Remove ${usersToRemove} team member${usersToRemove > 1 ? 's' : ''} first.`);
  }
  
  if (newTotal < 1) {
    throw new Error('Must maintain at least 1 license');
  }
  
  this.limits.purchasedLicenses = newTotal;
  
  // Update Stripe subscription quantity
  if (this.billing.stripeSubscriptionId) {
    const stripeService = require('../services/stripeService');
    await stripeService.updateSubscriptionLicenses(this, newTotal);
  }
  
  return this.save();
};

// Instance method to downgrade to free plan
tenantSchema.methods.downgradeToFreePlan = async function() {
  if (this.subscription.plan === 'free') {
    throw new Error('Already on free plan');
  }
  
  const User = mongoose.model('User');
  
  // Find the owner
  const owner = await User.findOne({ 
    tenantId: this._id, 
    role: 'owner',
    isActive: true 
  });
  
  if (!owner) {
    throw new Error('No active owner found for this tenant');
  }
  
  // Deactivate all users except the owner
  const deactivationResult = await User.updateMany(
    { 
      tenantId: this._id, 
      isActive: true,
      _id: { $ne: owner._id } // Exclude owner
    },
    { 
      $set: { 
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: owner._id,
        deactivationReason: 'tenant_downgraded_to_free'
      }
    }
  );
  
  // Update tenant to free plan
  this.subscription.plan = 'free';
  this.subscription.status = 'active';
  this.limits.allowTeams = false;
  this.limits.purchasedLicenses = 0;
  this.limits.activeTeamMembers = 1; // Only owner remains
  this.limits.pendingInvitations = 0; // Clear pending invitations
  
  // Keep billing info for potential re-upgrade
  // but clear active subscription
  this.billing.stripeSubscriptionId = null;
  
  await this.save();
  
  // Downgrade all active users (including owner) to free account type
  await User.updateMany(
    { tenantId: this._id, isActive: true },
    { $set: { accountType: 'free' } }
  );
  
  return {
    tenant: this,
    deactivatedUsers: deactivationResult.modifiedCount
  };
};

// Static methods
tenantSchema.statics.findByDomain = function(domain) {
  return this.findOne({ domain: domain.toLowerCase(), isActive: true });
};

tenantSchema.statics.getActiveTenantsCount = function() {
  return this.countDocuments({ isActive: true });
};

module.exports = mongoose.model('Tenant', tenantSchema);