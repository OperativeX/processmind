const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function directUpgrade() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const tenantId = '68b859ed11be1e43c02b8265';
    const userEmail = 'lars.koetting@3d-composite.de';
    
    // Find and upgrade tenant
    console.log(`\nFinding tenant ${tenantId}...`);
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      console.log('Tenant not found!');
      return;
    }
    
    console.log(`Found tenant: ${tenant.name}`);
    console.log(`Current plan: ${tenant.subscription.plan}`);
    
    // Upgrade tenant to Pro
    console.log('\nUpgrading tenant to Pro...');
    tenant.subscription.plan = 'pro';
    tenant.limits.allowTeams = true;
    await tenant.save();
    console.log('✅ Tenant upgraded to Pro');
    
    // Find and upgrade user
    console.log(`\nFinding user ${userEmail}...`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('User not found!');
      return;
    }
    
    console.log(`Found user: ${user.email}`);
    console.log(`Current account type: ${user.accountType}`);
    
    // Upgrade user to Pro
    console.log('\nUpgrading user to Pro...');
    user.accountType = 'pro';
    
    // Reset usage limits since Pro users have unlimited
    user.usage = {
      processesThisMonth: 0,
      storageUsedMB: user.usage?.storageUsedMB || 0,
      lastResetDate: new Date()
    };
    
    await user.save();
    console.log('✅ User upgraded to Pro');
    
    console.log('\n🎉 Upgrade complete!');
    console.log(`${userEmail} now has a Pro account with unlimited uploads and storage.`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

directUpgrade();