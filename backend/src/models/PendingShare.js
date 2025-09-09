const mongoose = require('mongoose');

const pendingShareSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'From user ID is required']
  },

  toEmail: {
    type: String,
    required: [true, 'Recipient email is required'],
    lowercase: true,
    trim: true
  },

  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Will be set when user is found
  },

  favoriteListId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FavoriteList',
    required: [true, 'Favorite list ID is required']
  },

  listSnapshot: {
    name: String,
    description: String,
    color: String,
    processCount: Number,
    processes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Process'
    }]
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },

  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },

  acceptedAt: Date,
  rejectedAt: Date,
  
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
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
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
pendingShareSchema.index({ tenantId: 1, toEmail: 1, status: 1 });
pendingShareSchema.index({ toUserId: 1, status: 1 });
pendingShareSchema.index({ fromUserId: 1, createdAt: -1 });
pendingShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
pendingShareSchema.methods.accept = async function() {
  if (this.status !== 'pending') {
    throw new Error('Share is not pending');
  }
  
  if (new Date() > this.expiresAt) {
    this.status = 'expired';
    await this.save();
    throw new Error('Share invitation has expired');
  }

  this.status = 'accepted';
  this.acceptedAt = new Date();
  return this.save();
};

pendingShareSchema.methods.reject = async function() {
  if (this.status !== 'pending') {
    throw new Error('Share is not pending');
  }

  this.status = 'rejected';
  this.rejectedAt = new Date();
  return this.save();
};

pendingShareSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Static methods
pendingShareSchema.statics.findPendingForUser = function(userId, tenantId) {
  return this.find({
    toUserId: userId,
    tenantId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('fromUserId', 'firstName lastName email')
  .populate('favoriteListId', 'name description color')
  .sort({ createdAt: -1 });
};

pendingShareSchema.statics.findPendingByEmail = function(email, tenantId) {
  return this.find({
    toEmail: email.toLowerCase(),
    tenantId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('fromUserId', 'firstName lastName email')
  .populate('favoriteListId', 'name description color')
  .sort({ createdAt: -1 });
};

pendingShareSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
  return result;
};

module.exports = mongoose.model('PendingShare', pendingShareSchema);