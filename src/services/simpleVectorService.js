const logger = require('../utils/logger');

class SimpleVectorService {
  constructor() {
    this.embedder = null;
    this.documents = new Map(); // In-memory storage
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('Loading embedding model for simple vector service...');
      const { pipeline } = await import('@xenova/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.initialized = true;
      logger.info('Simple vector service initialized successfully');
    } catch (error) {
      logger.error('Simple vector service initialization failed', { error: error.message });
      this.initialized = false;
    }
  }

  async vectorizeDocument(documentId, content, metadata = {}) {
    if (!this.initialized) {
      logger.warn('Simple vector service not initialized');
      return false;
    }

    try {
      // Split document into chunks
      const chunks = this.splitIntoChunks(content, 500, 50);
      
      const documentChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${documentId}_chunk_${i}`;
        
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk);
        
        documentChunks.push({
          id: chunkId,
          content: chunk,
          embedding,
          metadata: {
            ...metadata,
            documentId,
            chunkIndex: i
          }
        });
      }

      // Store in memory
      this.documents.set(documentId, documentChunks);

      logger.info(`Vectorized document ${documentId} into ${chunks.length} chunks (in-memory)`);
      return true;
    } catch (error) {
      logger.error('Error vectorizing document', { documentId, error: error.message });
      return false;
    }
  }

  async searchSimilarContent(query, limit = 5) {
    if (!this.initialized) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search across all document chunks
      const allChunks = [];
      for (const chunks of this.documents.values()) {
        allChunks.push(...chunks);
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
        documentId: chunk.metadata.documentId
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

  clearCollection() {
    this.documents.clear();
    logger.info('In-memory vector collection cleared');
  }
}

module.exports = SimpleVectorService;