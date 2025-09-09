const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function checkLarsSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const userEmail = 'lars.koetting@3d-composite.de';
    
    // Find user
    console.log(`\nChecking user ${userEmail}...`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('📋 User Status:');
    console.log(`  ✓ Email: ${user.email}`);
    console.log(`  ✓ Account Type: ${user.accountType || user.plan_type}`);
    console.log(`  ✓ Plan Type: ${user.plan_type}`);
    console.log(`  ✓ Role: ${user.role}`);
    console.log(`  ✓ Tenant ID: ${user.tenantId}`);
    
    // Find tenant
    console.log(`\nChecking tenant ${user.tenantId}...`);
    const tenant = await Tenant.findById(user.tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant not found!');
      return;
    }
    
    console.log('\n📋 Tenant Status:');
    console.log(`  ✓ Name: ${tenant.name}`);
    console.log(`  ✓ Subscription Plan: ${tenant.subscription.plan}`);
    console.log(`  ✓ Subscription Status: ${tenant.subscription.status}`);
    console.log(`  ✓ Allow Teams: ${tenant.limits.allowTeams}`);
    console.log(`  ✓ Purchased Licenses: ${tenant.limits.purchasedLicenses}`);
    console.log(`  ✓ Active Team Members: ${tenant.limits.activeTeamMembers}`);
    console.log(`  ✓ Is Active: ${tenant.isActive}`);
    
    // Check what's needed for Teams tab
    console.log('\n🎯 Teams Tab Requirements Check:');
    console.log(`  User Account Type: ${user.accountType === 'pro' ? '✅ Pro' : '❌ Free'}`);
    console.log(`  User Plan Type: ${user.plan_type === 'pro' ? '✅ Pro' : '❌ Free'}`);
    console.log(`  Tenant Plan: ${tenant.subscription.plan === 'pro' ? '✅ Pro' : '❌ Free'}`);
    console.log(`  Allow Teams: ${tenant.limits.allowTeams ? '✅ Enabled' : '❌ Disabled'}`);
    
    // Check if everything is correct for Teams access
    const userIsPro = user.accountType === 'pro' || user.plan_type === 'pro';
    const tenantIsPro = tenant.subscription.plan === 'pro';
    const teamsAllowed = tenant.limits.allowTeams;
    
    if (userIsPro && tenantIsPro && teamsAllowed) {
      console.log('\n✅ All settings are correct for Teams access!');
    } else {
      console.log('\n❌ Teams access requirements not met:');
      if (!userIsPro) console.log('  - User needs Pro account');
      if (!tenantIsPro) console.log('  - Tenant needs Pro subscription');
      if (!teamsAllowed) console.log('  - Teams need to be enabled on tenant');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkLarsSettings();