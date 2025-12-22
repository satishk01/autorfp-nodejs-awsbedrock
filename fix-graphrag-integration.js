require('dotenv').config();
const neo4jGraphService = require('./src/services/neo4jGraphService');

async function fixGraphRAGIntegration() {
  console.log('🔧 Fixing GraphRAG Integration...');
  
  try {
    // Connect to Neo4j
    await neo4jGraphService.connect();
    console.log('✅ Connected to Neo4j');
    
    // Test workflow ID from the UI
    const workflowId = 'rfp_1766389959496_n5dou7t1y';
    
    // Get the document that exists but has no entities
    const session = neo4jGraphService.driver.session();
    
    const docResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      RETURN d.id, d.filename, d.content
    `, { workflowId });
    
    if (docResult.records.length === 0) {
      console.log('❌ No document found for this workflow');
      return;
    }
    
    const document = docResult.records[0];
    const documentId = document.get('d.id');
    const filename = document.get('d.filename');
    const content = document.get('d.content');
    
    console.log(`📄 Found document: ${filename} (ID: ${documentId})`);
    
    if (!content) {
      console.log('❌ Document has no content');
      return;
    }
    
    console.log(`📝 Content length: ${content.length} characters`);
    
    // Extract entities directly
    console.log('🔍 Extracting entities...');
    const entities = await neo4jGraphService.extractAndCreateEntities(documentId, content);
    console.log(`✅ Extracted ${entities.length} entities`);
    
    // Create relationships
    if (entities.length > 0) {
      console.log('🔗 Creating relationships...');
      const relationships = await neo4jGraphService.createEntityRelationships(entities, workflowId);
      console.log(`✅ Created ${relationships.length} relationships`);
    }
    
    // Verify the knowledge graph
    console.log('📊 Checking knowledge graph...');
    const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
    console.log(`✅ Knowledge graph has ${graphData.length} items`);
    
    if (graphData.length > 0) {
      graphData.forEach(item => {
        console.log(`  - Document: ${item.document}, Entities: ${item.entities.length}, Relationships: ${item.relationships.length}`);
      });
    }
    
    await session.close();
    await neo4jGraphService.disconnect();
    
    console.log('🎉 GraphRAG integration fixed! Try refreshing the Knowledge Graph in the UI.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixGraphRAGIntegration();