const documentProcessor = require('./src/services/documentProcessor');
const path = require('path');

async function testPDFProcessing() {
  console.log('Testing PDF processing...');
  
  const pdfPath = './uploads/documents-1766385983512-378049037.pdf';
  
  try {
    console.log('Processing PDF:', pdfPath);
    const result = await documentProcessor.processDocument(pdfPath, 'test.pdf', 'test_workflow');
    
    console.log('✅ PDF processing successful!');
    console.log('Content length:', result.content.length);
    console.log('First 200 characters:', result.content.substring(0, 200));
    
  } catch (error) {
    console.error('❌ PDF processing failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPDFProcessing().catch(console.error);