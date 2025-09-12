const mongoose = require('mongoose');
require('dotenv').config();

async function checkLarsAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Tenant = require('../src/models/Tenant');
    const Process = require('../src/models/Process');
    
    const email = 'lars.koetting@3d-composite.de';
    
    console.log(`\n=== ACCOUNT CHECK FOR ${email} ===\n`);
    
    // Check if user exists
    const user = await User.findOne({ email: email })
      .select('-password')
      .populate('tenantId');
    
    if (user) {
      console.log('✅ USER FOUND:');
      console.log({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountType: user.accountType,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        deactivationReason: user.deactivationReason,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        tenantId: user.tenantId?._id,
        tenantName: user.tenantId?.name
      });
      
      if (!user.isActive) {
        console.log('\n⚠️  ACCOUNT IS DEACTIVATED!');
        console.log('Deactivation details:', {
          deactivatedAt: user.deactivatedAt,
          deactivationReason: user.deactivationReason,
          deactivatedBy: user.deactivatedBy
        });
      }
    } else {
      console.log('❌ USER NOT FOUND IN DATABASE');
      
      // Check for any related data
      console.log('\n=== CHECKING FOR RELATED DATA ===');
      
      // Check all tenants for any reference
      const tenants = await Tenant.find({
        $or: [
          { domain: '3d-composite' },
          { name: /3d.*composite/i }
        ]
      });
      
      if (tenants.length > 0) {
        console.log('\nRelated tenants found:');
        tenants.forEach(t => {
          console.log(`- ${t.name} (${t.domain}) - ID: ${t._id}`);
        });
        
        // Check for other users in same tenant
        for (const tenant of tenants) {
          const tenantUsers = await User.find({ tenantId: tenant._id })
            .select('email role accountType isActive');
          
          if (tenantUsers.length > 0) {
            console.log(`\nUsers in tenant "${tenant.name}":`);
            tenantUsers.forEach(u => {
              console.log(`  - ${u.email} (${u.role}, ${u.accountType}) - Active: ${u.isActive}`);
            });
          }
        }
      } else {
        console.log('\nNo related tenants found');
      }
      
      // Check for any processes that might reference this email
      const processes = await Process.find({
        'metadata.userEmail': email
      }).count();
      
      console.log(`\nProcesses with this email: ${processes}`);
    }
    
    console.log('\n=== RECOVERY OPTIONS ===');
    if (!user) {
      console.log('1. The user can register again with the same email');
      console.log('2. If you have database backups, you can restore the user data');
      console.log('3. Contact the user to understand if they deleted their account');
    } else if (!user.isActive) {
      console.log('1. Reactivate the account by setting isActive = true');
      console.log('2. Clear deactivation fields');
      console.log('3. Ensure the tenant subscription is active');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkLarsAccount();