require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Tenant } = require('./src/models');

async function createTestAdmin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Find the existing tenant
    const tenant = await Tenant.findOne({ name: 'Test Company' });
    if (!tenant) {
      console.log('❌ Test Company tenant not found');
      return;
    }
    
    // Delete existing test admin if exists
    await User.deleteOne({ email: 'testadmin@processmind.com' });
    
    // Create new test admin
    const hashedPassword = await bcrypt.hash('testadmin123', 12);
    
    const admin = await User.create({
      tenantId: tenant._id,
      email: 'testadmin@processmind.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Admin',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      refreshTokens: []
    });
    
    console.log('✅ Neuer Test-Admin erstellt:');
    console.log('   Email: testadmin@processmind.com');
    console.log('   Passwort: testadmin123');
    console.log('   Rolle: owner');
    console.log('   Tenant:', tenant.name);
    
  } catch (error) {
    console.error('Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestAdmin();