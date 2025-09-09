require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Tenant } = require('./src/models');

async function createJonathanUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    console.log('✅ Mit MongoDB verbunden');
    
    // Existing tenant finden
    let tenant = await Tenant.findOne({ name: 'Test Company' });
    if (!tenant) {
      console.log('Erstelle neuen Tenant...');
      tenant = await Tenant.create({
        name: 'Jonathan Test Tenant',
        domain: 'jonathan-test',
        settings: {
          maxUsers: 10,
          maxStorageGB: 100,
          maxProcessesPerMonth: 1000,
          allowedFeatures: ['video-upload', 'transcription', 'ai-analysis', 'sharing']
        },
        subscription: {
          plan: 'premium',
          status: 'active',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          seats: 10
        },
        isActive: true
      });
    }
    
    // Lösche existierenden Benutzer falls vorhanden
    await User.deleteOne({ email: 'j.tacke1@web.de' });
    console.log('🗑️  Alte Benutzerdaten gelöscht (falls vorhanden)');
    
    // Passwort hashen - einfaches Passwort
    const plainPassword = 'jonathan123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10); // Verwende bcrypt.hash statt genSalt
    
    console.log('🔐 Passwort gehashed');
    
    // Neuen Benutzer erstellen
    const user = new User({
      tenantId: tenant._id,
      email: 'j.tacke1@web.de',
      password: hashedPassword,
      firstName: 'Jonathan',
      lastName: 'Tacke',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      loginAttempts: 0,
      refreshTokens: []
    });
    
    await user.save();
    console.log('✅ Benutzer erfolgreich erstellt!');
    
    // Test das Passwort sofort
    const testResult = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('🧪 Passwort-Test:', testResult);
    
    console.log('\n🎉 FERTIG! Deine Login-Daten:');
    console.log('📧 Email: j.tacke1@web.de');
    console.log('🔑 Passwort: jonathan123');
    console.log('👤 Rolle: owner (volle Berechtigung)');
    console.log('🏢 Tenant:', tenant.name);
    console.log('\n🌐 Gehe zu: http://localhost:5001/login');
    
  } catch (error) {
    console.error('❌ Fehler:', error);
  } finally {
    process.exit(0);
  }
}

createJonathanUser();