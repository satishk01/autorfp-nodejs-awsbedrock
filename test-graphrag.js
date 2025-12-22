const graphRagService = require('./src/services/graphRagService');
const logger = require('./src/utils/logger');

async function testGraphRAG() {
  console.log('Testing GraphRAG service...');
  
  try {
    // Test initialization
    console.log('1. Initializing GraphRAG service...');
    await graphRagService.initialize();
    console.log('✅ GraphRAG service initialized successfully');
    
    // Check if Neo4j is enabled
    console.log('2. Checking Neo4j status...');
    console.log('Neo4j enabled:', graphRagService.neo4jEnabled);
    
    if (graphRagService.neo4jEnabled) {
      console.log('✅ Neo4j is enabled for hybrid GraphRAG');
      
      // Test a simple search (this will fail if no data, but should not error)
      console.log('3. Testing hybrid search...');
      try {
        const results = await graphRagService.hybridSearch('test query', 'test_workflow', { limit: 5 });
        console.log('✅ Hybrid search completed, results:', results.length);
      } catch (searchError) {
        console.log('⚠️ Hybrid search failed (expected if no data):', searchError.message);
      }
      
    } else {
      console.log('⚠️ Neo4j is disabled, using vector-only RAG');
    }
    
    console.log('4. Testing knowledge graph...');
    try {
      const graph = await graphRagService.getWorkflowKnowledgeGraph('test_workflow');
      console.log('✅ Knowledge graph query completed');
      console.log('Graph nodes:', graph.nodes?.length || 0);
      console.log('Graph edges:', graph.edges?.length || 0);
      if (graph.message) {
        console.log('Message:', graph.message);
      }
    } catch (graphError) {
      console.log('⚠️ Knowledge graph failed:', graphError.message);
    }
    
  } catch (error) {
    console.error('❌ GraphRAG test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    try {
      await graphRagService.disconnect();
      console.log('✅ GraphRAG service disconnected');
    } catch (disconnectError) {
      console.log('⚠️ Disconnect warning:', disconnectError.message);
    }
  }
}

testGraphRAG().catch(console.error);