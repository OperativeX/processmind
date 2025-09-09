#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Tenant, User } = require('../src/models');
const logger = require('../src/utils/logger');

async function migratePurchasedLicenses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('Connected to MongoDB');

    // Find all Pro tenants
    const proTenants = await Tenant.find({
      'subscription.plan': 'pro'
    });

    logger.info(`Found ${proTenants.length} Pro tenants to migrate`);

    for (const tenant of proTenants) {
      // Skip if already has purchasedLicenses
      if (tenant.limits.purchasedLicenses) {
        logger.info(`Tenant ${tenant.name} already has purchasedLicenses: ${tenant.limits.purchasedLicenses}`);
        continue;
      }

      // Count current Pro users
      const proUserCount = await User.countDocuments({
        tenantId: tenant._id,
        isActive: true,
        accountType: 'pro'
      });

      // Set purchasedLicenses to current user count (minimum 1)
      const purchasedLicenses = Math.max(1, proUserCount);
      
      tenant.limits.purchasedLicenses = purchasedLicenses;
      tenant.limits.currentProUsers = proUserCount;
      
      await tenant.save();
      
      logger.info(`Migrated tenant ${tenant.name}: ${purchasedLicenses} licenses (${proUserCount} Pro users)`);
    }

    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePurchasedLicenses();