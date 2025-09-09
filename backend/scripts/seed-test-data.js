require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Import models
const Tenant = require('../src/models/Tenant');
const User = require('../src/models/User');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('✅ Connected to MongoDB');

    // Check if test tenant already exists
    let tenant = await Tenant.findOne({ domain: 'test' });
    
    if (!tenant) {
      // Create test tenant
      tenant = await Tenant.create({
        name: 'Test Company',
        domain: 'test',
        settings: {
          maxUsers: 10,
          maxStorageGB: 100,
          maxProcessesPerMonth: 1000,
          allowedFeatures: ['video-upload', 'transcription', 'ai-analysis', 'sharing']
        },
        subscription: {
          plan: 'premium',
          status: 'active',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          seats: 10
        },
        isActive: true
      });
      console.log('✅ Created test tenant:', tenant.name);
    } else {
      console.log('ℹ️  Test tenant already exists');
    }

    // Check if test user already exists
    let user = await User.findOne({ email: 'test@example.com' });
    
    if (!user) {
      // Hash password
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // Create test user
      user = await User.create({
        tenantId: tenant._id,
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        refreshTokens: []
      });
      console.log('✅ Created test user:', user.email);
      console.log('\n📧 Login credentials:');
      console.log('   Email: test@example.com');
      console.log('   Password: password123');
    } else {
      console.log('ℹ️  Test user already exists');
      console.log('\n📧 Login credentials:');
      console.log('   Email: test@example.com');
      console.log('   Password: password123');
    }

    // Create admin user if needed
    let adminUser = await User.findOne({ email: 'admin@example.com' });
    
    if (!adminUser) {
      const hashedAdminPassword = await bcrypt.hash('admin123', 10);
      
      adminUser = await User.create({
        tenantId: tenant._id,
        email: 'admin@example.com',
        password: hashedAdminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'owner', // Owner has full access to tenant
        isActive: true,
        emailVerified: true,
        refreshTokens: []
      });
      console.log('\n✅ Created admin user:', adminUser.email);
      console.log('   Email: admin@example.com');
      console.log('   Password: admin123');
    }

    console.log('\n✅ Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();