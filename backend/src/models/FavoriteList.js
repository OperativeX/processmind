const mongoose = require('mongoose');

const sharedUserSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permission: {
    type: String,
    enum: ['view', 'edit'],
    required: true,
    default: 'view'
  },
  sharedAt: {
    type: Date,
    default: Date.now
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const favoriteListSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },

  name: {
    type: String,
    required: [true, 'List name is required'],
    trim: true,
    minlength: [1, 'List name cannot be empty'],
    maxlength: [100, 'List name cannot exceed 100 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  processes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Process'
  }],

  isPublic: {
    type: Boolean,
    default: false
  },

  sharedWith: [sharedUserSchema],

  color: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^#[0-9A-Fa-f]{6}$/.test(v);
      },
      message: 'Color must be a valid hex color code (e.g., #7c3aed)'
    },
    default: '#7c3aed'
  },

  metadata: {
    processCount: {
      type: Number,
      default: 0
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
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
favoriteListSchema.index({ tenantId: 1, ownerId: 1 });
favoriteListSchema.index({ tenantId: 1, isPublic: 1 });
favoriteListSchema.index({ tenantId: 1, 'sharedWith.userId': 1 });
favoriteListSchema.index({ processes: 1 });

// Pre-save middleware
favoriteListSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.metadata.processCount = this.processes.length;
  this.metadata.lastModified = Date.now();
  next();
});

// Instance methods
favoriteListSchema.methods.addProcess = function(processId) {
  if (!this.processes.includes(processId)) {
    this.processes.push(processId);
    this.metadata.processCount = this.processes.length;
    this.metadata.lastModified = Date.now();
  }
  return this.save();
};

favoriteListSchema.methods.removeProcess = function(processId) {
  const processIdStr = processId.toString();
  this.processes = this.processes.filter(id => id.toString() !== processIdStr);
  this.metadata.processCount = this.processes.length;
  this.metadata.lastModified = Date.now();
  return this.save();
};

favoriteListSchema.methods.shareWithUser = function(userId, permission, sharedBy) {
  const userIdStr = userId.toString();
  // Remove existing share for this user if exists
  this.sharedWith = this.sharedWith.filter(share => share.userId.toString() !== userIdStr);
  
  // Add new share
  this.sharedWith.push({
    userId,
    permission: permission || 'view',
    sharedBy,
    sharedAt: new Date()
  });
  
  return this.save();
};

favoriteListSchema.methods.removeUserShare = function(userId) {
  const userIdStr = userId.toString();
  this.sharedWith = this.sharedWith.filter(share => share.userId.toString() !== userIdStr);
  return this.save();
};

favoriteListSchema.methods.canUserAccess = function(userId) {
  // Convert to string for comparison if it's an ObjectId
  const userIdStr = userId.toString();
  
  // Owner has full access
  if (this.ownerId.toString() === userIdStr) {
    return { access: true, permission: 'owner' };
  }
  
  // Check if publicly shared
  if (this.isPublic) {
    return { access: true, permission: 'view' };
  }
  
  // Check specific user shares
  const userShare = this.sharedWith.find(share => share.userId.toString() === userIdStr);
  if (userShare) {
    return { access: true, permission: userShare.permission };
  }
  
  return { access: false, permission: null };
};

favoriteListSchema.methods.canUserEdit = function(userId) {
  const access = this.canUserAccess(userId);
  return access.access && (access.permission === 'owner' || access.permission === 'edit');
};

// Static methods
favoriteListSchema.statics.findByTenant = function(tenantId, userId, options = {}) {
  const query = {
    tenantId,
    $or: [
      { ownerId: userId }, // Own lists
      { isPublic: true },  // Public lists
      { 'sharedWith.userId': userId } // Specifically shared lists
    ]
  };
  
  let dbQuery = this.find(query);
  
  if (options.populate) {
    dbQuery = dbQuery.populate('ownerId', 'firstName lastName email')
                    .populate('sharedWith.userId', 'firstName lastName email')
                    .populate('processes', 'title status createdAt');
  }
  
  return dbQuery.sort({ updatedAt: -1 });
};

favoriteListSchema.statics.findUserAccessibleLists = function(tenantId, userId) {
  return this.findByTenant(tenantId, userId, { populate: true });
};

favoriteListSchema.statics.findListsContainingProcess = function(tenantId, processId) {
  return this.find({
    tenantId,
    processes: processId
  }).populate('ownerId', 'firstName lastName email');
};

module.exports = mongoose.model('FavoriteList', favoriteListSchema);