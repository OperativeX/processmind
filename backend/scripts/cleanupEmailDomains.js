#!/usr/bin/env node
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { EmailDomain } = require('../src/models');
const logger = require('../src/utils/logger');

async function cleanupEmailDomains() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Find and delete the 3d-composite.de domain mapping
    const domain = '3d-composite.de';
    
    const existingDomain = await EmailDomain.findOne({ domain: domain });
    
    if (existingDomain) {
      logger.info('Found EmailDomain entry:', {
        domain: existingDomain.domain,
        tenantId: existingDomain.tenantId,
        tenantName: existingDomain.tenantName,
        isActive: existingDomain.isActive
      });

      // Delete the entry
      await EmailDomain.deleteOne({ domain: domain });
      logger.info(`Successfully deleted EmailDomain entry for ${domain}`);
    } else {
      logger.info(`No EmailDomain entry found for ${domain}`);
    }

    // Optional: List all non-public domain mappings
    const allDomains = await EmailDomain.find({ 
      isPublicDomain: false,
      isActive: true 
    }).select('domain tenantName tenantId');
    
    logger.info('All active non-public domain mappings:', allDomains.length);
    allDomains.forEach(d => {
      logger.info(`  - ${d.domain} -> ${d.tenantName} (${d.tenantId})`);
    });

  } catch (error) {
    logger.error('Cleanup error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupEmailDomains();
}

module.exports = cleanupEmailDomains;