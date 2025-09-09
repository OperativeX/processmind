const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function findUserTenant() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find user by email
    const userEmail = 'lars.koetting@3d-composite.de';
    const user = await User.findOne({ email: userEmail }).populate('tenantId');
    
    if (!user) {
      console.log(`User ${userEmail} not found`);
      return;
    }
    
    console.log('\nUser found:');
    console.log(`- Email: ${user.email}`);
    console.log(`- Account Type: ${user.accountType}`);
    console.log(`- User ID: ${user._id}`);
    console.log(`- Tenant ID: ${user.tenantId?._id || 'No tenant'}`);
    console.log(`- Tenant Name: ${user.tenantId?.name || 'No tenant'}`);
    console.log(`- Tenant Plan: ${user.tenantId?.subscription?.plan || 'No tenant'}`);
    
    if (user.accountType === 'free') {
      console.log('\nUser usage:');
      console.log(`- Processes this month: ${user.usage?.processesThisMonth || 0}`);
      console.log(`- Storage used: ${(user.usage?.storageUsedMB || 0) / 1024} GB`);
    }
    
    console.log('\n✅ To upgrade this user to Pro, use the tenant ID above');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

findUserTenant();