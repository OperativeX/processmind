const mongoose = require('mongoose');
require('dotenv').config();

async function debugProcessModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Process = require('./src/models/Process');
    
    // Check if there's any default value or transform on the schema
    const schema = Process.schema;
    console.log('\n=== Schema Path Analysis ===');
    
    // Check _id path
    if (schema.paths._id) {
      console.log('_id path exists:', {
        type: schema.paths._id.instance,
        options: schema.paths._id.options,
        defaultValue: schema.paths._id.defaultValue
      });
    }
    
    // Check for virtuals
    console.log('\n=== Virtual Properties ===');
    const virtuals = schema.virtuals;
    Object.keys(virtuals).forEach(key => {
      console.log(`Virtual: ${key}`);
    });
    
    // Check for plugins that might affect _id
    console.log('\n=== Schema Options ===');
    console.log('Schema options:', schema.options);
    
    // Check for any toJSON transformations
    if (schema.options.toJSON) {
      console.log('toJSON transform:', schema.options.toJSON);
    }
    
    // Try creating a process with a UUID to see what happens
    console.log('\n=== Testing Process Creation ===');
    const testUUID = '5e2c1e70-caae-41d6-8506-ba1c4d28a6b7';
    
    // Test 1: Create with no _id
    try {
      const process1 = new Process({
        tenantId: '68aff5b5c0d654854ea8c56e',
        userId: '68b0656d02d7eb60e8f23a83',
        originalFilename: 'test1.mp4',
        status: 'uploaded'
      });
      console.log('✅ Process created without _id:', process1._id);
    } catch (error) {
      console.log('❌ Error creating process without _id:', error.message);
    }
    
    // Test 2: Create with _id as string (UUID)
    try {
      const process2 = new Process({
        _id: testUUID,
        tenantId: '68aff5b5c0d654854ea8c56e',
        userId: '68b0656d02d7eb60e8f23a83',
        originalFilename: 'test2.mp4',
        status: 'uploaded'
      });
      console.log('✅ Process created with UUID _id:', process2._id);
    } catch (error) {
      console.log('❌ Error creating process with UUID _id:', error.message);
    }
    
    // Test 3: Check if processId field exists
    if (schema.paths.processId) {
      console.log('\n⚠️  processId field exists in schema!', {
        type: schema.paths.processId.instance,
        required: schema.paths.processId.isRequired
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
  }
}

debugProcessModel();