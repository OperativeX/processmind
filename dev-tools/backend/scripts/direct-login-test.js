require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function directTest() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Lade den Benutzer
    const user = await User.findOne({ email: 'j.tacke1@web.de' }).select('+password').populate('tenantId', 'name subscription');
    
    if (!user) {
      console.log('❌ Benutzer nicht gefunden');
      return;
    }
    
    console.log('✅ Benutzer gefunden:');
    console.log('   Email:', user.email);
    console.log('   Aktiv:', user.isActive);
    console.log('   Tenant:', user.tenantId?.name);
    console.log('   Tenant Status:', user.tenantId?.subscription?.status);
    console.log('   Hat Passwort:', !!user.password);
    console.log('   Login Attempts:', user.loginAttempts);
    console.log('   Locked:', user.isLocked);
    
    // Teste Passwort direkt mit bcrypt
    const directTest = await bcrypt.compare('jonathan123', user.password);
    console.log('   Direkter bcrypt Test:', directTest);
    
    // Teste mit der User-Methode
    const userMethodTest = await user.comparePassword('jonathan123');
    console.log('   User comparePassword Test:', userMethodTest);
    
    // Teste auch andere mögliche Passwörter
    const testPasswords = ['jonathan123', 'Jonathan123', 'JONATHAN123', 'password123', 'admin123'];
    for (const pwd of testPasswords) {
      const result = await user.comparePassword(pwd);
      if (result) {
        console.log(`   ✅ GEFUNDEN! Passwort: ${pwd}`);
      }
    }
    
  } catch (error) {
    console.error('Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

directTest();