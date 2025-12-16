#!/usr/bin/env node

// Minimal server test to identify the hanging issue
import express from 'express';
import config from './src/config/index.js';
import logger from './src/utils/logger.js';

console.log('🚀 Starting minimal server test...');

try {
  const app = express();
  
  console.log('1. Express app created');
  
  // Basic middleware
  app.use(express.json());
  console.log('2. Basic middleware added');
  
  // Simple health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  console.log('3. Health route added');
  
  // Try to start server
  console.log(`4. Attempting to start server on port ${config.server.port}...`);
  
  const server = app.listen(config.server.port, () => {
    console.log(`✅ Minimal server started successfully on port ${config.server.port}`);
    console.log(`🌐 Test it: http://localhost:${config.server.port}/health`);
    
    // Close after 2 seconds
    setTimeout(() => {
      server.close(() => {
        console.log('🔒 Server closed successfully');
        process.exit(0);
      });
    }, 2000);
  });
  
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${config.server.port} is already in use`);
      console.log('💡 Try changing the PORT in your .env file or kill the process using that port');
    } else {
      console.error('❌ Server error:', error.message);
    }
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Error starting minimal server:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}