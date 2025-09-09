require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function checkUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    const user = await User.findOne({ email: 'testadmin@processmind.com' }).select('+password').populate('tenantId', 'name subscription');
    
    if (!user) {
      console.log('❌ Benutzer testadmin@processmind.com nicht gefunden');
      return;
    }
    
    console.log('✅ Benutzer gefunden:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.firstName, user.lastName);
    console.log('   Rolle:', user.role);
    console.log('   Aktiv:', user.isActive);
    console.log('   Email verifiziert:', user.emailVerified);
    console.log('   Tenant:', user.tenantId?.name);
    console.log('   Tenant Status:', user.tenantId?.subscription?.status);
    console.log('   Login Attempts:', user.loginAttempts);
    console.log('   Locked until:', user.lockUntil);
    
    // Test Passwort
    const isPasswordValid = await bcrypt.compare('testadmin123', user.password);
    console.log('   Passwort "testadmin123" korrekt:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('⚠️  Versuche andere mögliche Passwörter...');
      const testPasswords = ['password123', 'admin', 'test123', '123456'];
      for (const pwd of testPasswords) {
        const valid = await bcrypt.compare(pwd, user.password);
        if (valid) {
          console.log('   ✅ Korrektes Passwort gefunden:', pwd);
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUser();