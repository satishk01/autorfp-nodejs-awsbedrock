const ragService = require('./src/services/ragService');
const documentProcessor = require('./src/services/documentProcessor');
const fs = require('fs').promises;
const path = require('path');

async function vectorizeExistingDocuments() {
  try {
    console.log('Initializing RAG service...');
    await ragService.initialize();
    
    console.log('Looking for existing documents...');
    const uploadsDir = './uploads';
    const files = await fs.readdir(uploadsDir);
    
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        console.log(`Processing document: ${file}`);
        const filePath = path.join(uploadsDir, file);
        
        try {
          const result = await documentProcessor.processDocument(filePath, file);
          console.log(`Successfully vectorized: ${file}`);
          console.log(`Content length: ${result.content.length} characters`);
        } catch (error) {
          console.error(`Error processing ${file}:`, error.message);
        }
      }
    }
    
    console.log('Document vectorization complete!');
  } catch (error) {
    console.error('Error:', error);
  }
}

vectorizeExistingDocuments();