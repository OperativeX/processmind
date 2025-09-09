#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Tenant, SystemSettings } = require('../src/models');
const logger = require('../src/utils/logger');

async function migrateFreeProUsersToZero() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('Connected to MongoDB');

    // First, update the system settings
    const pricingSettings = await SystemSettings.findOne({ key: 'pricing' });
    if (pricingSettings && pricingSettings.value.defaultFreeUsers !== 0) {
      pricingSettings.value.defaultFreeUsers = 0;
      await pricingSettings.save();
      logger.info('Updated SystemSettings defaultFreeUsers to 0');
    }

    // Find all Pro tenants that haven't customized their pricing
    const proTenants = await Tenant.find({
      'subscription.plan': 'pro',
      'billing.customPricing.enabled': { $ne: true }
    });

    logger.info(`Found ${proTenants.length} Pro tenants without custom pricing to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const tenant of proTenants) {
      // Skip if already 0
      if (tenant.billing.freeProUsers === 0) {
        logger.info(`Tenant ${tenant.name} already has 0 freeProUsers, skipping`);
        skippedCount++;
        continue;
      }

      const oldValue = tenant.billing.freeProUsers || 1;
      tenant.billing.freeProUsers = 0;
      
      await tenant.save();
      migratedCount++;
      
      logger.info(`Migrated tenant ${tenant.name}: freeProUsers ${oldValue} -> 0`);
    }

    // Also check tenants with custom pricing and log them
    const customPricingTenants = await Tenant.find({
      'subscription.plan': 'pro',
      'billing.customPricing.enabled': true
    });

    if (customPricingTenants.length > 0) {
      logger.info(`\nTenants with custom pricing (not modified):`);
      for (const tenant of customPricingTenants) {
        const freeUsers = tenant.billing.customPricing.freeProUsers || 0;
        logger.info(`- ${tenant.name}: ${freeUsers} free users (custom pricing)`);
      }
    }

    logger.info(`\nMigration completed:`);
    logger.info(`- Migrated: ${migratedCount} tenants`);
    logger.info(`- Skipped (already 0): ${skippedCount} tenants`);
    logger.info(`- Custom pricing (unchanged): ${customPricingTenants.length} tenants`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateFreeProUsersToZero();