#!/usr/bin/env node

/**
 * Generate a test JWT token directly
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

async function generateTestToken() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('./src/models/User');
    const Tenant = require('./src/models/Tenant');
    
    // Find test user
    const user = await User.findOne({ email: 'testadmin@processmind.com' });
    if (!user) {
      console.error('Test user not found');
      process.exit(1);
    }
    
    // Get tenant
    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      console.error('Tenant not found');
      process.exit(1);
    }
    
    // Generate token with same structure as auth service
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      tenantId: tenant._id.toString(),
      role: user.role || 'user'
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Generated test token');
    console.log('\nToken:', token);
    console.log('\nUser ID:', user._id);
    console.log('Tenant ID:', tenant._id);
    console.log('Tenant Name:', tenant.name);
    
    // Update .env.test
    const fs = require('fs');
    const envPath = './.env.test';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent = envContent.replace(/AUTH_TOKEN=.*/, `AUTH_TOKEN=${token}`);
    envContent = envContent.replace(/TEST_TENANT_ID=.*/, `TEST_TENANT_ID=${tenant._id}`);
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Updated .env.test');
    
    await mongoose.disconnect();
    
    console.log('\n🚀 Ready to run: source .env.test && node test-video-pipeline.js');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

generateTestToken();