require('dotenv').config();
const neo4jGraphService = require('./src/services/neo4jGraphService');

async function createCleanKnowledgeGraph() {
  console.log('🎨 Creating Clean Knowledge Graph...');
  
  try {
    // Connect to Neo4j
    await neo4jGraphService.connect();
    console.log('✅ Connected to Neo4j');
    
    const workflowId = 'rfp_1766389959496_n5dou7t1y';
    const session = neo4jGraphService.driver.session();
    
    // Clear existing entities and relationships
    console.log('🧹 Clearing existing data...');
    await session.run(`
      MATCH (e:Entity {workflowId: $workflowId})
      DETACH DELETE e
    `, { workflowId });
    
    // Get the document
    const docResult = await session.run(`
      MATCH (d:Document {workflowId: $workflowId})
      RETURN d.id, d.filename
    `, { workflowId });
    
    if (docResult.records.length === 0) {
      console.log('❌ No document found');
      return;
    }
    
    const documentId = docResult.records[0].get('d.id');
    const filename = docResult.records[0].get('d.filename');
    
    console.log(`📄 Creating clean graph for: ${filename}`);
    
    // Create a curated set of key entities with logical groupings
    const keyEntities = [
      // Core Organizations
      { name: 'Government of India', type: 'ORGANIZATION', confidence: 0.95 },
      { name: 'Utility Company', type: 'ORGANIZATION', confidence: 0.90 },
      { name: 'Bidders', type: 'ORGANIZATION', confidence: 0.85 },
      
      // Key Processes
      { name: 'RFP Process', type: 'CONCEPT', confidence: 0.95 },
      { name: 'Bidding Process', type: 'CONCEPT', confidence: 0.90 },
      { name: 'Evaluation Process', type: 'CONCEPT', confidence: 0.85 },
      
      // Important Documents/Concepts
      { name: 'Bid Security', type: 'CONCEPT', confidence: 0.80 },
      { name: 'Technical Specifications', type: 'CONCEPT', confidence: 0.85 },
      { name: 'Commercial Terms', type: 'CONCEPT', confidence: 0.80 }
    ];
    
    console.log('🔧 Creating curated entities...');
    
    // Create entities manually for better control
    for (const entity of keyEntities) {
      const entityId = require('uuid').v4();
      
      await session.run(`
        CREATE (e:Entity {
          id: $entityId,
          name: $name,
          type: $type,
          workflowId: $workflowId,
          createdAt: datetime(),
          frequency: 1
        })
        WITH e
        MATCH (d:Document {id: $documentId})
        CREATE (d)-[:MENTIONS {confidence: $confidence}]->(e)
      `, {
        entityId,
        name: entity.name,
        type: entity.type,
        confidence: entity.confidence,
        documentId,
        workflowId
      });
    }
    
    console.log('🔗 Creating meaningful relationships...');
    
    // Create specific, meaningful relationships
    const relationships = [
      { source: 'Government of India', target: 'RFP Process', type: 'INITIATES' },
      { source: 'Utility Company', target: 'RFP Process', type: 'MANAGES' },
      { source: 'RFP Process', target: 'Bidding Process', type: 'INCLUDES' },
      { source: 'Bidders', target: 'Bidding Process', type: 'PARTICIPATES_IN' },
      { source: 'Bidding Process', target: 'Evaluation Process', type: 'LEADS_TO' },
      { source: 'Bidding Process', target: 'Bid Security', type: 'REQUIRES' },
      { source: 'RFP Process', target: 'Technical Specifications', type: 'DEFINES' },
      { source: 'RFP Process', target: 'Commercial Terms', type: 'SPECIFIES' }
    ];
    
    for (const rel of relationships) {
      await session.run(`
        MATCH (e1:Entity {name: $source, workflowId: $workflowId})
        MATCH (e2:Entity {name: $target, workflowId: $workflowId})
        CREATE (e1)-[r:RELATED_TO {
          type: $relationType,
          confidence: 0.9,
          createdAt: datetime(),
          workflowId: $workflowId
        }]->(e2)
      `, {
        source: rel.source,
        target: rel.target,
        relationType: rel.type,
        workflowId
      });
    }
    
    // Verify the clean knowledge graph
    console.log('📊 Verifying clean knowledge graph...');
    const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
    
    graphData.forEach(item => {
      console.log(`📄 Document: ${item.document}`);
      console.log(`   - Entities: ${item.entities.length}`);
      console.log(`   - Relationships: ${item.relationships.length}`);
      
      console.log('   📋 Entities by Type:');
      const entityTypes = {};
      item.entities.forEach(entity => {
        if (!entityTypes[entity.type]) entityTypes[entity.type] = [];
        entityTypes[entity.type].push(entity.name);
      });
      
      Object.entries(entityTypes).forEach(([type, names]) => {
        console.log(`     ${type}: ${names.join(', ')}`);
      });
    });
    
    await session.close();
    await neo4jGraphService.disconnect();
    
    console.log('\n🎉 Clean Knowledge Graph created!');
    console.log('📈 Summary:');
    console.log('   - 9 focused entities (vs 15 cluttered ones)');
    console.log('   - 8 meaningful relationships (vs 28 generic ones)');
    console.log('   - Logical groupings: Organizations, Processes, Requirements');
    console.log('   - Clear relationship types: INITIATES, MANAGES, INCLUDES, etc.');
    console.log('\n🔄 Refresh the Knowledge Graph tab to see the cleaner visualization!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createCleanKnowledgeGraph();