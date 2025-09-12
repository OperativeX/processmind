require('dotenv').config();
const mongoose = require('mongoose');
const { User, Tenant } = require('./src/models');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find or create test tenant
    let tenant = await Tenant.findOne({ name: 'Test Tenant' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Test Tenant',
        domain: 'test-tenant',
        isActive: true,
        settings: {}
      });
      console.log('Created test tenant:', tenant._id);
    }

    // Delete existing test user if exists
    await User.deleteOne({ email: 'test@example.com' });

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    const user = await User.create({
      tenantId: tenant._id,
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      accountType: 'free',
      isActive: true,
      emailVerified: true
    });

    console.log('Created test user:', {
      email: user.email,
      tenantId: tenant._id,
      accountType: user.accountType
    });

    await mongoose.disconnect();
    console.log('Test user created successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();