#!/usr/bin/env node
// Temporary start script with better error handling

console.log('🚀 Starting Process-Mind Backend Server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', process.env.PORT || 5000);

try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded');
  
  // Set DISABLE_WORKERS temporarily to prevent queue issues
  process.env.DISABLE_WORKERS = 'true';
  console.log('⚠️  Workers temporarily disabled for startup');
  
  require('./src/server.js');
} catch (error) {
  console.error('❌ Fatal error during startup:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}