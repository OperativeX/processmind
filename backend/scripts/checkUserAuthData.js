const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function checkUserAuthData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const userEmail = 'lars.koetting@3d-composite.de';
    
    // Find user with populated tenant
    const user = await User.findOne({ email: userEmail })
      .select('-password')
      .populate({
        path: 'tenantId',
        select: 'name subscription limits billing'
      });
    
    if (!user) {
      console.log(`User ${userEmail} not found`);
      return;
    }
    
    console.log('\n=== User Data (as returned by login) ===');
    console.log('User:', {
      id: user._id,
      email: user.email,
      accountType: user.accountType,
      role: user.role,
      systemRole: user.systemRole,
      isActive: user.isActive
    });
    
    console.log('\nTenant:', {
      id: user.tenantId._id,
      name: user.tenantId.name,
      subscription: user.tenantId.subscription,
      limits: user.tenantId.limits
    });
    
    console.log('\n=== Settings Page Conditions ===');
    const canManageTeam = ['owner', 'admin'].includes(user.role) && 
                         user.accountType === 'pro' && 
                         user.tenantId.subscription.plan === 'pro';
    
    console.log('Condition Checks:');
    console.log(`- Is owner or admin? ${['owner', 'admin'].includes(user.role)} (role: ${user.role})`);
    console.log(`- User account type is pro? ${user.accountType === 'pro'} (accountType: ${user.accountType})`);
    console.log(`- Tenant plan is pro? ${user.tenantId.subscription.plan === 'pro'} (plan: ${user.tenantId.subscription.plan})`);
    console.log(`- Allow teams? ${user.tenantId.limits.allowTeams}`);
    console.log(`\n✅ Can manage team? ${canManageTeam}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUserAuthData();