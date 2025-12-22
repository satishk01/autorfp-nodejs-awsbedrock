require('dotenv').config();
const neo4j = require('neo4j-driver');

async function debugNeo4jData() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log('Checking all data in Neo4j...');
    
    // 1. Check all documents
    console.log('\n1. All Documents:');
    const docsResult = await session.run('MATCH (d:Document) RETURN d.workflowId, d.filename, d.id LIMIT 10');
    docsResult.records.forEach(record => {
      console.log(`  - Workflow: ${record.get('d.workflowId')}, File: ${record.get('d.filename')}, ID: ${record.get('d.id')}`);
    });
    
    // 2. Check all entities
    console.log('\n2. All Entities:');
    const entitiesResult = await session.run('MATCH (e:Entity) RETURN e.name, e.type, e.workflowId LIMIT 10');
    entitiesResult.records.forEach(record => {
      console.log(`  - Entity: ${record.get('e.name')}, Type: ${record.get('e.type')}, Workflow: ${record.get('e.workflowId')}`);
    });
    
    // 3. Check all relationships
    console.log('\n3. All Relationships:');
    const relsResult = await session.run('MATCH ()-[r]->() RETURN type(r), count(*) as count');
    relsResult.records.forEach(record => {
      console.log(`  - Relationship: ${record.get('type(r)')}, Count: ${record.get('count')}`);
    });
    
    // 4. Check specific workflow data
    console.log('\n4. Checking specific workflow: rfp_1766388479118_4cubo7f7a');
    const workflowResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      OPTIONAL MATCH (d)-[:MENTIONS]->(e:Entity)
      RETURN d.filename, count(e) as entityCount
    `, { workflowId: 'rfp_1766388479118_4cubo7f7a' });
    
    workflowResult.records.forEach(record => {
      console.log(`  - Document: ${record.get('d.filename')}, Entities: ${record.get('entityCount')}`);
    });
    
    // 5. Check test workflow data
    console.log('\n5. Checking test workflow data (test_workflow_*)');
    const testResult = await session.run(`
      MATCH (d:Document)
      WHERE d.workflowId STARTS WITH 'test_workflow_'
      OPTIONAL MATCH (d)-[:MENTIONS]->(e:Entity)
      RETURN d.workflowId, d.filename, count(e) as entityCount
    `);
    
    testResult.records.forEach(record => {
      console.log(`  - Workflow: ${record.get('d.workflowId')}, Document: ${record.get('d.filename')}, Entities: ${record.get('entityCount')}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

debugNeo4jData();