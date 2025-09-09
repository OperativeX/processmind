console.log('1. Starting debug server...');
require('dotenv').config();
console.log('2. Dotenv loaded');

const express = require('express');
console.log('3. Express loaded');

const cors = require('cors');
console.log('4. CORS loaded');

const helmet = require('helmet');
console.log('5. Helmet loaded');

const compression = require('compression');
console.log('6. Compression loaded');

console.log('7. Loading logger...');
const logger = require('./src/utils/logger');
console.log('8. Logger loaded');

console.log('9. Loading database config...');
const connectDB = require('./src/config/database');
console.log('10. Database config loaded');

console.log('11. Loading Redis config...');
const { connectRedis } = require('./src/config/redis');
console.log('12. Redis config loaded');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(compression());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

console.log('13. Starting server initialization...');

const startServer = async () => {
  try {
    console.log('14. Connecting to MongoDB...');
    await connectDB();
    console.log('15. MongoDB connected');
    
    console.log('16. Connecting to Redis...');
    await connectRedis();
    console.log('17. Redis connected');
    
    console.log('18. Starting HTTP server...');
    const server = app.listen(PORT, () => {
      console.log(`✅ Debug server running on port ${PORT}`);
      logger.info(`🚀 Process-Mind Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
};

startServer();