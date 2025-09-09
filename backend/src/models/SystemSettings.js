const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  description: {
    type: String
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
systemSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get pricing settings with defaults
systemSettingsSchema.statics.getPricingSettings = async function() {
  const pricing = await this.findOne({ key: 'pricing' });
  
  if (!pricing) {
    // Create default pricing settings if not exists
    return await this.create({
      key: 'pricing',
      value: {
        defaultFreeUsers: 0,
        defaultPricePerUser: parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10),
        currency: 'EUR',
        stripePriceId: null // Will be set when Stripe product is created
      },
      description: 'Global pricing configuration'
    });
  }
  
  return pricing;
};

// Static method to update setting
systemSettingsSchema.statics.updateSetting = async function(key, value, modifiedBy) {
  return await this.findOneAndUpdate(
    { key },
    { 
      value, 
      lastModifiedBy: modifiedBy,
      updatedAt: Date.now()
    },
    { 
      new: true, 
      upsert: true 
    }
  );
};

// Initialize default settings
systemSettingsSchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      key: 'pricing',
      value: {
        defaultFreeUsers: 0,
        defaultPricePerUser: parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10),
        currency: 'EUR',
        stripePriceId: null
      },
      description: 'Global pricing configuration'
    },
    {
      key: 'registration',
      value: {
        allowPublicRegistration: true,
        requireEmailVerification: true,
        defaultPlan: 'free',
        autoApproveRegistrations: true
      },
      description: 'Registration settings'
    },
    {
      key: 'email',
      value: {
        systemEmail: 'noreply@processmind.com',
        supportEmail: 'support@processmind.com'
      },
      description: 'System email addresses'
    },
    {
      key: 'features',
      value: {
        enableVideoProcessing: true,
        enableAIAnalysis: true,
        enableSharing: true,
        enableFavoriteLists: true
      },
      description: 'Feature toggles'
    }
  ];
  
  for (const setting of defaults) {
    await this.findOneAndUpdate(
      { key: setting.key },
      setting,
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);