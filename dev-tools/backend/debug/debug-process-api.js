require('dotenv').config();
const mongoose = require('mongoose');
const { Process, User } = require('./src/models');

async function debugProcessAPI() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Dein Benutzer
    const user = await User.findOne({ email: 'j.tacke1@web.de' }).populate('tenantId', 'name');
    if (!user) {
      console.log('❌ Benutzer j.tacke1@web.de nicht gefunden');
      return;
    }
    
    console.log('✅ Benutzer-Info:');
    console.log('   Email:', user.email);
    console.log('   Tenant ID:', user.tenantId._id);
    console.log('   Tenant Name:', user.tenantId.name);
    
    // Suche Prozesse für diesen Tenant
    const processes = await Process.find({ tenantId: user.tenantId._id }).sort({ createdAt: -1 });
    
    console.log(`\n📊 Prozesse für Tenant ${user.tenantId.name} (${processes.length}):`);
    
    if (processes.length === 0) {
      console.log('❌ Keine Prozesse gefunden!');
    } else {
      processes.forEach((proc, index) => {
        console.log(`\n   ${index + 1}. Prozess Details:`);
        console.log('      ID:', proc._id);
        console.log('      Status:', proc.status);
        console.log('      Titel:', proc.title || 'KEIN TITEL');
        console.log('      Dateiname:', proc.originalFilename);
        console.log('      Video Pfad:', proc.videoPath || 'KEIN PFAD');
        console.log('      User ID:', proc.userId);
        console.log('      Tenant ID:', proc.tenantId);
        console.log('      Erstellt:', proc.createdAt);
        console.log('      Hat Transkript:', !!proc.transcript?.text);
        console.log('      Tags Anzahl:', proc.tags?.length || 0);
        console.log('      Todo Anzahl:', proc.todoList?.length || 0);
      });
    }
    
    // Simuliere API-Response
    console.log('\n🔍 Simuliere API-Response:');
    const apiResponse = {
      success: true,
      data: {
        processes: processes,
        pagination: {
          total: processes.length,
          page: 1,
          limit: 10,
          pages: Math.ceil(processes.length / 10)
        }
      }
    };
    
    console.log('API Response Structure:', {
      success: apiResponse.success,
      processCount: apiResponse.data.processes.length,
      firstProcess: apiResponse.data.processes[0] ? {
        id: apiResponse.data.processes[0]._id,
        status: apiResponse.data.processes[0].status,
        title: apiResponse.data.processes[0].title
      } : 'Keine Prozesse'
    });
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

debugProcessAPI();