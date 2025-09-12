const mongoose = require('mongoose');
require('dotenv').config();

async function recoverLarsAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Tenant = require('../src/models/Tenant');
    
    const email = 'lars.koetting@3d-composite.de';
    
    console.log(`\n=== RECOVERY PROCESS FOR ${email} ===\n`);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      console.log('⚠️  User already exists in database!');
      console.log('Current status:', {
        isActive: existingUser.isActive,
        deactivationReason: existingUser.deactivationReason
      });
      
      if (!existingUser.isActive) {
        console.log('\n📝 To reactivate this account, uncomment and run the reactivation code below');
      }
      return;
    }
    
    // Find the appropriate tenant
    console.log('Finding appropriate tenant...');
    const tenant = await Tenant.findOne({ 
      name: '3d Composite',
      _id: '68b859ed11be1e43c02b8265'
    });
    
    if (!tenant) {
      console.log('❌ Could not find 3d Composite tenant');
      return;
    }
    
    console.log('✅ Found tenant:', tenant.name);
    
    // Check tenant's current user count
    const currentUsers = await User.countDocuments({ 
      tenantId: tenant._id,
      isActive: true 
    });
    
    console.log(`Current active users in tenant: ${currentUsers}`);
    console.log(`Tenant user limit: ${tenant.limits.maxUsers}`);
    
    if (currentUsers >= tenant.limits.maxUsers) {
      console.log('⚠️  WARNING: Tenant has reached user limit!');
    }
    
    console.log('\n=== RECOVERY OPTIONS ===');
    console.log('\nOPTION 1: User can register again themselves');
    console.log('- Go to the registration page');
    console.log('- Use email: lars.koetting@3d-composite.de');
    console.log('- They will need to set a new password');
    
    console.log('\nOPTION 2: Create user programmatically (requires password)');
    console.log('Uncomment the code below to create the user:\n');
    
    console.log(`/*
    // Create new user
    const bcrypt = require('bcryptjs');
    const newPassword = 'temporary_password_123'; // CHANGE THIS!
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const newUser = new User({
      email: '${email}',
      password: hashedPassword,
      firstName: 'Lars',
      lastName: 'Kötting',
      tenantId: tenant._id,
      role: 'user', // or 'owner' if they should be owner
      accountType: tenant.subscription.plan || 'free',
      emailVerified: true,
      isActive: true
    });
    
    await newUser.save();
    console.log('✅ User created successfully!');
    console.log('Email:', newUser.email);
    console.log('Temporary password:', newPassword);
    console.log('⚠️  IMPORTANT: Tell the user to change their password after first login!');
    */`);
    
    console.log('\nOPTION 3: If you have database backups');
    console.log('- Restore the user document from backup');
    console.log('- This preserves all original data including password hash');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

recoverLarsAccount();