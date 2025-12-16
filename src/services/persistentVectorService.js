const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PersistentVectorService {
  constructor() {
    this.embedder = null;
    this.documents = new Map(); // Store document metadata and vectors
    this.initialized = false;
    this.vectorDir = './data/vectors';
    this.vectorsPath = path.join(this.vectorDir, 'vectors.json');
  }

  async initialize() {
    try {
      logger.info('Initializing persistent vector service...');
      
      // Create vector directory
      await fs.mkdir(this.vectorDir, { recursive: true });
      
      // Initialize embedding model
      const { pipeline } = await import('@xenova/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      // Load existing vectors
      await this.loadVectors();
      
      this.initialized = true;
      logger.info(`Persistent vector service initialized with ${this.documents.size} documents`);
      
      return true;
    } catch (error) {
      logger.error('Persistent vector service initialization failed', { error: error.message });
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
        
        logger.info(`Loaded ${this.documents.size} documents from persistent storage`);
      } else {
        logger.info('No existing vectors found, starting fresh');
      }
    } catch (error) {
      logger.warn('Failed to load existing vectors, starting fresh', { error: error.message });
      this.documents = new Map();
    }
  }

  async saveVectors() {
    try {
      const data = {
        documents: Array.from(this.documents.entries()),
        lastUpdated: new Date().toISOString(),
        totalDocuments: this.documents.size,
        totalChunks: Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.chunks.length, 0)
      };
      
      await fs.writeFile(this.vectorsPath, JSON.stringify(data, null, 2));
      
      logger.info(`Saved vectors for ${this.documents.size} documents to persistent storage`);
    } catch (error) {
      logger.error('Failed to save vectors', { error: error.message });
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
      logger.warn('Persistent vector service not initialized');
      return false;
    }

    try {
      // Check if document already exists
      if (this.documents.has(documentId)) {
        logger.info(`Document ${documentId} already vectorized, skipping`);
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
            documentId,
            chunkIndex: i
          }
        });
      }

      // Store document with all its chunks and embeddings
      this.documents.set(documentId, {
        id: documentId,
        chunks: chunkData,
        metadata,
        vectorized: true,
        createdAt: new Date().toISOString()
      });

      // Save to disk
      await this.saveVectors();

      logger.info(`Vectorized document ${documentId} into ${chunks.length} chunks (persistent)`);
      return true;
    } catch (error) {
      logger.error('Error vectorizing document', { documentId, error: error.message });
      return false;
    }
  }

  async searchSimilarContent(query, limit = 5) {
    if (!this.initialized || this.documents.size === 0) {
      logger.warn('Persistent vector service not initialized or empty');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all chunks from all documents
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
        documentId: chunk.documentId
      }));
    } catch (error) {
      logger.error('Error searching similar content', { query, error: error.message });
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

  async answerQuestion(question, workflowId) {
    try {
      // Search for relevant content
      const relevantChunks = await this.searchSimilarContent(question, 3);
      
      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the uploaded documents to answer this question.",
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
      logger.error('Error answering question', { question, error: error.message });
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
      logger.info('Persistent vector storage cleared');
    } catch (error) {
      logger.error('Error clearing persistent vectors', { error: error.message });
    }
  }

  getStats() {
    const totalChunks = Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.chunks.length, 0);
    
    return {
      totalVectors: totalChunks,
      totalDocuments: this.documents.size,
      initialized: this.initialized,
      vectorsPath: this.vectorsPath
    };
  }
}

module.exports = PersistentVectorService;