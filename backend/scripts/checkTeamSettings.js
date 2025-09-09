const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function checkTeamSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find lars.koetting's tenant
    const userEmail = 'lars.koetting@3d-composite.de';
    const user = await User.findOne({ email: userEmail }).populate('tenantId');
    
    if (!user) {
      console.log(`User ${userEmail} not found`);
      return;
    }
    
    console.log('\nUser Info:');
    console.log(`- Email: ${user.email}`);
    console.log(`- Account Type: ${user.accountType}`);
    console.log(`- Role: ${user.role}`);
    
    const tenant = user.tenantId;
    console.log('\nTenant Info:');
    console.log(`- Name: ${tenant.name}`);
    console.log(`- Plan: ${tenant.subscription.plan}`);
    console.log(`- Allow Teams: ${tenant.limits.allowTeams}`);
    console.log(`- Current Pro Users: ${tenant.limits.currentProUsers}`);
    
    if (!tenant.limits.allowTeams && tenant.subscription.plan === 'pro') {
      console.log('\n⚠️  Issue found: allowTeams is false but plan is pro!');
      console.log('Fixing...');
      
      tenant.limits.allowTeams = true;
      await tenant.save();
      
      console.log('✅ Fixed! Teams are now enabled.');
    } else if (tenant.limits.allowTeams) {
      console.log('\n✅ Teams are already enabled!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkTeamSettings();