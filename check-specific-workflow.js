require('dotenv').config();
const neo4j = require('neo4j-driver');

async function checkWorkflow() {
  const workflowId = 'rfp_1766389959496_n5dou7t1y'; // From server logs
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log(`Checking workflow: ${workflowId}\n`);
    
    // 1. Check documents
    console.log('1. Documents:');
    const docsResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      RETURN d.id, d.filename, d.workflowId
    `, { workflowId });
    
    docsResult.records.forEach(record => {
      console.log(`  - ID: ${record.get('d.id')}, File: ${record.get('d.filename')}`);
    });
    
    // 2. Check entities
    console.log('\n2. Entities:');
    const entitiesResult = await session.run(`
      MATCH (e:Entity {workflowId: $workflowId})
      RETURN e.name, e.type, e.frequency
    `, { workflowId });
    
    if (entitiesResult.records.length === 0) {
      console.log('  - No entities found');
    } else {
      entitiesResult.records.forEach(record => {
        console.log(`  - ${record.get('e.name')} (${record.get('e.type')}), Frequency: ${record.get('e.frequency')}`);
      });
    }
    
    // 3. Check relationships
    console.log('\n3. Document-Entity Relationships:');
    const relsResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})-[r:MENTIONS]->(e:Entity)
      RETURN d.filename, e.name, r.confidence
    `, { workflowId });
    
    if (relsResult.records.length === 0) {
      console.log('  - No relationships found');
    } else {
      relsResult.records.forEach(record => {
        console.log(`  - ${record.get('d.filename')} -> ${record.get('e.name')} (confidence: ${record.get('r.confidence')})`);
      });
    }
    
    // 4. Check the full graph query
    console.log('\n4. Full Graph Query (same as UI uses):');
    const graphResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})-[:MENTIONS]->(e:Entity)
      OPTIONAL MATCH (e)-[r:RELATED_TO]-(related:Entity)
      RETURN d.filename as document, 
             collect(DISTINCT {
               name: e.name, 
               type: e.type, 
               frequency: e.frequency
             }) as entities,
             collect(DISTINCT {
               source: e.name,
               target: related.name,
               type: type(r),
               confidence: r.confidence
             }) as relationships
    `, { workflowId });
    
    if (graphResult.records.length === 0) {
      console.log('  - No graph data found');
    } else {
      graphResult.records.forEach(record => {
        console.log(`  - Document: ${record.get('document')}`);
        console.log(`  - Entities: ${record.get('entities').length}`);
        console.log(`  - Relationships: ${record.get('relationships').length}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkWorkflow();