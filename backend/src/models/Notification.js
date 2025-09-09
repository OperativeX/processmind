const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  type: {
    type: String,
    enum: ['share_request', 'share_accepted', 'share_rejected', 'process_completed', 'process_failed', 'system'],
    required: [true, 'Notification type is required']
  },

  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },

  metadata: {
    pendingShareId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingShare'
    },
    processId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Process'
    },
    favoriteListId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FavoriteList'
    },
    fromUser: {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
      email: String
    },
    actionUrl: String,
    additionalData: mongoose.Schema.Types.Mixed
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },

  readAt: Date,
  archivedAt: Date,

  expiresAt: {
    type: Date,
    default: function() {
      // Notifications expire after 30 days by default
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
notificationSchema.methods.markAsRead = function() {
  if (this.status === 'unread') {
    this.status = 'read';
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

notificationSchema.methods.archive = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

// Static methods
notificationSchema.statics.createShareNotification = async function(pendingShare) {
  const notification = new this({
    tenantId: pendingShare.tenantId,
    userId: pendingShare.toUserId,
    type: 'share_request',
    title: 'Neue Favoriten-Liste geteilt',
    message: `${pendingShare.fromUserId.fullName} möchte die Liste "${pendingShare.favoriteListId.name}" mit Ihnen teilen.`,
    metadata: {
      pendingShareId: pendingShare._id,
      favoriteListId: pendingShare.favoriteListId._id,
      fromUser: {
        id: pendingShare.fromUserId._id,
        name: pendingShare.fromUserId.fullName,
        email: pendingShare.fromUserId.email
      }
    },
    priority: 'medium'
  });

  return notification.save();
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    userId,
    status: 'unread'
  });
};

notificationSchema.statics.getRecentNotifications = function(userId, limit = 10) {
  return this.find({
    userId,
    status: { $in: ['unread', 'read'] }
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    {
      userId,
      status: 'unread'
    },
    {
      status: 'read',
      readAt: new Date()
    }
  );
};

notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    status: { $in: ['read', 'archived'] },
    createdAt: { $lt: cutoffDate }
  });
  
  return result;
};

module.exports = mongoose.model('Notification', notificationSchema);