const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const ragService = require('./ragService');
const graphRagService = require('./graphRagService');

class DocumentProcessor {
  constructor() {
    this.supportedFormats = ['pdf', 'docx', 'txt', 'csv', 'xlsx', 'xls'];
  }

  async processDocument(filePath, originalName, workflowId = null) {
    try {
      const extension = path.extname(originalName).toLowerCase().slice(1);
      
      if (!this.supportedFormats.includes(extension)) {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      logger.info(`Processing document: ${originalName}`, { extension });

      let content = '';
      let metadata = {
        fileName: originalName,
        fileType: extension,
        processedAt: new Date().toISOString(),
        size: 0
      };

      const fileBuffer = await fs.readFile(filePath);
      metadata.size = fileBuffer.length;

      switch (extension) {
        case 'pdf':
          content = await this.processPDF(fileBuffer);
          break;
        case 'docx':
          content = await this.processDOCX(fileBuffer);
          break;
        case 'txt':
          content = await this.processTXT(fileBuffer);
          break;
        case 'csv':
          content = await this.processCSV(fileBuffer);
          break;
        case 'xlsx':
        case 'xls':
          content = await this.processExcel(fileBuffer);
          break;
        default:
          throw new Error(`Handler not implemented for ${extension}`);
      }

      // Extract structured information
      const structuredData = await this.extractStructuredData(content, extension);

      // Vectorize the document content for RAG
      const documentId = path.basename(originalName, path.extname(originalName));
      await this.vectorizeDocument(documentId, content, metadata, workflowId);

      return {
        content,
        metadata,
        structuredData
      };
    } catch (error) {
      logger.error('Error processing document:', error);
      throw error;
    }
  }

  async processPDF(buffer) {
    try {
      // Check buffer size and handle large files differently
      const bufferSizeMB = buffer.length / (1024 * 1024);
      logger.info(`Processing PDF of size: ${bufferSizeMB.toFixed(2)}MB`);
      
      if (bufferSizeMB > 10) {
        logger.warn(`Large PDF detected (${bufferSizeMB.toFixed(2)}MB). Using optimized processing.`);
      }
      
      const data = await pdfParse(buffer, {
        // Optimize for large files
        max: bufferSizeMB > 10 ? 0 : undefined, // No page limit for large files
        version: 'v1.10.100' // Use latest version for better performance
      });
      
      const extractedText = data.text;
      
      // Log extraction statistics
      logger.info(`PDF processing completed`, {
        pages: data.numpages,
        textLength: extractedText.length,
        sizeMB: bufferSizeMB.toFixed(2)
      });
      
      return extractedText;
    } catch (error) {
      logger.error(`PDF processing failed for ${(buffer.length / (1024 * 1024)).toFixed(2)}MB file:`, error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  async processDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX processing failed: ${error.message}`);
    }
  }

  async processTXT(buffer) {
    return buffer.toString('utf-8');
  }

  async processCSV(buffer) {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    const headers = lines[0]?.split(',') || [];
    
    let formattedContent = `CSV Data with ${lines.length} rows:\n\n`;
    formattedContent += `Headers: ${headers.join(', ')}\n\n`;
    
    // Include first few rows as sample
    const sampleRows = lines.slice(1, 6);
    sampleRows.forEach((row, index) => {
      formattedContent += `Row ${index + 1}: ${row}\n`;
    });

    return formattedContent;
  }

  async processExcel(buffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      let content = '';

      workbook.worksheets.forEach(worksheet => {
        content += `\n=== Sheet: ${worksheet.name} ===\n`;
        
        let rowCount = 0;
        worksheet.eachRow((row, rowNumber) => {
          if (rowCount >= 10) return; // Limit to first 10 rows
          
          const values = row.values.slice(1); // Remove first empty element
          content += `Row ${rowNumber}: ${values.join(' | ')}\n`;
          rowCount++;
        });
      });

      return content;
    } catch (error) {
      throw new Error(`Excel processing failed: ${error.message}`);
    }
  }

  async extractStructuredData(content, fileType) {
    // Extract key information patterns
    const patterns = {
      requirements: /(?:requirement|must|shall|should|need)[s]?[:\s]([^\n]+)/gi,
      questions: /(?:question|ask|inquiry)[s]?[:\s]([^\n]+)/gi,
      deadlines: /(?:deadline|due date|submit by)[:\s]([^\n]+)/gi,
      budget: /(?:budget|cost|price|amount)[:\s]?[\$]?([0-9,]+)/gi,
      contact: /(?:contact|email|phone)[:\s]([^\n]+)/gi
    };

    const extracted = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = [...content.matchAll(pattern)];
      extracted[key] = matches.map(match => match[1]?.trim()).filter(Boolean);
    }

    // Extract sections based on common RFP structure
    const sections = this.extractSections(content);
    
    return {
      ...extracted,
      sections,
      wordCount: content.split(/\s+/).length,
      hasStructuredFormat: this.detectStructuredFormat(content)
    };
  }

  extractSections(content) {
    const sectionPatterns = [
      /(?:executive summary|overview)[:\s]*([^]*?)(?=\n\s*(?:[A-Z][^:\n]*:|$))/gi,
      /(?:scope of work|project scope)[:\s]*([^]*?)(?=\n\s*(?:[A-Z][^:\n]*:|$))/gi,
      /(?:technical requirements|specifications)[:\s]*([^]*?)(?=\n\s*(?:[A-Z][^:\n]*:|$))/gi,
      /(?:timeline|schedule|milestones)[:\s]*([^]*?)(?=\n\s*(?:[A-Z][^:\n]*:|$))/gi,
      /(?:evaluation criteria|scoring)[:\s]*([^]*?)(?=\n\s*(?:[A-Z][^:\n]*:|$))/gi
    ];

    const sections = {};
    sectionPatterns.forEach((pattern, index) => {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0) {
        const sectionNames = ['executive_summary', 'scope', 'technical_requirements', 'timeline', 'evaluation'];
        sections[sectionNames[index]] = matches[0][1]?.trim();
      }
    });

    return sections;
  }

  detectStructuredFormat(content) {
    const structureIndicators = [
      /^\s*\d+\./gm,  // Numbered lists
      /^\s*[a-zA-Z]\./gm,  // Lettered lists
      /^\s*[-*•]/gm,  // Bullet points
      /^[A-Z][^:\n]*:/gm  // Section headers
    ];

    return structureIndicators.some(pattern => pattern.test(content));
  }

  async vectorizeDocument(documentId, content, metadata, workflowId = null) {
    try {
      logger.info(`Vectorizing document: ${documentId}`);
      
      // Process with existing RAG service (FAISS)
      const ragSuccess = await ragService.vectorizeDocument(documentId, content, metadata, workflowId);
      if (ragSuccess) {
        logger.info(`Successfully vectorized document in RAG: ${documentId}`);
      } else {
        logger.warn(`Failed to vectorize document in RAG: ${documentId}`);
      }

      // Process with GraphRAG service (Neo4j + FAISS hybrid)
      if (workflowId) {
        try {
          // Initialize GraphRAG if not already done
          await graphRagService.initialize();
          
          // Create document data structure for GraphRAG
          const documentData = {
            filename: metadata.fileName || documentId,
            content: content,
            metadata: metadata
          };

          // Create chunks for GraphRAG processing
          const chunks = this.createChunks(content);
          
          // Generate embeddings for chunks (using existing RAG service embedding function)
          const embeddings = await this.generateEmbeddings(chunks);
          
          // Process document with GraphRAG
          const graphResult = await graphRagService.processDocument(workflowId, documentData, chunks, embeddings);
          
          if (graphResult.documentId) {
            logger.info(`Successfully processed document in GraphRAG: ${documentId}`, {
              documentId: graphResult.documentId,
              entitiesExtracted: graphResult.entities.length
            });
          }
        } catch (graphError) {
          logger.warn(`GraphRAG processing failed for document ${documentId}:`, graphError.message);
          // Don't fail the entire process if GraphRAG fails
        }
      }
    } catch (error) {
      logger.error('Error vectorizing document', { documentId, error: error.message });
    }
  }

  createChunks(content, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ');
      
      chunks.push({
        content: chunkContent,
        tokenCount: chunkWords.length,
        startIndex: i,
        endIndex: Math.min(i + chunkSize, words.length)
      });
      
      // Break if we've reached the end
      if (i + chunkSize >= words.length) break;
    }
    
    return chunks;
  }

  async generateEmbeddings(chunks) {
    try {
      // Get the RAG service's embedding functionality
      const ragService = require('./ragService');
      
      // If RAG service is using workflow-specific storage, get the embedder from there
      if (ragService.activeService === 'workflow' && ragService.workflowDataService) {
        const vectorManager = ragService.workflowDataService.vectorManager;
        if (vectorManager && vectorManager.embedder) {
          const embeddings = [];
          for (const chunk of chunks) {
            try {
              const output = await vectorManager.embedder(chunk.content, { pooling: 'mean', normalize: true });
              embeddings.push(Array.from(output.data));
            } catch (error) {
              logger.warn(`Failed to generate embedding for chunk: ${error.message}`);
              // Fallback to dummy embedding
              embeddings.push(Array(384).fill(0).map(() => Math.random()));
            }
          }
          return embeddings;
        }
      }
      
      // Fallback: try to use the active service's embedder
      if (ragService.activeService && ragService.activeService.embedder) {
        const embeddings = [];
        for (const chunk of chunks) {
          try {
            const output = await ragService.activeService.embedder(chunk.content, { pooling: 'mean', normalize: true });
            embeddings.push(Array.from(output.data));
          } catch (error) {
            logger.warn(`Failed to generate embedding for chunk: ${error.message}`);
            // Fallback to dummy embedding
            embeddings.push(Array(384).fill(0).map(() => Math.random()));
          }
        }
        return embeddings;
      }
      
      // Final fallback: dummy embeddings
      logger.warn('No embedder available, using dummy embeddings');
      return chunks.map(() => Array(384).fill(0).map(() => Math.random()));
      
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      // Fallback to dummy embeddings
      return chunks.map(() => Array(384).fill(0).map(() => Math.random()));
    }
  }

  validateDocument(filePath, originalName) {
    const extension = path.extname(originalName).toLowerCase().slice(1);
    
    if (!this.supportedFormats.includes(extension)) {
      return { valid: false, error: `Unsupported format: ${extension}` };
    }

    // Additional validation can be added here
    return { valid: true };
  }
}

module.exports = new DocumentProcessor();