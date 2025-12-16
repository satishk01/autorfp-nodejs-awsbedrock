#!/usr/bin/env node

// Debug script to identify where the server is hanging
console.log('🔍 Starting server debug...');

try {
  console.log('1. Testing basic imports...');
  
  console.log('2. Importing config...');
  const config = await import('./src/config/index.js');
  console.log('✅ Config imported successfully');
  
  console.log('3. Importing logger...');
  const logger = await import('./src/utils/logger.js');
  console.log('✅ Logger imported successfully');
  
  console.log('4. Testing database service...');
  const database = await import('./src/database/database.js');
  console.log('✅ Database service imported successfully');
  
  console.log('5. Testing Redis service...');
  const redis = await import('./src/services/redis.js');
  console.log('✅ Redis service imported successfully');
  
  console.log('6. Testing data service...');
  const dataService = await import('./src/services/dataService.js');
  console.log('✅ Data service imported successfully');
  
  console.log('7. Testing express import...');
  const express = await import('express');
  console.log('✅ Express imported successfully');
  
  console.log('8. Testing other dependencies...');
  const cors = await import('cors');
  const helmet = await import('helmet');
  const multer = await import('multer');
  console.log('✅ Other dependencies imported successfully');
  
  console.log('9. Testing server class import...');
  // Don't actually import the server class as it might start the server
  console.log('✅ All imports successful');
  
  console.log('🎉 All modules can be imported successfully!');
  console.log('The issue might be in the server initialization or startup process.');
  
} catch (error) {
  console.error('❌ Error during import:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}