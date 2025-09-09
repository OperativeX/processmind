const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

class UserController {
  // Get all users in a tenant
  async getTenantUsers(req, res, next) {
    try {
      const { tenantId } = req.params;
      const currentUserId = req.user.id;
      
      const users = await User.find({
        tenantId,
        isActive: true
      })
      .select('id firstName lastName email role createdAt')
      .sort({ firstName: 1, lastName: 1 });

      // Add fullName virtual to each user
      const formattedUsers = users.map(user => ({
        ...user.toJSON(),
        fullName: user.fullName
      }));

      res.json({
        success: true,
        data: formattedUsers
      });
    } catch (error) {
      logger.error('Error fetching tenant users', {
        error: error.message,
        tenantId: req.params.tenantId
      });
      next(error);
    }
  }

  // Get user by email within tenant
  async getUserByEmail(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email parameter is required'
        });
      }

      const user = await User.findOne({
        email: email.toLowerCase(),
        tenantId,
        isActive: true
      })
      .select('id firstName lastName email role');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this tenant'
        });
      }

      res.json({
        success: true,
        data: {
          ...user.toJSON(),
          fullName: user.fullName,
          exists: true
        }
      });
    } catch (error) {
      logger.error('Error fetching user by email', {
        error: error.message,
        tenantId: req.params.tenantId,
        email: req.query.email
      });
      next(error);
    }
  }

  // Check if email exists in tenant (lightweight endpoint for validation)
  async checkEmailExists(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const userExists = await User.exists({
        email: email.toLowerCase(),
        tenantId,
        isActive: true
      });

      res.json({
        success: true,
        data: {
          exists: !!userExists,
          email: email.toLowerCase()
        }
      });
    } catch (error) {
      logger.error('Error checking email existence', {
        error: error.message,
        tenantId: req.params.tenantId
      });
      next(error);
    }
  }

  // Get tenant user statistics
  async getTenantUserStats(req, res, next) {
    try {
      const { tenantId } = req.params;
      
      const stats = await User.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            owners: {
              $sum: { $cond: [{ $eq: ['$role', 'owner'] }, 1, 0] }
            },
            admins: {
              $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
            },
            users: {
              $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] }
            },
            verifiedUsers: {
              $sum: { $cond: ['$emailVerified', 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: stats[0] || {
          totalUsers: 0,
          owners: 0,
          admins: 0,
          users: 0,
          verifiedUsers: 0
        }
      });
    } catch (error) {
      logger.error('Error fetching tenant user stats', {
        error: error.message,
        tenantId: req.params.tenantId
      });
      next(error);
    }
  }

  // Update user role (admin only)
  async updateUserRole(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user.id;
      const currentUserRole = req.user.role;

      // Only admins and owners can change roles
      if (!['admin', 'owner'].includes(currentUserRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to change user roles'
        });
      }

      // Validate role
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be "user" or "admin"'
        });
      }

      // Cannot change your own role
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }

      const user = await User.findOne({
        _id: userId,
        tenantId,
        isActive: true
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Cannot change owner role
      if (user.role === 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Cannot change owner role'
        });
      }

      user.role = role;
      await user.save();

      logger.info('User role updated', {
        tenantId,
        userId,
        newRole: role,
        updatedBy: currentUserId
      });

      res.json({
        success: true,
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          fullName: user.fullName
        },
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.error('Error updating user role', {
        error: error.message,
        tenantId: req.params.tenantId,
        userId: req.params.userId
      });
      next(error);
    }
  }

  // Deactivate user (admin only)
  async deactivateUser(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const currentUserId = req.user.id;
      const currentUserRole = req.user.role;

      // Only admins and owners can deactivate users
      if (!['admin', 'owner'].includes(currentUserRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to deactivate users'
        });
      }

      // Cannot deactivate yourself
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      const user = await User.findOne({
        _id: userId,
        tenantId
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Cannot deactivate owner
      if (user.role === 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Cannot deactivate owner account'
        });
      }

      user.isActive = false;
      await user.save();

      logger.info('User deactivated', {
        tenantId,
        userId,
        deactivatedBy: currentUserId
      });

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      logger.error('Error deactivating user', {
        error: error.message,
        tenantId: req.params.tenantId,
        userId: req.params.userId
      });
      next(error);
    }
  }
}

module.exports = new UserController();