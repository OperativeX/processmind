#!/usr/bin/env node

/**
 * Migration script to update existing data to the new pricing model
 * 
 * This script will:
 * 1. Update User models with new pricing fields
 * 2. Update Tenant models with new license structure
 * 3. Set initial license counts based on current users
 * 4. Migrate usage data to new fields
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Tenant } = require('../src/models');

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // 1. Migrate Users
    console.log('\n=== Migrating Users ===');
    
    const users = await User.find({});
    let userUpdateCount = 0;
    
    for (const user of users) {
      const updates = {};
      
      // Migrate plan_type from accountType
      if (!user.plan_type && user.accountType) {
        updates.plan_type = user.accountType;
      }
      
      // Initialize new fields
      if (user.monthly_uploads_used === undefined) {
        updates.monthly_uploads_used = user.usage?.processesThisMonth || 0;
      }
      
      if (!user.uploads_reset_date) {
        updates.uploads_reset_date = user.usage?.lastResetDate || new Date();
      }
      
      if (!user.usage_alerts_sent) {
        updates.usage_alerts_sent = {
          upload_80_percent: false,
          storage_80_percent: false
        };
      }
      
      // Initialize license_count for pro users
      if (user.accountType === 'pro' && !user.license_count) {
        updates.license_count = 1;
      }
      
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        userUpdateCount++;
      }
    }
    
    console.log(`Updated ${userUpdateCount} users`);
    
    // 2. Migrate Tenants
    console.log('\n=== Migrating Tenants ===');
    
    const tenants = await Tenant.find({});
    let tenantUpdateCount = 0;
    
    for (const tenant of tenants) {
      const updates = {};
      
      // Count active users for this tenant
      const activeUserCount = await User.countDocuments({
        tenantId: tenant._id,
        isActive: true,
        accountType: { $ne: 'free' }
      });
      
      // Initialize activeTeamMembers
      if (tenant.limits.activeTeamMembers === undefined) {
        updates['limits.activeTeamMembers'] = Math.max(1, activeUserCount);
      }
      
      // Initialize purchasedLicenses for Pro tenants
      if (tenant.subscription.plan === 'pro') {
        if (tenant.limits.purchasedLicenses === undefined || tenant.limits.purchasedLicenses === 0) {
          // Use the greater of current users or existing currentProUsers
          const licensesToSet = Math.max(
            1,
            activeUserCount,
            tenant.limits.currentProUsers || 1
          );
          updates['limits.purchasedLicenses'] = licensesToSet;
        }
      } else {
        // Free tenants should have 0 licenses
        updates['limits.purchasedLicenses'] = 0;
      }
      
      // Set price per license from environment
      if (!tenant.billing.pricePerLicense) {
        updates['billing.pricePerLicense'] = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
      }
      
      // Initialize pendingInvitations count
      if (tenant.limits.pendingInvitations === undefined) {
        const pendingCount = await mongoose.model('UserInvitation').countDocuments({
          tenantId: tenant._id,
          status: 'pending',
          expiresAt: { $gt: new Date() }
        });
        updates['limits.pendingInvitations'] = pendingCount;
      }
      
      // Clean up legacy fields
      if (tenant.billing.freeProUsers !== undefined) {
        updates['$unset'] = { 'billing.freeProUsers': 1 };
      }
      if (tenant.billing.customPricing?.freeProUsers !== undefined) {
        if (!updates['$unset']) updates['$unset'] = {};
        updates['$unset']['billing.customPricing.freeProUsers'] = 1;
      }
      
      if (Object.keys(updates).length > 0 || updates['$unset']) {
        const updateQuery = {};
        
        // Separate $set and $unset operations
        const setUpdates = { ...updates };
        delete setUpdates['$unset'];
        
        if (Object.keys(setUpdates).length > 0) {
          updateQuery['$set'] = setUpdates;
        }
        
        if (updates['$unset']) {
          updateQuery['$unset'] = updates['$unset'];
        }
        
        await Tenant.updateOne({ _id: tenant._id }, updateQuery);
        tenantUpdateCount++;
      }
    }
    
    console.log(`Updated ${tenantUpdateCount} tenants`);
    
    // 3. Verify migration
    console.log('\n=== Verification ===');
    
    const proTenants = await Tenant.find({ 'subscription.plan': 'pro' });
    console.log(`Pro tenants: ${proTenants.length}`);
    
    for (const tenant of proTenants) {
      const userCount = await User.countDocuments({
        tenantId: tenant._id,
        isActive: true,
        accountType: 'pro'
      });
      console.log(`- ${tenant.name}: ${tenant.limits.purchasedLicenses} licenses, ${userCount} active pro users`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
migrate();