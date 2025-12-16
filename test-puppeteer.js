#!/usr/bin/env node

// Test Puppeteer initialization (this might take time on first run)
console.log('🎭 Testing Puppeteer initialization...');
console.log('⏳ This might take a while on first run (downloading Chromium)...');

try {
  const puppeteer = await import('puppeteer');
  console.log('✅ Puppeteer imported successfully');
  
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.default.launch({ headless: 'new' });
  console.log('✅ Browser launched successfully');
  
  await browser.close();
  console.log('✅ Browser closed successfully');
  
  console.log('🎉 Puppeteer is working correctly!');
  
} catch (error) {
  console.error('❌ Puppeteer error:', error.message);
  
  if (error.message.includes('Could not find Chromium')) {
    console.log('💡 Chromium needs to be downloaded. This happens automatically on first run.');
    console.log('💡 You can manually install it with: npx puppeteer browsers install chrome');
  }
  
  process.exit(1);
}