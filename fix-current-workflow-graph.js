require('dotenv').config();
const neo4jGraphService = require('./src/services/neo4jGraphService');

async function fixCurrentWorkflowGraph() {
  console.log('🔧 Fixing current workflow knowledge graph...');
  
  try {
    await neo4jGraphService.connect();
    const session = neo4jGraphService.driver.session();
    
    // The workflow ID from the screenshot appears to be the one we've been working with
    const workflowId = 'rfp_1766389959496_n5dou7t1y';
    
    console.log(`🎯 Targeting workflow: ${workflowId}`);
    
    // Check current state
    const currentResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      OPTIONAL MATCH (d)-[:MENTIONS]->(e:Entity)
      RETURN d.filename as filename, count(e) as entityCount
    `, { workflowId });
    
    if (currentResult.records.length === 0) {
      console.log('❌ Workflow not found');
      return;
    }
    
    const filename = currentResult.records[0].get('filename');
    const entityCount = currentResult.records[0].get('entityCount');
    
    console.log(`📄 Document: ${filename}`);
    console.log(`📊 Current entities: ${entityCount}`);
    
    if (entityCount > 2) {
      console.log('✅ Workflow already has detailed entities');
      
      // Check if it's showing in the API
      const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
      console.log(`🔍 API returns: ${graphData.length} items`);
      
      if (graphData.length > 0) {
        const totalEntities = graphData.reduce((sum, item) => sum + item.entities.length, 0);
        console.log(`📈 Total entities in API: ${totalEntities}`);
        
        if (totalEntities > 2) {
          console.log('✅ API has detailed data - the issue might be UI caching');
          console.log('🔄 Try hard refresh (Ctrl+F5) or clear browser cache');
        }
      }
    } else {
      console.log('🔧 Creating detailed entities for current workflow...');
      
      // Get document content
      const docResult = await session.run(`
        MATCH (d:Document {workflowId: $workflowId})
        RETURN d.id, d.content
      `, { workflowId });
      
      if (docResult.records.length === 0) {
        console.log('❌ Document not found');
        return;
      }
      
      const documentId = docResult.records[0].get('d.id');
      const content = docResult.records[0].get('d.content');
      
      if (!content) {
        console.log('❌ Document has no content');
        return;
      }
      
      // Clear existing entities
      await session.run(`
        MATCH (e:Entity {workflowId: $workflowId})
        DETACH DELETE e
      `, { workflowId });
      
      // Extract detailed entities
      console.log('🔍 Extracting detailed entities...');
      const entities = await neo4jGraphService.extractAndCreateEntities(documentId, content);
      console.log(`✅ Created ${entities.length} entities`);
      
      // Create relationships
      if (entities.length > 1) {
        console.log('🔗 Creating relationships...');
        const relationships = await neo4jGraphService.createEntityRelationships(entities, workflowId);
        console.log(`✅ Created ${relationships.length} relationships`);
      }
    }
    
    // Final verification
    console.log('\n📊 Final verification...');
    const finalResult = await neo4jGraphService.getWorkflowGraph(workflowId);
    
    if (finalResult.length > 0) {
      const totalEntities = finalResult.reduce((sum, item) => sum + item.entities.length, 0);
      const totalRelationships = finalResult.reduce((sum, item) => sum + item.relationships.length, 0);
      
      console.log(`✅ SUCCESS!`);
      console.log(`   - Entities: ${totalEntities}`);
      console.log(`   - Relationships: ${totalRelationships}`);
      console.log(`   - Total nodes: ${totalEntities + 1}`);
      console.log(`   - Total edges: ${totalEntities + totalRelationships}`);
      
      // Show entity types
      const entityTypes = {};
      finalResult.forEach(item => {
        item.entities.forEach(entity => {
          if (!entityTypes[entity.type]) entityTypes[entity.type] = [];
          entityTypes[entity.type].push(entity.name);
        });
      });
      
      console.log('\n📋 Entities by type:');
      Object.entries(entityTypes).forEach(([type, names]) => {
        console.log(`   ${type}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}`);
      });
    }
    
    await session.close();
    await neo4jGraphService.disconnect();
    
    console.log('\n🎉 Current workflow fixed!');
    console.log('🔄 Hard refresh the browser (Ctrl+F5) to see the updated graph');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixCurrentWorkflowGraph();