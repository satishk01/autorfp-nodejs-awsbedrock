// Test if the server has the GraphRAG fixes
const documentProcessor = require('./src/services/documentProcessor');

async function testServerGraphRAG() {
  console.log('Testing if server has GraphRAG fixes...');
  
  // Check if the generateEmbeddings method has the fix
  const processor = documentProcessor;
  const testChunks = [{ content: 'test content' }];
  
  try {
    const embeddings = await processor.generateEmbeddings(testChunks);
    console.log(`✅ generateEmbeddings works: ${embeddings.length} embeddings generated`);
    console.log(`✅ Embedding dimension: ${embeddings[0].length}`);
  } catch (error) {
    console.log(`❌ generateEmbeddings failed: ${error.message}`);
  }
  
  // Check if GraphRAG service has the fixes
  const graphRagService = require('./src/services/graphRagService');
  
  try {
    await graphRagService.initialize();
    console.log('✅ GraphRAG service initialized successfully');
  } catch (error) {
    console.log(`❌ GraphRAG initialization failed: ${error.message}`);
  }
}

testServerGraphRAG();