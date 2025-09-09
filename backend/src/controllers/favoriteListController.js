const mongoose = require('mongoose');
const FavoriteList = require('../models/FavoriteList');
const Process = require('../models/Process');
const PendingShare = require('../models/PendingShare');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

class FavoriteListController {
  async getFavoriteLists(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userId = req.user.id;
      
      const lists = await FavoriteList.findByTenant(tenantId, userId, { populate: true });
      
      const formattedLists = lists.map(list => ({
        ...list.toJSON(),
        isOwner: list.ownerId._id.toString() === userId,
        permission: list.canUserAccess(userId).permission
      }));

      res.json({
        success: true,
        data: formattedLists,
        count: formattedLists.length
      });
    } catch (error) {
      logger.error('Error fetching favorite lists', { 
        error: error.message,
        tenantId: req.params.tenantId,
        userId: req.user.id
      });
      next(error);
    }
  }

  async getFavoriteList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;

      const list = await FavoriteList.findById(id)
        .populate('ownerId', 'firstName lastName email')
        .populate('sharedWith.userId', 'firstName lastName email')
        .populate('processes', 'title status tags createdAt originalFilename files');

      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      const accessCheck = list.canUserAccess(userId);
      if (!accessCheck.access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this favorite list'
        });
      }

      res.json({
        success: true,
        data: {
          ...list.toJSON(),
          isOwner: list.ownerId._id.toString() === userId,
          permission: accessCheck.permission
        }
      });
    } catch (error) {
      logger.error('Error fetching favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async createFavoriteList(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userId = req.user.id;
      const { name, description, color, processes = [] } = req.body;

      // Validate that all processes belong to the tenant and user has access
      if (processes.length > 0) {
        const processCheck = await Process.find({
          _id: { $in: processes },
          tenantId,
          isDeleted: false
        });

        if (processCheck.length !== processes.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more processes are invalid or not accessible'
          });
        }
      }

      const favoriteList = new FavoriteList({
        tenantId,
        ownerId: userId,
        name,
        description,
        color,
        processes
      });

      await favoriteList.save();

      const populatedList = await FavoriteList.findById(favoriteList._id)
        .populate('ownerId', 'firstName lastName email')
        .populate('processes', 'title status tags createdAt');

      logger.info('Favorite list created', {
        listId: favoriteList._id,
        tenantId,
        userId,
        processCount: processes.length
      });

      res.status(201).json({
        success: true,
        data: {
          ...populatedList.toJSON(),
          isOwner: true,
          permission: 'owner'
        },
        message: 'Favorite list created successfully'
      });
    } catch (error) {
      logger.error('Error creating favorite list', {
        error: error.message,
        tenantId: req.params.tenantId,
        userId: req.user.id
      });
      next(error);
    }
  }

  async updateFavoriteList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { name, description, color } = req.body;

      const list = await FavoriteList.findById(id);

      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      if (!list.canUserEdit(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied to edit this favorite list'
        });
      }

      // Update fields
      if (name !== undefined) list.name = name;
      if (description !== undefined) list.description = description;
      if (color !== undefined) list.color = color;

      await list.save();

      const populatedList = await FavoriteList.findById(list._id)
        .populate('ownerId', 'firstName lastName email')
        .populate('processes', 'title status tags createdAt');

      logger.info('Favorite list updated', {
        listId: list._id,
        tenantId,
        userId
      });

      res.json({
        success: true,
        data: {
          ...populatedList.toJSON(),
          isOwner: list.ownerId.toString() === userId,
          permission: list.canUserAccess(userId).permission
        },
        message: 'Favorite list updated successfully'
      });
    } catch (error) {
      logger.error('Error updating favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async deleteFavoriteList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;

      const list = await FavoriteList.findById(id);

      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      // Only owner can delete
      if (list.ownerId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the list owner can delete this favorite list'
        });
      }

      await FavoriteList.findByIdAndDelete(id);

      logger.info('Favorite list deleted', {
        listId: id,
        tenantId,
        userId
      });

      res.json({
        success: true,
        message: 'Favorite list deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async addProcessToList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { processId } = req.body;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      if (!list.canUserEdit(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied to edit this favorite list'
        });
      }

      // Verify process exists and belongs to tenant
      const process = await Process.findById(processId);
      if (!process || !process.tenantId.equals(tenantId) || process.isDeleted) {
        return res.status(404).json({
          success: false,
          message: 'Process not found or not accessible'
        });
      }

      await list.addProcess(processId);

      logger.info('Process added to favorite list', {
        listId: id,
        processId,
        tenantId,
        userId
      });

      res.json({
        success: true,
        message: 'Process added to favorite list successfully'
      });
    } catch (error) {
      logger.error('Error adding process to favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async removeProcessFromList(req, res, next) {
    try {
      const { tenantId, id, processId } = req.params;
      const userId = req.user.id;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      if (!list.canUserEdit(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied to edit this favorite list'
        });
      }

      await list.removeProcess(processId);

      logger.info('Process removed from favorite list', {
        listId: id,
        processId,
        tenantId,
        userId
      });

      res.json({
        success: true,
        message: 'Process removed from favorite list successfully'
      });
    } catch (error) {
      logger.error('Error removing process from favorite list', {
        error: error.message,
        listId: req.params.id,
        processId: req.params.processId,
        userId: req.user.id
      });
      next(error);
    }
  }

  async shareList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { email, message } = req.body;

      const list = await FavoriteList.findById(id)
        .populate('processes', '_id');
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      // Only owner can share
      if (list.ownerId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the list owner can share lists'
        });
      }

      // Check if user exists in tenant
      const targetUser = await User.findOne({
        email: email.toLowerCase(),
        tenantId,
        isActive: true
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this tenant'
        });
      }

      // Cannot share with yourself
      if (targetUser._id.equals(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot share list with yourself'
        });
      }

      // Check if there's already a pending share for this list to this user
      const existingShare = await PendingShare.findOne({
        favoriteListId: list._id,
        toUserId: targetUser._id,
        status: 'pending'
      });

      if (existingShare) {
        return res.status(400).json({
          success: false,
          message: 'A share invitation is already pending for this user'
        });
      }

      // Create pending share with list snapshot
      const pendingShare = new PendingShare({
        tenantId,
        fromUserId: userId,
        toEmail: targetUser.email,
        toUserId: targetUser._id,
        favoriteListId: list._id,
        listSnapshot: {
          name: list.name,
          description: list.description,
          color: list.color,
          processCount: list.processes.length,
          processes: list.processes.map(p => p._id)
        },
        message
      });

      await pendingShare.save();

      // Populate for notification
      await pendingShare.populate('fromUserId', 'firstName lastName email');
      await pendingShare.populate('favoriteListId', 'name description color');

      // Create notification for recipient
      await Notification.createShareNotification(pendingShare);

      // Send email notification
      const fromUser = await User.findById(userId);
      await emailService.sendListShareEmail(targetUser.email, {
        recipientName: targetUser.firstName || targetUser.fullName,
        senderName: fromUser.fullName,
        listName: list.name,
        listDescription: list.description,
        processCount: list.processes.length,
        message: message,
        pendingShareId: pendingShare._id,
        tenantId: tenantId
      });

      logger.info('Favorite list share invitation created and email sent', {
        listId: id,
        fromUserId: userId,
        toUserId: targetUser._id,
        tenantId,
        emailSent: true
      });

      res.json({
        success: true,
        message: `Share invitation sent to ${targetUser.fullName}`,
        data: {
          pendingShareId: pendingShare._id,
          recipientEmail: targetUser.email
        }
      });
    } catch (error) {
      logger.error('Error sharing favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async removeUserFromList(req, res, next) {
    try {
      const { tenantId, id, userId: targetUserId } = req.params;
      const userId = req.user.id;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      // Only owner can remove users from shared list
      if (list.ownerId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the list owner can remove users from sharing'
        });
      }

      await list.removeUserShare(targetUserId);

      logger.info('User removed from favorite list sharing', {
        listId: id,
        removedUserId: targetUserId,
        tenantId,
        ownerId: userId
      });

      res.json({
        success: true,
        message: 'User removed from list sharing successfully'
      });
    } catch (error) {
      logger.error('Error removing user from favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async getProcessesInList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      const accessCheck = list.canUserAccess(userId);
      if (!accessCheck.access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this favorite list'
        });
      }

      // Get processes with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const processIds = list.processes.slice(skip, skip + parseInt(limit));
      
      const processes = await Process.find({
        _id: { $in: processIds },
        tenantId,
        isDeleted: false
      })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          list: {
            id: list._id,
            name: list.name,
            description: list.description,
            color: list.color,
            processCount: list.processes.length,
            isOwner: list.ownerId.toString() === userId,
            permission: accessCheck.permission
          },
          processes,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: list.processes.length,
            pages: Math.ceil(list.processes.length / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching processes in favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async getAvailableProcesses(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { search, tags } = req.query;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      if (!list.canUserEdit(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied to edit this favorite list'
        });
      }

      // Build query for available processes (not already in the list)
      const query = {
        tenantId,
        isDeleted: false,
        _id: { $nin: list.processes }
      };

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'transcript.text': { $regex: search, $options: 'i' } }
        ];
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query.tags = { $in: tagArray };
      }

      const availableProcesses = await Process.find(query)
        .select('title status tags createdAt originalFilename')
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: availableProcesses
      });
    } catch (error) {
      logger.error('Error fetching available processes', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async bulkAddProcesses(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;
      const { processIds } = req.body;

      if (!Array.isArray(processIds) || processIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Process IDs array is required'
        });
      }

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      if (!list.canUserEdit(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied to edit this favorite list'
        });
      }

      // Validate all processes exist and belong to tenant
      const processCheck = await Process.find({
        _id: { $in: processIds },
        tenantId,
        isDeleted: false
      });

      if (processCheck.length !== processIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more processes are invalid or not accessible'
        });
      }

      // Add only new processes (avoid duplicates)
      const newProcessIds = processIds.filter(pid => 
        !list.processes.some(existingId => existingId.equals(pid))
      );

      if (newProcessIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All specified processes are already in the list'
        });
      }

      list.processes.push(...newProcessIds);
      await list.save();

      logger.info('Processes bulk added to favorite list', {
        listId: id,
        addedCount: newProcessIds.length,
        tenantId,
        userId
      });

      res.json({
        success: true,
        message: `${newProcessIds.length} process(es) added to favorite list successfully`,
        data: {
          addedCount: newProcessIds.length,
          totalCount: list.processes.length
        }
      });
    } catch (error) {
      logger.error('Error bulk adding processes to favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }

  async getListsContainingProcess(req, res, next) {
    try {
      const { tenantId, processId } = req.params;
      const userId = req.user.id;

      // Verify process exists and user has access
      const process = await Process.findById(processId);
      if (!process || !process.tenantId.equals(tenantId) || process.isDeleted) {
        return res.status(404).json({
          success: false,
          message: 'Process not found'
        });
      }

      const lists = await FavoriteList.findListsContainingProcess(tenantId, processId);
      
      // Filter lists user has access to
      const accessibleLists = lists.filter(list => list.canUserAccess(userId).access);

      res.json({
        success: true,
        data: accessibleLists.map(list => ({
          id: list._id,
          name: list.name,
          color: list.color,
          isOwner: list.ownerId.toString() === userId,
          permission: list.canUserAccess(userId).permission
        }))
      });
    } catch (error) {
      logger.error('Error fetching lists containing process', {
        error: error.message,
        processId: req.params.processId,
        userId: req.user.id
      });
      next(error);
    }
  }

  async validateAndCleanList(req, res, next) {
    try {
      const { tenantId, id } = req.params;
      const userId = req.user.id;

      const list = await FavoriteList.findById(id);
      
      if (!list || !list.tenantId.equals(tenantId)) {
        return res.status(404).json({
          success: false,
          message: 'Favorite list not found'
        });
      }

      const accessCheck = list.canUserAccess(userId);
      if (!accessCheck.access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this favorite list'
        });
      }

      // Check all processes in the list
      const validProcessIds = [];
      const removedProcessIds = [];

      for (const processId of list.processes) {
        const process = await Process.findById(processId);
        
        if (process && process.tenantId.equals(tenantId) && !process.isDeleted) {
          validProcessIds.push(processId);
        } else {
          removedProcessIds.push(processId);
        }
      }

      // Update the list if any processes were removed
      if (removedProcessIds.length > 0) {
        list.processes = validProcessIds;
        list.metadata.processCount = validProcessIds.length;
        list.metadata.lastModified = Date.now();
        await list.save();

        logger.info('Favorite list cleaned', {
          listId: id,
          removedCount: removedProcessIds.length,
          remainingCount: validProcessIds.length
        });
      }

      const populatedList = await FavoriteList.findById(list._id)
        .populate('ownerId', 'firstName lastName email')
        .populate('sharedWith.userId', 'firstName lastName email')
        .populate('processes', 'title status tags createdAt originalFilename files');

      res.json({
        success: true,
        data: {
          ...populatedList.toJSON(),
          isOwner: list.ownerId.toString() === userId,
          permission: accessCheck.permission,
          cleaned: removedProcessIds.length > 0,
          removedCount: removedProcessIds.length
        }
      });
    } catch (error) {
      logger.error('Error validating and cleaning favorite list', {
        error: error.message,
        listId: req.params.id,
        userId: req.user.id
      });
      next(error);
    }
  }
}

module.exports = new FavoriteListController();