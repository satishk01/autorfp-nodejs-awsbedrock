require('dotenv').config();
const neo4j = require('neo4j-driver');

async function cleanupNeo4j() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log('Cleaning up Neo4j data...');
    
    // Delete all entities without workflowId (orphaned entities)
    console.log('1. Deleting orphaned entities...');
    const result1 = await session.run(`
      MATCH (e:Entity)
      WHERE e.workflowId IS NULL
      DETACH DELETE e
      RETURN count(*) as deleted
    `);
    console.log(`Deleted ${result1.records[0].get('deleted')} orphaned entities`);
    
    // Delete all relationships without workflowId
    console.log('2. Deleting orphaned relationships...');
    const result2 = await session.run(`
      MATCH ()-[r:RELATED_TO]->()
      WHERE r.workflowId IS NULL
      DELETE r
      RETURN count(*) as deleted
    `);
    console.log(`Deleted ${result2.records[0].get('deleted')} orphaned relationships`);
    
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

cleanupNeo4j();