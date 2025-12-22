const graphRagService = require('./src/services/graphRagService');
const documentProcessor = require('./src/services/documentProcessor');
const fs = require('fs').promises;

async function populateKnowledgeGraph() {
  console.log('🚀 Starting Knowledge Graph population...');
  
  const workflowId = 'rfp_1766386665044_u6xpven8h'; // Your current workflow
  
  try {
    // 1. Initialize GraphRAG service
    console.log('1. Initializing GraphRAG service...');
    await graphRagService.initialize();
    console.log('✅ GraphRAG service initialized');
    
    // 2. Find the correct PDF file for this workflow
    console.log('2. Finding PDF file for workflow...');
    const files = await fs.readdir('./uploads');
    const workflowTimestamp = '1766386665'; // Extract timestamp from workflow ID
    const pdfFiles = files.filter(f => f.includes(workflowTimestamp) && f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF file found for this workflow');
      console.log('Available PDF files:', files.filter(f => f.endsWith('.pdf')));
      return;
    }
    
    const pdfPath = `./uploads/${pdfFiles[0]}`;
    console.log('✅ Found PDF file:', pdfPath);
    
    await processDocument(pdfPath, workflowId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function processDocument(pdfPath, workflowId) {
  try {
    // 3. Process document to get content
    console.log('2. Processing PDF document...');
    const result = await documentProcessor.processDocument(pdfPath, 'RFP_Document.pdf', workflowId);
    console.log('✅ Document processed, content length:', result.content.length);
    
    // 4. Create document data for GraphRAG
    console.log('3. Creating GraphRAG document data...');
    const documentData = {
      filename: 'RFP_Document.pdf',
      content: result.content,
      metadata: result.metadata || {}
    };
    
    // 5. Create chunks
    console.log('4. Creating document chunks...');
    const chunks = createChunks(result.content);
    console.log('✅ Created', chunks.length, 'chunks');
    
    // 6. Generate embeddings (dummy for now)
    console.log('5. Generating embeddings...');
    const embeddings = chunks.map(() => Array(384).fill(0).map(() => Math.random()));
    console.log('✅ Generated embeddings for', embeddings.length, 'chunks');
    
    // 7. Process with GraphRAG
    console.log('6. Processing with GraphRAG...');
    const graphResult = await graphRagService.processDocument(workflowId, documentData, chunks, embeddings);
    console.log('✅ GraphRAG processing completed');
    console.log('Document ID:', graphResult.documentId);
    console.log('Entities extracted:', graphResult.entities.length);
    
    // 8. Get knowledge graph
    console.log('7. Retrieving knowledge graph...');
    const knowledgeGraph = await graphRagService.getWorkflowKnowledgeGraph(workflowId);
    console.log('✅ Knowledge graph retrieved');
    console.log('Nodes:', knowledgeGraph.nodes.length);
    console.log('Edges:', knowledgeGraph.edges.length);
    console.log('Stats:', knowledgeGraph.stats);
    
    console.log('🎉 Knowledge Graph population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error processing document:', error.message);
    throw error;
  }
}

function createChunks(content, chunkSize = 500) {
  const words = content.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkContent = chunkWords.join(' ');
    
    chunks.push({
      content: chunkContent,
      tokenCount: chunkWords.length,
      startIndex: i,
      endIndex: Math.min(i + chunkSize, words.length)
    });
    
    if (i + chunkSize >= words.length) break;
  }
  
  return chunks;
}

populateKnowledgeGraph().catch(console.error);