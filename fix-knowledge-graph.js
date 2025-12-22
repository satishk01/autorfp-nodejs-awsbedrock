// Simple script to populate knowledge graph with test data
const neo4j = require('neo4j-driver');
const config = require('./src/config');

async function createTestKnowledgeGraph() {
  console.log('🚀 Creating test knowledge graph data...');
  
  const workflowId = 'rfp_1766386665044_u6xpven8h';
  let driver;
  
  try {
    // Connect to Neo4j
    console.log('1. Connecting to Neo4j...');
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
    );
    
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j');
    
    const session = driver.session();
    
    try {
      // Clear existing data for this workflow
      console.log('2. Clearing existing data...');
      await session.run(`
        MATCH (d:Document {workflowId: $workflowId})
        DETACH DELETE d
      `, { workflowId });
      
      // Create test document
      console.log('3. Creating document node...');
      await session.run(`
        CREATE (d:Document {
          id: $documentId,
          workflowId: $workflowId,
          filename: "RFP_MAPP10022014.pdf",
          content: "Sample RFP document content for testing",
          createdAt: datetime()
        })
        RETURN d
      `, {
        documentId: 'doc_' + Date.now(),
        workflowId
      });
      
      // Create test entities
      console.log('4. Creating entity nodes...');
      const entities = [
        { name: 'Cloud Platform', type: 'TECHNOLOGY' },
        { name: 'Data Analytics', type: 'CONCEPT' },
        { name: 'Security Framework', type: 'CONCEPT' },
        { name: 'API Gateway', type: 'TECHNOLOGY' },
        { name: 'Database System', type: 'TECHNOLOGY' },
        { name: 'User Interface', type: 'CONCEPT' },
        { name: 'Integration Layer', type: 'CONCEPT' },
        { name: 'Monitoring System', type: 'TECHNOLOGY' }
      ];
      
      for (const entity of entities) {
        await session.run(`
          MERGE (e:Entity {name: $name, type: $type})
          ON CREATE SET 
            e.id = $entityId,
            e.createdAt = datetime(),
            e.frequency = 1
          ON MATCH SET 
            e.frequency = e.frequency + 1
          WITH e
          MATCH (d:Document {workflowId: $workflowId})
          MERGE (d)-[:MENTIONS {confidence: 0.8}]->(e)
          RETURN e
        `, {
          entityId: 'entity_' + entity.name.replace(/\s+/g, '_').toLowerCase(),
          name: entity.name,
          type: entity.type,
          workflowId
        });
      }
      
      // Create relationships between entities
      console.log('5. Creating entity relationships...');
      const relationships = [
        { source: 'Cloud Platform', target: 'API Gateway', type: 'USES' },
        { source: 'API Gateway', target: 'Database System', type: 'CONNECTS_TO' },
        { source: 'Data Analytics', target: 'Database System', type: 'PROCESSES' },
        { source: 'Security Framework', target: 'Cloud Platform', type: 'PROTECTS' },
        { source: 'User Interface', target: 'API Gateway', type: 'COMMUNICATES_WITH' },
        { source: 'Integration Layer', target: 'Data Analytics', type: 'FEEDS_INTO' },
        { source: 'Monitoring System', target: 'Cloud Platform', type: 'MONITORS' }
      ];
      
      for (const rel of relationships) {
        await session.run(`
          MATCH (e1:Entity {name: $source})
          MATCH (e2:Entity {name: $target})
          MERGE (e1)-[r:RELATED_TO {
            type: $relationType,
            confidence: 0.7,
            createdAt: datetime()
          }]->(e2)
          RETURN r
        `, {
          source: rel.source,
          target: rel.target,
          relationType: rel.type
        });
      }
      
      // Verify the data
      console.log('6. Verifying created data...');
      const result = await session.run(`
        MATCH (d:Document {workflowId: $workflowId})-[:MENTIONS]->(e:Entity)
        OPTIONAL MATCH (e)-[r:RELATED_TO]-(related:Entity)
        RETURN count(DISTINCT d) as documents, 
               count(DISTINCT e) as entities, 
               count(DISTINCT r) as relationships
      `, { workflowId });
      
      const stats = result.records[0];
      console.log('✅ Knowledge graph created successfully!');
      console.log('📊 Stats:');
      console.log('  - Documents:', stats.get('documents').toNumber());
      console.log('  - Entities:', stats.get('entities').toNumber());
      console.log('  - Relationships:', stats.get('relationships').toNumber());
      
    } finally {
      await session.close();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

createTestKnowledgeGraph().catch(console.error);