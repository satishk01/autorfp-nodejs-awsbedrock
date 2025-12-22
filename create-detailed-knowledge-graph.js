require('dotenv').config();
const neo4jGraphService = require('./src/services/neo4jGraphService');

async function createDetailedKnowledgeGraph() {
  console.log('🔧 Creating Detailed Knowledge Graph...');
  
  try {
    // Connect to Neo4j
    await neo4jGraphService.connect();
    console.log('✅ Connected to Neo4j');
    
    const workflowId = 'rfp_1766389959496_n5dou7t1y';
    const session = neo4jGraphService.driver.session();
    
    // First, clear existing entities for this workflow to avoid duplicates
    console.log('🧹 Clearing existing entities...');
    await session.run(`
      MATCH (e:Entity {workflowId: $workflowId})
      DETACH DELETE e
    `, { workflowId });
    
    // Get the document
    const docResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      RETURN d.id, d.filename, d.content
    `, { workflowId });
    
    if (docResult.records.length === 0) {
      console.log('❌ No document found');
      return;
    }
    
    const document = docResult.records[0];
    const documentId = document.get('d.id');
    const filename = document.get('d.filename');
    const content = document.get('d.content');
    
    console.log(`📄 Processing document: ${filename}`);
    console.log(`📝 Content length: ${content.length} characters`);
    
    // Extract entities with enhanced extraction
    console.log('🔍 Extracting comprehensive entities...');
    const entities = await neo4jGraphService.extractAndCreateEntities(documentId, content);
    console.log(`✅ Extracted ${entities.length} entities`);
    
    // Create relationships
    if (entities.length > 1) {
      console.log('🔗 Creating entity relationships...');
      const relationships = await neo4jGraphService.createEntityRelationships(entities, workflowId);
      console.log(`✅ Created ${relationships.length} relationships`);
    }
    
    // Verify the enhanced knowledge graph
    console.log('📊 Checking enhanced knowledge graph...');
    const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
    
    let totalEntities = 0;
    let totalRelationships = 0;
    
    graphData.forEach(item => {
      console.log(`  📄 Document: ${item.document}`);
      console.log(`     - Entities: ${item.entities.length}`);
      console.log(`     - Relationships: ${item.relationships.length}`);
      
      // Show entity details
      item.entities.forEach(entity => {
        console.log(`       • ${entity.name} (${entity.type})`);
      });
      
      totalEntities += item.entities.length;
      totalRelationships += item.relationships.length;
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`   - Total Entities: ${totalEntities}`);
    console.log(`   - Total Relationships: ${totalRelationships}`);
    console.log(`   - Total Nodes: ${totalEntities + 1} (including document)`);
    console.log(`   - Total Edges: ${totalEntities + totalRelationships}`);
    
    await session.close();
    await neo4jGraphService.disconnect();
    
    console.log('\n🎉 Detailed Knowledge Graph created! Refresh the UI to see the enhanced graph.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

createDetailedKnowledgeGraph();