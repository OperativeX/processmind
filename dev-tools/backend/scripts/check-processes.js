require('dotenv').config();
const mongoose = require('mongoose');
const { Process, User } = require('./src/models');

async function checkProcesses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Finde deinen Benutzer
    const user = await User.findOne({ email: 'j.tacke1@web.de' });
    if (!user) {
      console.log('❌ Benutzer nicht gefunden');
      return;
    }
    
    console.log('✅ Benutzer gefunden:');
    console.log('   Email:', user.email);
    console.log('   Tenant ID:', user.tenantId);
    
    // Suche nach Prozessen für deinen Tenant
    const processes = await Process.find({ tenantId: user.tenantId }).sort({ createdAt: -1 });
    
    console.log(`\n📊 Gefundene Prozesse (${processes.length}):`);
    
    if (processes.length === 0) {
      console.log('❌ Keine Prozesse gefunden für diesen Tenant');
      
      // Prüfe alle Prozesse in der DB
      const allProcesses = await Process.find({}).sort({ createdAt: -1 });
      console.log(`\n🔍 Alle Prozesse in der Datenbank (${allProcesses.length}):`);
      
      allProcesses.forEach((proc, index) => {
        console.log(`   ${index + 1}. ID: ${proc._id}`);
        console.log(`      Tenant: ${proc.tenantId}`);
        console.log(`      Status: ${proc.status}`);
        console.log(`      Titel: ${proc.title || 'Kein Titel'}`);
        console.log(`      Dateiname: ${proc.originalFilename || 'Kein Dateiname'}`);
        console.log(`      Erstellt: ${proc.createdAt}`);
        console.log('');
      });
      
    } else {
      processes.forEach((proc, index) => {
        console.log(`   ${index + 1}. ID: ${proc._id}`);
        console.log(`      Status: ${proc.status}`);
        console.log(`      Titel: ${proc.title || 'Kein Titel'}`);
        console.log(`      Dateiname: ${proc.originalFilename || 'Kein Dateiname'}`);
        console.log(`      Video Pfad: ${proc.videoPath || 'Kein Pfad'}`);
        console.log(`      Transkript: ${proc.transcript ? 'Vorhanden' : 'Nicht vorhanden'}`);
        console.log(`      Tags: ${proc.tags?.length || 0} Tags`);
        console.log(`      Erstellt: ${proc.createdAt}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

checkProcesses();