const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Direct test endpoint
app.post('/test-process', multer().none(), async (req, res) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Request body:', req.body);
    console.log('Body keys:', Object.keys(req.body || {}));
    
    const Process = require('./src/models/Process');
    
    const processData = {
      tenantId: '68aff5b5c0d654854ea8c56e',
      userId: '68b0656d02d7eb60e8f23a83',
      originalFilename: 'test.mp4',
      status: 'uploaded'
    };
    
    // Add any body fields
    Object.keys(req.body || {}).forEach(key => {
      console.log(`Body field ${key}:`, req.body[key]);
    });
    
    console.log('Creating process with:', processData);
    const process = new Process(processData);
    
    await process.save();
    console.log('Process saved:', process._id);
    
    res.json({ success: true, id: process._id });
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

app.listen(3333, () => {
  console.log('Test server running on port 3333');
});