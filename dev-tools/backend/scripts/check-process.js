const mongoose = require('mongoose');
const { Process } = require('./src/models');

async function checkLatestProcess() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    
    const latestProcess = await Process.findById('68bea5721e112481cb8035f2');
    
    if (!latestProcess) {
      console.log('Process not found');
      return;
    }
    
    console.log('=== PROZESS STATUS ===');
    console.log('ID:', latestProcess._id);
    console.log('Status:', latestProcess.status);
    console.log('Processing Details:', latestProcess.processingDetails);
    console.log('Title:', latestProcess.title);
    console.log('Tags:', latestProcess.tags?.length || 0, 'tags');
    console.log('TodoList:', latestProcess.todoList?.length || 0, 'items');
    console.log('Transcript exists:', !!latestProcess.transcript?.text);
    console.log('Jobs:', Object.keys(latestProcess.jobs || {}));
    console.log('Errors:', latestProcess.errors?.length || 0);
    console.log('Created:', latestProcess.createdAt);
    console.log('Updated:', latestProcess.updatedAt);
    
    if (latestProcess.errors?.length > 0) {
      console.log('\nERRORS:');
      latestProcess.errors.forEach(e => console.log(' -', e.stage, ':', e.error));
    }
    
    // Check job details
    if (latestProcess.jobs) {
      console.log('\nJOB IDs:');
      Object.entries(latestProcess.jobs).forEach(([key, value]) => {
        console.log(' -', key, ':', value);
      });
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLatestProcess();