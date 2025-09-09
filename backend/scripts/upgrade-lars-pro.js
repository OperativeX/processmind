const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

async function upgradeLarsToProUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const userEmail = 'lars.koetting@3d-composite.de';
    
    // Find user
    console.log(`\nFinding user ${userEmail}...`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ User not found!');
      console.log('\nSearching for similar emails...');
      const users = await User.find({ 
        email: { $regex: 'lars.koetting', $options: 'i' } 
      }).select('email accountType plan_type');
      
      if (users.length > 0) {
        console.log('Found similar users:');
        users.forEach(u => console.log(`  - ${u.email} (${u.accountType || u.plan_type})`));
      } else {
        console.log('No similar users found.');
      }
      return;
    }
    
    console.log(`Found user: ${user.email}`);
    console.log(`Current account type: ${user.accountType || user.plan_type}`);
    console.log(`Tenant ID: ${user.tenantId}`);
    
    // Check if already Pro
    if (user.accountType === 'pro' || user.plan_type === 'pro') {
      console.log('✅ User is already a Pro user!');
      return;
    }
    
    // Upgrade user to Pro
    console.log('\nUpgrading user to Pro...');
    user.accountType = 'pro';
    user.plan_type = 'pro';
    
    // Reset usage limits since Pro users have unlimited
    user.usage = {
      processesThisMonth: 0,
      storageUsedMB: user.usage?.storageUsedMB || 0,
      lastResetDate: new Date()
    };
    
    // Reset monthly uploads
    user.monthly_uploads_used = 0;
    user.uploads_reset_date = new Date();
    
    // Reset usage alerts
    if (user.usage_alerts_sent) {
      user.usage_alerts_sent.upload_80_percent = false;
      user.usage_alerts_sent.storage_80_percent = false;
    }
    
    await user.save();
    console.log('✅ User upgraded to Pro successfully!');
    
    // Verify the upgrade
    const verifiedUser = await User.findOne({ email: userEmail });
    console.log(`\n✨ Verification: ${verifiedUser.email} is now ${verifiedUser.accountType || verifiedUser.plan_type}`);
    console.log('\n🎉 Upgrade complete!');
    console.log(`${userEmail} now has a Pro account with unlimited uploads and storage.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

upgradeLarsToProUser();