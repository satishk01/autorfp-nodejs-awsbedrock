const { ChromaClient } = require('chromadb');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class VectorService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.embedder = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize Chroma client
      this.client = new ChromaClient({
        path: "http://localhost:8000" // Default Chroma server
      });

      // Initialize embedding model (using a lightweight model)
      logger.info('Loading embedding model...');
      const { pipeline } = await import('@xenova/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      // Create or get collection
      try {
        this.collection = await this.client.getCollection({
          name: "rfp_documents"
        });
        logger.info('Using existing vector collection');
      } catch (error) {
        this.collection = await this.client.createCollection({
          name: "rfp_documents",
          metadata: { "hnsw:space": "cosine" }
        });
        logger.info('Created new vector collection');
      }

      this.initialized = true;
      logger.info('Vector service initialized successfully');
    } catch (error) {
      logger.warn('Vector service initialization failed, falling back to simple text search', { error: error.message });
      this.initialized = false;
    }
  }

  async vectorizeDocument(documentId, content, metadata = {}) {
    if (!this.initialized) {
      logger.warn('Vector service not initialized, skipping vectorization');
      return false;
    }

    try {
      // Split document into chunks
      const chunks = this.splitIntoChunks(content, 500, 50);
      
      const documents = [];
      const embeddings = [];
      const metadatas = [];
      const ids = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${documentId}_chunk_${i}`;
        
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk);
        
        documents.push(chunk);
        embeddings.push(embedding);
        metadatas.push({
          ...metadata,
          documentId,
          chunkIndex: i,
          chunkText: chunk.substring(0, 100) + '...'
        });
        ids.push(chunkId);
      }

      // Add to collection
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      logger.info(`Vectorized document ${documentId} into ${chunks.length} chunks`);
      return true;
    } catch (error) {
      logger.error('Error vectorizing document', { documentId, error: error.message });
      return false;
    }
  }

  async searchSimilarContent(query, limit = 5) {
    if (!this.initialized) {
      logger.warn('Vector service not initialized, using fallback search');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search for similar content
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      const searchResults = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          searchResults.push({
            content: results.documents[0][i],
            metadata: results.metadatas[0][i],
            similarity: 1 - results.distances[0][i], // Convert distance to similarity
            documentId: results.metadatas[0][i].documentId
          });
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
        confidence: Math.min(avgSimilarity * 1.2, 1.0), // Boost confidence slightly
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

  async clearCollection() {
    if (!this.initialized) return;
    
    try {
      await this.client.deleteCollection({ name: "rfp_documents" });
      this.collection = await this.client.createCollection({
        name: "rfp_documents",
        metadata: { "hnsw:space": "cosine" }
      });
      logger.info('Vector collection cleared');
    } catch (error) {
      logger.error('Error clearing collection', { error: error.message });
    }
  }
}

// Create singleton instance
const vectorService = new VectorService();

module.exports = vectorService;