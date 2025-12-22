require('dotenv').config();
const neo4jGraphService = require('./src/services/neo4jGraphService');

async function autoProcessNewWorkflows() {
  console.log('🔄 Auto-processing new workflows with GraphRAG...');
  
  try {
    await neo4jGraphService.connect();
    const session = neo4jGraphService.driver.session();
    
    // Find workflows that have documents but no entities (unprocessed)
    const unprocessedResult = await session.run(`
      MATCH (d:Document)
      WHERE NOT EXISTS {
        MATCH (d)-[:MENTIONS]->(e:Entity)
      }
      RETURN DISTINCT d.workflowId as workflowId, d.filename as filename, d.content as content, d.id as documentId
      LIMIT 5
    `);
    
    console.log(`📋 Found ${unprocessedResult.records.length} unprocessed workflows`);
    
    for (const record of unprocessedResult.records) {
      const workflowId = record.get('workflowId');
      const filename = record.get('filename');
      const content = record.get('content');
      const documentId = record.get('documentId');
      
      if (!content) {
        console.log(`⚠️  Skipping ${filename} - no content`);
        continue;
      }
      
      console.log(`\n🔧 Processing workflow: ${workflowId}`);
      console.log(`📄 Document: ${filename}`);
      console.log(`📝 Content length: ${content.length} characters`);
      
      // Extract entities
      console.log('🔍 Extracting entities...');
      const entities = await neo4jGraphService.extractAndCreateEntities(documentId, content);
      console.log(`✅ Extracted ${entities.length} entities`);
      
      // Create relationships
      if (entities.length > 1) {
        console.log('🔗 Creating relationships...');
        const relationships = await neo4jGraphService.createEntityRelationships(entities, workflowId);
        console.log(`✅ Created ${relationships.length} relationships`);
      }
      
      // Verify
      const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
      const totalEntities = graphData.reduce((sum, item) => sum + item.entities.length, 0);
      const totalRelationships = graphData.reduce((sum, item) => sum + item.relationships.length, 0);
      
      console.log(`📊 Result: ${totalEntities} entities, ${totalRelationships} relationships`);
    }
    
    await session.close();
    await neo4jGraphService.disconnect();
    
    console.log('\n🎉 Auto-processing completed!');
    console.log('🔄 All new workflows now have knowledge graphs.');
    console.log('💡 Refresh the Knowledge Graph tab in any workflow to see the results.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

autoProcessNewWorkflows();