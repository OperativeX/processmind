require('dotenv').config();
const mongoose = require('mongoose');
const { User, Tenant } = require('./src/models');

async function createFinalUser() {
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
    
    // WICHTIG: Gib das Passwort im KLARTEXT ein!
    // Das Pre-save Middleware wird es automatisch hashen
    const plainPassword = 'jonathan123'; // Mindestens 8 Zeichen
    
    const user = new User({
      tenantId: tenant._id,
      email: 'j.tacke1@web.de',
      password: plainPassword, // KLARTEXT! Pre-save Middleware hasht es
      firstName: 'Jonathan',
      lastName: 'Tacke',
      role: 'owner',
      isActive: true,
      emailVerified: true,
      refreshTokens: []
    });
    
    await user.save(); // Hier wird das Pre-save Middleware ausgeführt
    
    console.log('✅ Benutzer mit Pre-save Middleware erstellt');
    
    // Test das Passwort
    const testUser = await User.findOne({ email: 'j.tacke1@web.de' }).select('+password');
    const passwordWorks = await testUser.comparePassword(plainPassword);
    
    console.log('🧪 Passwort-Test:', passwordWorks);
    
    if (passwordWorks) {
      console.log('\n🎉 ERFOLG! Deine Login-Daten:');
      console.log('📧 Email: j.tacke1@web.de');
      console.log('🔑 Passwort: jonathan123');
      console.log('👤 Rolle: owner');
      console.log('\n🌐 Login-URL: http://localhost:5001/login');
      console.log('🌐 Oder direkt: http://localhost:5001');
    } else {
      console.log('❌ Immer noch nicht funktionsfähig');
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error);
  } finally {
    process.exit(0);
  }
}

createFinalUser();