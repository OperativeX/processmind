const mongoose = require('mongoose');
require('dotenv').config();

async function testProcessCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Process = require('./src/models/Process');
    
    // Try to create a simple process
    const testData = {
      tenantId: '68aff5b5c0d654854ea8c56e',
      userId: '68b0656d02d7eb60e8f23a83',
      originalFilename: 'test.mp4',
      status: 'uploaded',
      files: {
        original: {
          path: '/test/path.mp4',
          size: 1000000,
          duration: 60,
          format: 'mp4',
          storageType: 'local'
        }
      },
      transcript: {
        language: 'en',
        segments: []
      },
      metadata: {
        uploadDir: '/test/upload',
        tenantDir: '68aff5b5c0d654854ea8c56e'
      }
    };
    
    console.log('Creating process with data:', JSON.stringify(testData, null, 2));
    
    const processDoc = new Process(testData);
    console.log('Process created, _id:', processDoc._id);
    console.log('Process _id type:', typeof processDoc._id);
    
    await processDoc.save();
    console.log('Process saved successfully!');
    console.log('Saved _id:', processDoc._id);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
  }
}

testProcessCreation();