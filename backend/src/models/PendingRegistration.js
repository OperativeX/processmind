const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
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

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },

  tenantName: {
    type: String,
    required: [true, 'Tenant name is required'],
    trim: true,
    minlength: [2, 'Tenant name must be at least 2 characters long'],
    maxlength: [100, 'Tenant name cannot exceed 100 characters']
  },

  subdomain: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[a-z0-9-]+$/.test(v);
      },
      message: 'Subdomain can only contain lowercase letters, numbers, and hyphens'
    }
  },

  verificationCode: {
    type: String,
    required: true,
    length: 6
  },

  verificationAttempts: {
    type: Number,
    default: 0,
    max: 5
  },

  ipAddress: String,
  userAgent: String,

  metadata: {
    source: String,
    referrer: String,
    utmCampaign: String,
    utmSource: String,
    utmMedium: String
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours (86400 seconds)
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.verificationCode;
      return ret;
    }
  }
});

// Indexes
pendingRegistrationSchema.index({ email: 1 });
pendingRegistrationSchema.index({ subdomain: 1 });
pendingRegistrationSchema.index({ verificationCode: 1, email: 1 });
pendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // TTL index

// Instance methods
pendingRegistrationSchema.methods.incrementVerificationAttempts = function() {
  this.verificationAttempts += 1;
  return this.save();
};

pendingRegistrationSchema.methods.isMaxAttemptsReached = function() {
  return this.verificationAttempts >= 5;
};

// Static methods
pendingRegistrationSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

pendingRegistrationSchema.statics.findByVerificationCode = function(email, code) {
  return this.findOne({ 
    email: email.toLowerCase(), 
    verificationCode: code 
  });
};

pendingRegistrationSchema.statics.cleanup = async function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ createdAt: { $lt: twentyFourHoursAgo } });
  return result.deletedCount;
};

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);