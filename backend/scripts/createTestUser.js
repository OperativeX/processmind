const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find Test Company tenant
    const tenant = await db.collection('tenants').findOne({ name: 'Test Company' });
    
    if (!tenant) {
      console.error('Test Company tenant not found!');
      process.exit(1);
    }
    
    console.log('Found Test Company tenant:', tenant._id);
    
    // Create new user
    const email = 'testuser@test.com';
    const password = 'Test123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    
    if (existingUser) {
      console.log('User already exists, updating password...');
      await db.collection('users').updateOne(
        { email },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Create new user
      const newUser = {
        email,
        password: hashedPassword,
        tenantId: tenant._id,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('users').insertOne(newUser);
      console.log('Created new user');
    }
    
    console.log('\n✅ User created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Tenant:', tenant.name);
    console.log('\nYou can now login with these credentials.');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();