const mongoose = require('mongoose');
const crypto = require('crypto');

const userInvitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  
  token: {
    type: String,
    unique: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },
  
  message: {
    type: String,
    maxlength: 500
  },
  
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  acceptedAt: Date,
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    index: { expireAfterSeconds: 0 }
  },
  
  metadata: {
    requiresPayment: {
      type: Boolean,
      default: false
    },
    pricePerUser: Number,
    inviterName: String,
    tenantName: String
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
userInvitationSchema.index({ email: 1, tenantId: 1 });
userInvitationSchema.index({ status: 1, expiresAt: 1 });
userInvitationSchema.index({ invitedBy: 1 });

// Generate invitation token before saving
userInvitationSchema.pre('save', function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Instance methods
userInvitationSchema.methods.accept = async function(userId) {
  this.status = 'accepted';
  this.acceptedBy = userId;
  this.acceptedAt = new Date();
  return this.save();
};

userInvitationSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  return this.save();
};

userInvitationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date() || this.status === 'expired';
};

userInvitationSchema.methods.isValid = function() {
  return this.status === 'pending' && !this.isExpired();
};

// Static methods
userInvitationSchema.statics.findByToken = async function(token) {
  const invitation = await this.findOne({ 
    token, 
    status: 'pending' 
  }).populate('tenantId invitedBy');
  
  if (invitation && invitation.isExpired()) {
    invitation.status = 'expired';
    await invitation.save();
    return null;
  }
  
  return invitation;
};

userInvitationSchema.statics.findPendingByEmail = function(email) {
  return this.find({ 
    email: email.toLowerCase(), 
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('tenantId invitedBy');
};

userInvitationSchema.statics.countPendingForTenant = function(tenantId) {
  return this.countDocuments({
    tenantId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

userInvitationSchema.statics.expireOldInvitations = async function() {
  return await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

module.exports = mongoose.model('UserInvitation', userInvitationSchema);