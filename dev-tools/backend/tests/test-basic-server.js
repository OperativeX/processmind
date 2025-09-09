const express = require('express');
require('dotenv').config();

console.log('Starting basic server without services...');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      port: PORT,
      mongodb: process.env.MONGODB_URI ? 'configured' : 'not configured',
      redis: process.env.REDIS_URL ? 'configured' : 'not configured',
      s3: process.env.S3_BUCKET ? 'configured' : 'not configured'
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Basic server running on port ${PORT}`);
  console.log(`Test with: curl http://localhost:${PORT}/health`);
});