const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Error handling
app.use(errorHandler);

// Start server without DB connections for now
const server = app.listen(PORT, () => {
  logger.info(`🚀 Minimal Process-Mind Backend server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`Test with: curl http://localhost:${PORT}/health`);
  
  server.timeout = 20 * 60 * 1000;
  server.headersTimeout = 21 * 60 * 1000;
  server.requestTimeout = 20 * 60 * 1000;
  server.keepAliveTimeout = 20 * 60 * 1000;
});