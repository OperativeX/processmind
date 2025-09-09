require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Tenant } = require('./src/models');

async function createWorkingUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Finde Tenant
    const tenant = await Tenant.findOne({ name: 'Test Company' });
    if (!tenant) {
      console.log('❌ Tenant nicht gefunden');
      return;
    }
    
    // Lösche existierenden Benutzer
    await User.deleteOne({ email: 'j.tacke1@web.de' });
    
    // Verwende EXAKT den gleichen Prozess wie im Seed-Script
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10); // Exakt wie im Seed-Script
    
    // Erstelle Benutzer mit dem exakt gleichen Schema wie im Seed-Script
    const user = await User.create({
      tenantId: tenant._id,
      email: 'j.tacke1@web.de',
      password: hashedPassword,
      firstName: 'Jonathan',
      lastName: 'Tacke',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      refreshTokens: []
    });
    
    console.log('✅ Benutzer erstellt mit User.create()');
    
    // Sofortiger Test
    const testUser = await User.findOne({ email: 'j.tacke1@web.de' }).select('+password');
    const passwordWorks = await bcrypt.compare(password, testUser.password);
    
    console.log('🧪 Passwort-Test nach Erstellung:', passwordWorks);
    
    if (passwordWorks) {
      console.log('\n🎉 ERFOLG! Deine Login-Daten:');
      console.log('📧 Email: j.tacke1@web.de');
      console.log('🔑 Passwort: test123');
      console.log('👤 Rolle: owner');
      console.log('\n🌐 Gehe zu: http://localhost:5001/login');
    } else {
      console.log('❌ Passwort-Test fehlgeschlagen - etwas ist immer noch falsch');
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error);
  } finally {
    process.exit(0);
  }
}

createWorkingUser();