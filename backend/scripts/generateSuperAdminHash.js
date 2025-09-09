#!/usr/bin/env node

/**
 * Script to generate a password hash for super admin
 * Usage: node scripts/generateSuperAdminHash.js <password>
 */

const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = process.argv[2];
  
  if (!password) {
    console.error('Usage: node scripts/generateSuperAdminHash.js <password>');
    process.exit(1);
  }

  try {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    
    console.log('\n=== Super Admin Password Hash Generated ===\n');
    console.log('Add these lines to your .env file:');
    console.log('');
    console.log(`SUPER_ADMIN_EMAIL=admin@processmind.com`);
    console.log(`SUPER_ADMIN_PASSWORD_HASH=${hash}`);
    console.log(`SUPER_ADMIN_SECRET=${require('crypto').randomBytes(32).toString('hex')}`);
    console.log(`SUPER_ADMIN_TOKEN_EXPIRES=4h`);
    console.log('');
    console.log('Optional IP whitelist (comma-separated):');
    console.log('# SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,192.168.1.100');
    console.log('\n=========================================\n');
    
  } catch (error) {
    console.error('Error generating hash:', error);
    process.exit(1);
  }
}

generateHash();