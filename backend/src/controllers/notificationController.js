const Notification = require('../models/Notification');
const PendingShare = require('../models/PendingShare');
const FavoriteList = require('../models/FavoriteList');
const logger = require('../utils/logger');

class NotificationController {
  // Get user notifications
  async getNotifications(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userId = req.user.id;
      const { status, type, page = 1, limit = 20 } = req.query;
      
      const query = { userId };
      
      if (status) {
        query.status = status;
      }
      
      if (type) {
        query.type = type;
      }
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.getUnreadCount(userId);
      
      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching notifications', {
        error: error.message,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Mark notification as read
  async markAsRead(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      
      const notification = await Notification.findOne({
        _id: id,
        userId
      });
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }
      
      await notification.markAsRead();
      
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Error marking notification as read', {
        error: error.message,
        notificationId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      
      const result = await Notification.markAllAsRead(userId);
      
      res.json({
        success: true,
        message: `${result.modifiedCount} notifications marked as read`
      });
    } catch (error) {
      logger.error('Error marking all notifications as read', {
        error: error.message,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Get pending shares for user
  async getPendingShares(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userId = req.user.id;
      
      const pendingShares = await PendingShare.findPendingForUser(userId, tenantId);
      
      res.json({
        success: true,
        data: pendingShares
      });
    } catch (error) {
      logger.error('Error fetching pending shares', {
        error: error.message,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Get share details by ID
  async getShareDetails(req, res, next) {
    try {
      const { tenantId, shareId } = req.params;
      const userId = req.user.id;
      
      const pendingShare = await PendingShare.findById(shareId)
        .populate('fromUserId', 'firstName lastName email fullName')
        .populate('favoriteListId', 'name description color')
        .populate('toUserId', 'firstName lastName email fullName');
      
      if (!pendingShare) {
        return res.status(404).json({
          success: false,
          message: 'Share invitation not found'
        });
      }
      
      // Verify the share is for the current user
      if (!pendingShare.toUserId._id.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: 'This share invitation is not for you'
        });
      }
      
      // Check if share is still pending
      if (pendingShare.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `This invitation has already been ${pendingShare.status}`
        });
      }
      
      res.json({
        success: true,
        data: pendingShare
      });
    } catch (error) {
      logger.error('Error fetching share details', {
        error: error.message,
        shareId: req.params.shareId,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Accept share invitation
  async acceptShare(req, res, next) {
    try {
      const { tenantId, shareId } = req.params;
      const userId = req.user.id;
      
      const pendingShare = await PendingShare.findOne({
        _id: shareId,
        toUserId: userId,
        tenantId,
        status: 'pending'
      })
      .populate('favoriteListId')
      .populate('fromUserId', 'firstName lastName email');
      
      if (!pendingShare) {
        return res.status(404).json({
          success: false,
          message: 'Share invitation not found'
        });
      }
      
      if (pendingShare.isExpired()) {
        await pendingShare.accept(); // This will set status to expired
        return res.status(400).json({
          success: false,
          message: 'Share invitation has expired'
        });
      }
      
      // Create a copy of the list for the user
      const originalList = await FavoriteList.findById(pendingShare.favoriteListId)
        .populate('processes', '_id');
      
      if (!originalList) {
        return res.status(404).json({
          success: false,
          message: 'Original list no longer exists'
        });
      }
      
      // Create new list copy
      const newList = new FavoriteList({
        tenantId,
        ownerId: userId,
        name: `${originalList.name} (von ${pendingShare.fromUserId.firstName})`,
        description: originalList.description,
        color: originalList.color,
        processes: pendingShare.listSnapshot.processes, // Use snapshot to preserve original state
        isPublic: false // Copied lists are private by default
      });
      
      await newList.save();
      
      // Mark share as accepted
      await pendingShare.accept();
      
      // Create acceptance notification for sender
      const acceptNotification = new Notification({
        tenantId,
        userId: pendingShare.fromUserId._id,
        type: 'share_accepted',
        title: 'Favoriten-Liste akzeptiert',
        message: `${req.user.firstName} hat Ihre geteilte Liste "${originalList.name}" akzeptiert.`,
        metadata: {
          favoriteListId: originalList._id,
          acceptedBy: {
            id: userId,
            name: `${req.user.firstName} ${req.user.lastName}`,
            email: req.user.email
          }
        }
      });
      
      await acceptNotification.save();
      
      // Mark original notification as read
      await Notification.updateOne(
        {
          userId,
          'metadata.pendingShareId': shareId,
          type: 'share_request'
        },
        {
          status: 'read',
          readAt: new Date()
        }
      );
      
      logger.info('Share invitation accepted and list copied', {
        shareId,
        originalListId: originalList._id,
        newListId: newList._id,
        userId,
        tenantId
      });
      
      res.json({
        success: true,
        message: 'Share invitation accepted successfully',
        data: {
          newListId: newList._id,
          listName: newList.name
        }
      });
    } catch (error) {
      logger.error('Error accepting share', {
        error: error.message,
        shareId: req.params.shareId,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Reject share invitation
  async rejectShare(req, res, next) {
    try {
      const { tenantId, shareId } = req.params;
      const userId = req.user.id;
      
      const pendingShare = await PendingShare.findOne({
        _id: shareId,
        toUserId: userId,
        tenantId,
        status: 'pending'
      })
      .populate('favoriteListId', 'name')
      .populate('fromUserId', 'firstName lastName email');
      
      if (!pendingShare) {
        return res.status(404).json({
          success: false,
          message: 'Share invitation not found'
        });
      }
      
      // Mark share as rejected
      await pendingShare.reject();
      
      // Create rejection notification for sender
      const rejectNotification = new Notification({
        tenantId,
        userId: pendingShare.fromUserId._id,
        type: 'share_rejected',
        title: 'Favoriten-Liste abgelehnt',
        message: `${req.user.firstName} hat Ihre geteilte Liste "${pendingShare.favoriteListId.name}" abgelehnt.`,
        metadata: {
          favoriteListId: pendingShare.favoriteListId._id,
          rejectedBy: {
            id: userId,
            name: `${req.user.firstName} ${req.user.lastName}`,
            email: req.user.email
          }
        },
        priority: 'low'
      });
      
      await rejectNotification.save();
      
      // Mark original notification as read
      await Notification.updateOne(
        {
          userId,
          'metadata.pendingShareId': shareId,
          type: 'share_request'
        },
        {
          status: 'read',
          readAt: new Date()
        }
      );
      
      logger.info('Share invitation rejected', {
        shareId,
        userId,
        tenantId
      });
      
      res.json({
        success: true,
        message: 'Share invitation rejected'
      });
    } catch (error) {
      logger.error('Error rejecting share', {
        error: error.message,
        shareId: req.params.shareId,
        userId: req.user.id
      });
      next(error);
    }
  }

  // Archive notification
  async archiveNotification(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      
      const notification = await Notification.findOne({
        _id: id,
        userId
      });
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }
      
      await notification.archive();
      
      res.json({
        success: true,
        message: 'Notification archived'
      });
    } catch (error) {
      logger.error('Error archiving notification', {
        error: error.message,
        notificationId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }
}

module.exports = new NotificationController();