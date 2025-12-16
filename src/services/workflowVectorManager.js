const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class WorkflowVectorManager {
  constructor() {
    this.vectorServices = new Map(); // Cache of vector services per workflow
    this.baseVectorDir = './data/vectors';
    this.embedder = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing workflow vector manager...');
      
      // Initialize embedding model (shared across all workflows)
      const { pipeline } = await import('@xenova/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      this.initialized = true;
      logger.info('Workflow vector manager initialized');
      
      return true;
    } catch (error) {
      logger.error('Workflow vector manager initialization failed', { error: error.message });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get vector storage path for a specific workflow
   */
  getWorkflowVectorPath(workflowId) {
    return path.join(this.baseVectorDir, workflowId, 'vectors.json');
  }

  /**
   * Get or create vector service for a specific workflow
   */
  async getWorkflowVectorService(workflowId) {
    // Return cached service if exists
    if (this.vectorServices.has(workflowId)) {
      return this.vectorServices.get(workflowId);
    }

    if (!this.initialized) {
      throw new Error('Workflow vector manager not initialized');
    }

    try {
      const vectorService = new WorkflowVectorService(workflowId, this.embedder, this.baseVectorDir);
      await vectorService.initialize();
      
      // Cache the service
      this.vectorServices.set(workflowId, vectorService);
      
      logger.info('Workflow vector service created', { workflowId });
      return vectorService;
    } catch (error) {
      logger.error('Failed to create workflow vector service', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all workflow IDs that have vector data
   */
  async getAllWorkflowVectorIds() {
    try {
      const entries = await fs.readdir(this.baseVectorDir, { withFileTypes: true });
      const workflowIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => name.startsWith('rfp_')); // Filter for RFP workflow IDs
      
      return workflowIds;
    } catch (error) {
      logger.warn('Error reading vector directories', { error: error.message });
      return [];
    }
  }

  /**
   * Delete vector storage for a workflow
   */
  async deleteWorkflowVectors(workflowId) {
    try {
      // Remove from cache
      if (this.vectorServices.has(workflowId)) {
        this.vectorServices.delete(workflowId);
      }

      // Remove the vector directory
      const vectorDir = path.join(this.baseVectorDir, workflowId);
      await fs.rm(vectorDir, { recursive: true, force: true });

      logger.info('Workflow vectors deleted', { workflowId });
    } catch (error) {
      logger.error('Error deleting workflow vectors', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Get vector statistics for a workflow
   */
  async getWorkflowVectorStats(workflowId) {
    try {
      const vectorService = await this.getWorkflowVectorService(workflowId);
      return vectorService.getStats();
    } catch (error) {
      logger.error('Error getting workflow vector stats', { workflowId, error: error.message });
      return null;
    }
  }

  /**
   * Migrate existing vectors to workflow-specific storage
   */
  async migrateExistingVectors() {
    try {
      const mainVectorPath = path.join(this.baseVectorDir, 'vectors.json');
      
      try {
        await fs.access(mainVectorPath);
      } catch {
        logger.info('No existing main vector file found, skipping migration');
        return;
      }

      logger.info('Starting migration of existing vectors to workflow-specific storage');

      // Load main vectors file
      const vectorsJson = await fs.readFile(mainVectorPath, 'utf8');
      const data = JSON.parse(vectorsJson);
      
      if (!data.documents || !Array.isArray(data.documents)) {
        logger.warn('Invalid vector data format, skipping migration');
        return;
      }

      // Group documents by workflow ID (extract from document ID)
      const workflowGroups = new Map();
      
      for (const [documentId, documentData] of data.documents) {
        // Try to extract workflow ID from document metadata or ID
        let workflowId = null;
        
        if (documentData.metadata && documentData.metadata.workflowId) {
          workflowId = documentData.metadata.workflowId;
        } else {
          // Try to infer from document ID pattern
          const match = documentId.match(/documents-(\d+)-\d+/);
          if (match) {
            // This is a rough approximation - you might need to adjust based on your ID patterns
            workflowId = `rfp_${match[1]}_unknown`;
          }
        }

        if (workflowId) {
          if (!workflowGroups.has(workflowId)) {
            workflowGroups.set(workflowId, []);
          }
          workflowGroups.get(workflowId).push([documentId, documentData]);
        } else {
          logger.warn('Could not determine workflow ID for document', { documentId });
        }
      }

      // Create workflow-specific vector files
      for (const [workflowId, documents] of workflowGroups.entries()) {
        const workflowVectorDir = path.join(this.baseVectorDir, workflowId);
        await fs.mkdir(workflowVectorDir, { recursive: true });
        
        const workflowVectorPath = path.join(workflowVectorDir, 'vectors.json');
        const workflowData = {
          documents: documents,
          lastUpdated: new Date().toISOString(),
          totalDocuments: documents.length,
          totalChunks: documents.reduce((sum, [, doc]) => sum + (doc.chunks ? doc.chunks.length : 0), 0),
          migratedFrom: 'main'
        };
        
        await fs.writeFile(workflowVectorPath, JSON.stringify(workflowData, null, 2));
        
        logger.info('Migrated vectors for workflow', { 
          workflowId, 
          documents: documents.length,
          chunks: workflowData.totalChunks
        });
      }

      // Backup main vector file
      const backupPath = mainVectorPath + '.backup.' + Date.now();
      await fs.rename(mainVectorPath, backupPath);
      
      logger.info('Vector migration completed successfully', { 
        totalWorkflows: workflowGroups.size,
        backupPath
      });

    } catch (error) {
      logger.error('Vector migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all cached vector services
   */
  clearCache() {
    this.vectorServices.clear();
    logger.info('Vector service cache cleared');
  }
}

/**
 * Workflow-specific vector service
 */
class WorkflowVectorService {
  constructor(workflowId, embedder, baseVectorDir) {
    this.workflowId = workflowId;
    this.embedder = embedder;
    this.documents = new Map();
    this.vectorDir = path.join(baseVectorDir, workflowId);
    this.vectorsPath = path.join(this.vectorDir, 'vectors.json');
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create vector directory
      await fs.mkdir(this.vectorDir, { recursive: true });
      
      // Load existing vectors
      await this.loadVectors();
      
      this.initialized = true;
      logger.info(`Workflow vector service initialized`, { 
        workflowId: this.workflowId,
        documents: this.documents.size 
      });
      
      return true;
    } catch (error) {
      logger.error('Workflow vector service initialization failed', { 
        workflowId: this.workflowId,
        error: error.message 
      });
      this.initialized = false;
      return false;
    }
  }

  async loadVectors() {
    try {
      const vectorsExist = await this.fileExists(this.vectorsPath);
      
      if (vectorsExist) {
        const vectorsJson = await fs.readFile(this.vectorsPath, 'utf8');
        const data = JSON.parse(vectorsJson);
        
        // Restore documents map
        this.documents = new Map(data.documents || []);
        
        logger.info(`Loaded vectors for workflow`, { 
          workflowId: this.workflowId,
          documents: this.documents.size 
        });
      } else {
        logger.info('No existing vectors found for workflow', { workflowId: this.workflowId });
      }
    } catch (error) {
      logger.warn('Failed to load existing vectors for workflow', { 
        workflowId: this.workflowId,
        error: error.message 
      });
      this.documents = new Map();
    }
  }

  async saveVectors() {
    try {
      const data = {
        workflowId: this.workflowId,
        documents: Array.from(this.documents.entries()),
        lastUpdated: new Date().toISOString(),
        totalDocuments: this.documents.size,
        totalChunks: Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.chunks.length, 0)
      };
      
      await fs.writeFile(this.vectorsPath, JSON.stringify(data, null, 2));
      
      logger.info(`Saved vectors for workflow`, { 
        workflowId: this.workflowId,
        documents: this.documents.size 
      });
    } catch (error) {
      logger.error('Failed to save vectors for workflow', { 
        workflowId: this.workflowId,
        error: error.message 
      });
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async vectorizeDocument(documentId, content, metadata = {}) {
    if (!this.initialized) {
      logger.warn('Workflow vector service not initialized', { workflowId: this.workflowId });
      return false;
    }

    try {
      // Check if document already exists
      if (this.documents.has(documentId)) {
        logger.info(`Document already vectorized for workflow`, { 
          workflowId: this.workflowId,
          documentId 
        });
        return true;
      }

      // Split document into chunks
      const chunks = this.splitIntoChunks(content, 500, 50);
      
      const chunkData = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${documentId}_chunk_${i}`;
        
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk);
        
        chunkData.push({
          id: chunkId,
          documentId,
          chunkIndex: i,
          content: chunk,
          embedding: embedding,
          metadata: {
            ...metadata,
            workflowId: this.workflowId,
            documentId,
            chunkIndex: i
          }
        });
      }

      // Store document with all its chunks and embeddings
      this.documents.set(documentId, {
        id: documentId,
        workflowId: this.workflowId,
        chunks: chunkData,
        metadata,
        vectorized: true,
        createdAt: new Date().toISOString()
      });

      // Save to disk
      await this.saveVectors();

      logger.info(`Vectorized document for workflow`, { 
        workflowId: this.workflowId,
        documentId,
        chunks: chunks.length 
      });
      return true;
    } catch (error) {
      logger.error('Error vectorizing document for workflow', { 
        workflowId: this.workflowId,
        documentId, 
        error: error.message 
      });
      return false;
    }
  }

  async searchSimilarContent(query, limit = 5) {
    if (!this.initialized || this.documents.size === 0) {
      logger.warn('Workflow vector service not initialized or empty', { workflowId: this.workflowId });
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all chunks from all documents in this workflow
      const allChunks = [];
      for (const doc of this.documents.values()) {
        allChunks.push(...doc.chunks);
      }

      // Calculate similarities
      const similarities = allChunks.map(chunk => ({
        ...chunk,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
      }));

      // Sort by similarity and return top results
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      return similarities.slice(0, limit).map(chunk => ({
        content: chunk.content,
        metadata: chunk.metadata,
        similarity: chunk.similarity,
        documentId: chunk.documentId,
        workflowId: this.workflowId
      }));
    } catch (error) {
      logger.error('Error searching similar content for workflow', { 
        workflowId: this.workflowId,
        query, 
        error: error.message 
      });
      return [];
    }
  }

  async generateEmbedding(text) {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  splitIntoChunks(text, chunkSize = 500, overlap = 50) {
    const words = text.split(/\s+/);
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  async answerQuestion(question) {
    try {
      // Search for relevant content within this workflow
      const relevantChunks = await this.searchSimilarContent(question, 3);
      
      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the uploaded documents for this RFP to answer this question.",
          confidence: 0.0,
          sources: []
        };
      }

      // Combine relevant chunks as context
      const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
      
      // Use AWS Bedrock to generate answer based on context
      const bedrock = require('./bedrock');
      
      const prompt = `Based on the following context from the RFP document, please answer the question. If the information is not available in the context, say so clearly.

Context:
${context}

Question: ${question}

Please provide a clear, concise answer based only on the information provided in the context above.`;

      const response = await bedrock.invokeModel(prompt);
      
      // Calculate confidence based on similarity scores
      const avgSimilarity = relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length;
      
      return {
        answer: response,
        confidence: Math.min(avgSimilarity * 1.2, 1.0),
        sources: relevantChunks.map(chunk => ({
          documentId: chunk.documentId,
          content: chunk.content.substring(0, 200) + '...',
          similarity: chunk.similarity
        }))
      };
    } catch (error) {
      logger.error('Error answering question for workflow', { 
        workflowId: this.workflowId,
        question, 
        error: error.message 
      });
      return {
        answer: "An error occurred while trying to answer this question.",
        confidence: 0.0,
        sources: []
      };
    }
  }

  async clearIndex() {
    try {
      this.documents.clear();
      await this.saveVectors();
      logger.info('Vector storage cleared for workflow', { workflowId: this.workflowId });
    } catch (error) {
      logger.error('Error clearing vectors for workflow', { 
        workflowId: this.workflowId,
        error: error.message 
      });
    }
  }

  getStats() {
    const totalChunks = Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.chunks.length, 0);
    
    return {
      workflowId: this.workflowId,
      totalVectors: totalChunks,
      totalDocuments: this.documents.size,
      initialized: this.initialized,
      vectorsPath: this.vectorsPath
    };
  }
}

module.exports = WorkflowVectorManager;