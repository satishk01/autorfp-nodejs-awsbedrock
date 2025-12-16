#!/usr/bin/env node

// Test script to verify the system setup
import dataService from './src/services/dataService.js';
import logger from './src/utils/logger.js';

async function testSetup() {
  try {
    console.log('🧪 Testing RFP Automation System Setup...\n');

    // Test data service initialization
    console.log('📊 Initializing data services...');
    await dataService.initialize();
    console.log('✅ Data services initialized successfully\n');

    // Test database operations
    console.log('🗄️ Testing database operations...');
    const testWorkflow = {
      id: 'test_workflow_' + Date.now(),
      status: 'running',
      currentStep: 'test',
      progress: 0,
      projectContext: { title: 'Test Project' }
    };

    await dataService.createWorkflow(testWorkflow);
    const retrieved = await dataService.getWorkflow(testWorkflow.id);
    
    if (retrieved && retrieved.id === testWorkflow.id) {
      console.log('✅ Database operations working correctly');
    } else {
      throw new Error('Database test failed');
    }

    // Clean up test data
    await dataService.deleteWorkflow(testWorkflow.id);
    console.log('✅ Database cleanup completed\n');

    // Test health check
    console.log('🏥 Running health checks...');
    const health = await dataService.healthCheck();
    console.log('Database health:', health.database.status);
    console.log('Cache health:', health.cache.status);
    console.log('Overall health:', health.overall);
    console.log('✅ Health checks completed\n');

    // Test statistics
    console.log('📈 Testing statistics...');
    const stats = await dataService.getWorkflowStatistics();
    console.log('Total workflows:', stats.total || 0);
    console.log('✅ Statistics working correctly\n');

    console.log('🎉 All tests passed! System is ready to use.\n');

    // Close connections
    await dataService.close();
    console.log('🔒 Connections closed gracefully');

  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testSetup();