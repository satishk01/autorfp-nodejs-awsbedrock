require('dotenv').config();

async function fixWorkflowGraphRAGIntegration() {
  console.log('🔧 Fixing Workflow GraphRAG Integration...');
  
  try {
    // The issue is that the document processor's GraphRAG integration
    // is not working during workflow execution. Let me check the exact issue.
    
    const documentProcessor = require('./src/services/documentProcessor');
    const graphRagService = require('./src/services/graphRagService');
    
    console.log('🔍 Testing document processor GraphRAG integration...');
    
    // Test if the document processor can call GraphRAG
    const testWorkflowId = 'test_integration_' + Date.now();
    const testContent = 'This is a test RFP document about cloud computing services from AWS and Microsoft Azure.';
    
    // Initialize GraphRAG
    await graphRagService.initialize();
    console.log('✅ GraphRAG service initialized');
    
    // Test the document processor's vectorizeDocument method
    console.log('🧪 Testing vectorizeDocument with GraphRAG...');
    
    const metadata = {
      fileName: 'test-document.pdf',
      fileType: 'pdf',
      processedAt: new Date().toISOString(),
      size: testContent.length
    };
    
    // This should trigger GraphRAG processing
    await documentProcessor.vectorizeDocument('test-doc', testContent, metadata, testWorkflowId);
    
    console.log('✅ Document processing completed');
    
    // Check if GraphRAG data was created
    console.log('🔍 Checking if GraphRAG data was created...');
    const knowledgeGraph = await graphRagService.getWorkflowKnowledgeGraph(testWorkflowId);
    
    console.log(`📊 Knowledge graph results:`);
    console.log(`   - Nodes: ${knowledgeGraph.nodes.length}`);
    console.log(`   - Edges: ${knowledgeGraph.edges.length}`);
    
    if (knowledgeGraph.nodes.length > 0) {
      console.log('✅ SUCCESS: GraphRAG integration is working!');
      console.log('📋 Entities found:');
      knowledgeGraph.nodes.forEach(node => {
        if (node.type !== 'document') {
          console.log(`   - ${node.label} (${node.type})`);
        }
      });
    } else {
      console.log('❌ ISSUE: GraphRAG integration is not working during document processing');
      console.log('🔧 The problem is likely in the document processor\'s GraphRAG call');
    }
    
    // Cleanup test data
    await graphRagService.deleteWorkflowData(testWorkflowId);
    await graphRagService.disconnect();
    
  } catch (error) {
    console.error('❌ Error testing GraphRAG integration:', error.message);
    console.error(error.stack);
  }
}

fixWorkflowGraphRAGIntegration();