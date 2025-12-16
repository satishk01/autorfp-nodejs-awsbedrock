const faiss = require('faiss-node');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FAISSVectorService {
  constructor() {
    this.index = null;
    this.embedder = null;
    this.documents = new Map(); // Store document metadata
    this.initialized = false;
    this.dimension = 384; // all-MiniLM-L6-v2 embedding dimension
    this.vectorDir = './data/vectors';
    this.indexPath = path.join(this.vectorDir, 'faiss.index');
    this.metadataPath = path.join(this.vectorDir, 'metadata.json');
  }

  async initialize() {
    try {
      logger.info('Initializing FAISS vector service...');
      
      // Create vector directory
      await fs.mkdir(this.vectorDir, { recursive: true });
      
      // Initialize embedding model
      const { pipeline } = await import('@xenova/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      // Try to load existing index
      await this.loadIndex();
      
      this.initialized = true;
      logger.info(`FAISS vector service initialized with ${this.documents.size} documents`);
      
      return true;
    } catch (error) {
      logger.error('FAISS vector service initialization failed', { error: error.message });
      this.initialized = false;
      return false;
    }
  }

  async loadIndex() {
    try {
      // Check if index files exist
      const indexExists = await this.fileExists(this.indexPath);
      const metadataExists = await this.fileExists(this.metadataPath);
      
      if (indexExists && metadataExists) {
        // Load FAISS index
        this.index = faiss.read_index(this.indexPath);
        
        // Load metadata
        const metadataJson = await fs.readFile(this.metadataPath, 'utf8');
        const metadata = JSON.parse(metadataJson);
        
        // Restore documents map
        this.documents = new Map(metadata.documents);
        
        logger.info(`Loaded existing FAISS index with ${this.index.ntotal()} vectors`);
      } else {
        // Create new index
        this.index = new faiss.IndexFlatIP(this.dimension);
        logger.info('Created new FAISS index');
      }
    } catch (error) {
      logger.warn('Failed to load existing index, creating new one', { error: error.message });
      this.index = new faiss.IndexFlatIP(this.dimension);
    }
  }

  async saveIndex() {
    try {
      // Save FAISS index
      faiss.write_index(this.index, this.indexPath);
      
      // Save metadata
      const metadata = {
        documents: Array.from(this.documents.entries()),
        lastUpdated: new Date().toISOString(),
        totalVectors: this.index.ntotal()
      };
      
      await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
      
      logger.info(`Saved FAISS index with ${this.index.ntotal()} vectors`);
    } catch (error) {
      logger.error('Failed to save FAISS index', { error: error.message });
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
      logger.warn('FAISS vector service not initialized');
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
      
      const vectors = [];
      const chunkMetadata = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${documentId}_chunk_${i}`;
        
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk);
        
        vectors.push(embedding);
        chunkMetadata.push({
          id: chunkId,
          documentId,
          chunkIndex: i,
          content: chunk,
          metadata: {
            ...metadata,
            documentId,
            chunkIndex: i
          }
        });
      }

      // Convert vectors to the format FAISS expects
      const vectorMatrix = [];
      for (let i = 0; i < vectors.length; i++) {
        vectorMatrix.push(vectors[i]);
      }

      // Add vectors to FAISS index
      this.index.add(vectorMatrix);

      // Store document metadata
      this.documents.set(documentId, {
        id: documentId,
        chunks: chunkMetadata,
        metadata,
        vectorized: true,
        createdAt: new Date().toISOString()
      });

      // Save index to disk
      await this.saveIndex();

      logger.info(`Vectorized document ${documentId} into ${chunks.length} chunks (FAISS)`);
      return true;
    } catch (error) {
      logger.error('Error vectorizing document', { documentId, error: error.message });
      return false;
    }
  }

  async searchSimilarContent(query, limit = 5) {
    if (!this.initialized || this.index.ntotal() === 0) {
      logger.warn('FAISS index not initialized or empty');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in FAISS index
      const results = this.index.search([queryEmbedding], limit);
      
      const searchResults = [];
      
      // Get all chunks from all documents in order they were added
      const allChunks = [];
      for (const doc of this.documents.values()) {
        allChunks.push(...doc.chunks);
      }

      // Map results to chunks
      if (results && results.labels && results.distances) {
        for (let i = 0; i < results.labels.length; i++) {
          const chunkIndex = results.labels[i];
          const similarity = results.distances[i]; // FAISS returns inner product (higher = more similar)
          
          if (chunkIndex >= 0 && chunkIndex < allChunks.length) {
            const chunk = allChunks[chunkIndex];
            searchResults.push({
              content: chunk.content,
              metadata: chunk.metadata,
              similarity: similarity,
              documentId: chunk.documentId
            });
          }
        }
      }

      return searchResults;
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
        confidence: Math.min(avgSimilarity * 0.1, 1.0), // Normalize FAISS scores
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
      this.index = new faiss.IndexFlatIP(this.dimension);
      this.documents.clear();
      await this.saveIndex();
      logger.info('FAISS index cleared');
    } catch (error) {
      logger.error('Error clearing FAISS index', { error: error.message });
    }
  }

  getStats() {
    return {
      totalVectors: this.index ? this.index.ntotal() : 0,
      totalDocuments: this.documents.size,
      initialized: this.initialized,
      indexPath: this.indexPath,
      metadataPath: this.metadataPath
    };
  }
}

module.exports = FAISSVectorService;