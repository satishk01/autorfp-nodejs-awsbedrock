const neo4j = require('neo4j-driver');
const config = require('./src/config');

async function testNeo4jConnection() {
  console.log('Testing Neo4j connection...');
  console.log('URI:', config.neo4j.uri);
  console.log('Username:', config.neo4j.username);
  console.log('Password:', config.neo4j.password ? '***' : 'NOT SET');
  
  let driver;
  try {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 10 * 1000, // 10 seconds timeout
      }
    );

    console.log('Driver created, testing connectivity...');
    await driver.verifyConnectivity();
    console.log('✅ Neo4j connection successful!');
    
    // Test a simple query
    const session = driver.session();
    try {
      const result = await session.run('RETURN "Hello Neo4j!" as message');
      const message = result.records[0].get('message');
      console.log('✅ Query test successful:', message);
    } finally {
      await session.close();
    }
    
  } catch (error) {
    console.error('❌ Neo4j connection failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    // Provide specific guidance based on error type
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n🔧 SOLUTION: Neo4j server is not running or not accessible');
      console.error('   - Check if Neo4j is running on your EC2 instance');
      console.error('   - Run: sudo systemctl status neo4j');
      console.error('   - If not running: sudo systemctl start neo4j');
    } else if (error.message.includes('authentication')) {
      console.error('\n🔧 SOLUTION: Authentication failed');
      console.error('   - Check username/password in .env file');
      console.error('   - Default username is "neo4j"');
    } else if (error.message.includes('timeout')) {
      console.error('\n🔧 SOLUTION: Connection timeout');
      console.error('   - Check network connectivity to EC2 instance');
      console.error('   - Verify security group allows port 7687');
    }
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

testNeo4jConnection().catch(console.error);