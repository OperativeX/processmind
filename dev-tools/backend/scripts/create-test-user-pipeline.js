require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Tenant } = require('./src/models');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find or create tenant
    let tenant = await Tenant.findOne({ name: 'Pipeline Test Company' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Pipeline Test Company',
        domain: 'pipeline-test',
        isActive: true,
        settings: {
          maxUsers: 10,
          maxStorage: 1073741824, // 1GB
          features: {
            advancedAnalytics: true,
            apiAccess: true,
            customBranding: false
          }
        }
      });
      console.log('✅ Tenant created');
    } else {
      console.log('✅ Tenant found');
    }
    
    // Delete existing user if exists
    await User.deleteOne({ email: 'pipeline@test.com' });
    
    // Create user
    const user = new User({
      tenantId: tenant._id,
      email: 'pipeline@test.com',
      password: 'Test1234!',
      firstName: 'Pipeline',
      lastName: 'Test',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      refreshTokens: []
    });
    
    // Save user (this will trigger the pre-save hook that hashes the password)
    await user.save();
    console.log('✅ User created');
    
    // Test login
    const testUser = await User.findOne({ email: 'pipeline@test.com' }).select('+password');
    const isMatch = await testUser.comparePassword('Test1234!');
    
    console.log('🧪 Password test:', isMatch);
    
    if (isMatch) {
      console.log('\n🎉 SUCCESS! Test user created:');
      console.log('📧 Email: pipeline@test.com');
      console.log('🔑 Password: Test1234!');
      console.log('🏢 Tenant: Pipeline Test Company');
      console.log('👤 Role: owner');
    } else {
      console.log('❌ Password test failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestUser();