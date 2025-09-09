require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function resetPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    const user = await User.findOne({ email: 'testadmin@processmind.com' });
    if (!user) {
      console.log('❌ Benutzer nicht gefunden');
      return;
    }
    
    // Neues Passwort setzen
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Benutzer aktualisieren
    user.password = hashedPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    
    console.log('✅ Passwort zurückgesetzt für:', user.email);
    console.log('   Neues Passwort:', newPassword);
    console.log('   Login-Versuche zurückgesetzt: 0');
    
    // Test des neuen Passworts
    const isValid = await bcrypt.compare(newPassword, user.password);
    console.log('   Passwort-Test erfolgreich:', isValid);
    
  } catch (error) {
    console.error('Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

resetPassword();