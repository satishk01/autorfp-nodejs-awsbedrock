require('dotenv').config();
const documentProcessor = require('./src/services/documentProcessor');
const graphRagService = require('./src/services/graphRagService');
const fs = require('fs').promises;
const path = require('path');

async function testWorkflowGraphRAG() {
  try {
    console.log('Testing workflow GraphRAG integration...');
    
    // 1. Initialize GraphRAG service
    console.log('1. Initializing GraphRAG service...');
    await graphRagService.initialize();
    console.log('✅ GraphRAG service initialized');
    
    // 2. Create a test workflow ID
    const workflowId = `test_workflow_${Date.now()}`;
    console.log(`2. Using test workflow ID: ${workflowId}`);
    
    // 3. Check if test PDF exists
    const testPdfPath = './test-rfp-report.pdf';
    try {
      await fs.access(testPdfPath);
      console.log('✅ Test PDF found');
    } catch (error) {
      console.log('❌ Test PDF not found, skipping test');
      return;
    }
    
    // 4. Process document with GraphRAG
    console.log('3. Processing document with GraphRAG...');
    const result = await documentProcessor.processDocument(
      testPdfPath,
      'test-rfp-report.pdf',
      workflowId
    );
    
    console.log('✅ Document processed successfully');
    console.log(`Content length: ${result.content.length} characters`);
    
    // 5. Wait a moment for processing to complete
    console.log('4. Waiting for GraphRAG processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Check knowledge graph
    console.log('5. Checking knowledge graph...');
    const knowledgeGraph = await graphRagService.getWorkflowKnowledgeGraph(workflowId);
    
    console.log('✅ Knowledge graph retrieved');
    console.log(`Graph nodes: ${knowledgeGraph.nodes.length}`);
    console.log(`Graph edges: ${knowledgeGraph.edges.length}`);
    
    if (knowledgeGraph.nodes.length > 0) {
      console.log('✅ SUCCESS: Knowledge graph data was created!');
      console.log('Sample nodes:', knowledgeGraph.nodes.slice(0, 3).map(n => n.label));
    } else {
      console.log('❌ ISSUE: No knowledge graph data was created');
    }
    
    // 7. Test hybrid search
    console.log('6. Testing hybrid search...');
    const searchResults = await graphRagService.hybridSearch('requirements', workflowId, { limit: 3 });
    
    console.log(`✅ Hybrid search completed: ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log('✅ SUCCESS: Hybrid search returned results!');
    } else {
      console.log('❌ ISSUE: Hybrid search returned no results');
    }
    
    // 8. Disconnect
    await graphRagService.disconnect();
    console.log('✅ GraphRAG service disconnected');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testWorkflowGraphRAG();