require('dotenv').config();
const mongoose = require('mongoose');
const { Process } = require('./src/models');

async function fixExistingProcess() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // Finde deinen Prozess
    const processDoc = await Process.findById('68b06901aefd4987c43f12bd');
    if (!processDoc) {
      console.log('❌ Prozess nicht gefunden');
      return;
    }
    
    console.log('🔧 Aktueller Status:', processDoc.status);
    console.log('🔧 Aktueller Titel:', processDoc.title);
    
    // Setze einen sinnvollen Titel basierend auf dem Dateinamen
    const filename = processDoc.originalFilename || 'Unknown';
    const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    processDoc.title = `Video: ${baseName}`;
    
    // Füge Beispiel-Tags hinzu (basierend auf Dateinamen)
    processDoc.tags = ['video', 'uploaded', 'mobile'];
    
    // Füge eine Beispiel-Todo-Liste hinzu
    processDoc.todoList = [
      {
        task: 'Review uploaded video content',
        timestamp: 0,
        completed: false
      },
      {
        task: 'Add detailed description',
        timestamp: 30,
        completed: false
      }
    ];
    
    // Setze Status auf completed
    processDoc.status = 'completed';
    
    await processDoc.save();
    
    console.log('✅ Prozess aktualisiert:');
    console.log('   Neuer Titel:', processDoc.title);
    console.log('   Status:', processDoc.status);
    console.log('   Tags:', processDoc.tags);
    console.log('   Todos:', processDoc.todoList.length);
    
    console.log('\n🎉 Jetzt solltest du den Prozess im Dashboard sehen!');
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    process.exit(0);
  }
}

fixExistingProcess();