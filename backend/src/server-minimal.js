const express = require('express');
const cors = require('cors');

// Minimal server for Coolify deployment
// This starts without database connections for initial deployment

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    redis: process.env.REDIS_URL ? 'configured' : 'not configured',
    mongodb: process.env.MONGODB_URI ? 'configured' : 'not configured'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ProcessMind Backend - Minimal Mode',
    status: 'running',
    note: 'Please configure REDIS_URL and MONGODB_URI environment variables'
  });
});

// Error info endpoint
app.get('/info', (req, res) => {
  res.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || 'not set',
      REDIS_URL: process.env.REDIS_URL ? 'set' : 'NOT SET - Required!',
      MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'NOT SET - Required!',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'NOT SET - Required!',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'NOT SET - Required!'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ProcessMind Backend (Minimal) running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Environment info at http://localhost:${PORT}/info`);
  
  if (!process.env.REDIS_URL || !process.env.MONGODB_URI) {
    console.warn('WARNING: Database URLs not configured. This is minimal mode only.');
    console.warn('Set REDIS_URL and MONGODB_URI to enable full functionality.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});