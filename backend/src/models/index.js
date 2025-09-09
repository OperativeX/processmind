// Central model export file for easy importing
const Tenant = require('./Tenant');
const User = require('./User');
const Process = require('./Process');
const FavoriteList = require('./FavoriteList');
const PendingShare = require('./PendingShare');
const Notification = require('./Notification');
const PendingRegistration = require('./PendingRegistration');
const EmailDomain = require('./EmailDomain');
const UserInvitation = require('./UserInvitation');
const SystemSettings = require('./SystemSettings');
const TenantUsage = require('./TenantUsage');
const UserUsage = require('./UserUsage');

module.exports = {
  Tenant,
  User,
  Process,
  FavoriteList,
  PendingShare,
  Notification,
  PendingRegistration,
  EmailDomain,
  UserInvitation,
  SystemSettings,
  TenantUsage,
  UserUsage
};