const mongoose = require('mongoose');
const ProcessModel = require('../src/models/Process');

async function debugEmbedding() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/process-mind');
    console.log('Connected to MongoDB');

    // Get the latest process
    const latestProcess = await ProcessModel.findOne().sort({ createdAt: -1 });
    
    console.log('\n=== Latest Process ===');
    console.log('ID:', latestProcess._id);
    console.log('Title:', latestProcess.title);
    console.log('Created:', latestProcess.createdAt);
    console.log('Status:', latestProcess.status);
    
    console.log('\n=== Jobs ===');
    console.log('AI Analysis Jobs:', JSON.stringify(latestProcess.jobs.aiAnalysis, null, 2));
    
    console.log('\n=== Embedding ===');
    console.log('Embedding exists:', !!latestProcess.embedding);
    console.log('Embedding is array:', Array.isArray(latestProcess.embedding));
    console.log('Embedding length:', latestProcess.embedding ? latestProcess.embedding.length : 0);
    console.log('Embedding type:', typeof latestProcess.embedding);
    
    if (latestProcess.embedding && latestProcess.embedding.length > 0) {
      console.log('First 5 values:', latestProcess.embedding.slice(0, 5));
    }
    
    // Try to manually set embedding to test
    console.log('\n=== Testing Manual Save ===');
    latestProcess.embedding = new Array(1536).fill(0.1);
    
    try {
      await latestProcess.save();
      console.log('Manual save successful!');
      
      // Reload to verify
      const reloaded = await ProcessModel.findById(latestProcess._id);
      console.log('After reload - Embedding length:', reloaded.embedding ? reloaded.embedding.length : 0);
    } catch (saveError) {
      console.error('Save error:', saveError.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugEmbedding();