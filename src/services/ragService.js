const VectorService = require('./vectorService');
const SimpleVectorService = require('./simpleVectorService');
const PersistentVectorService = require('./persistentVectorService');
const logger = require('../utils/logger');

class RAGService {
  constructor() {
    this.workflowDataService = null;
    this.persistentService = new PersistentVectorService();
    this.chromaService = VectorService;
    this.fallbackService = new SimpleVectorService();
    this.activeService = null;
    this.initialized = false;
    this.useWorkflowSpecific = true;
  }

  async initialize() {
    try {
      // Try workflow-specific storage first (preferred)
      if (this.useWorkflowSpecific) {
        try {
          this.workflowDataService = require('./workflowDataService');
          const workflowInitialized = await this.workflowDataService.initialize();
          if (workflowInitialized) {
            this.activeService = 'workflow';
            logger.info('RAG service using workflow-specific vector storage');
            this.initialized = true;
            return true;
          }
        } catch (error) {
          logger.warn('Workflow-specific storage failed, falling back', { error: error.message });
        }
      }

      // Try persistent service (JSON-based local storage)
      const persistentInitialized = await this.persistentService.initialize();
      if (persistentInitialized) {
        this.activeService = this.persistentService;
        logger.info('RAG service using persistent JSON vector storage');
        this.initialized = true;
        return true;
      }
    } catch (error) {
      logger.warn('Persistent service failed, trying Chroma', { error: error.message });
    }

    try {
      // Try Chroma as backup
      await this.chromaService.initialize();
      if (this.chromaService.initialized) {
        this.activeService = this.chromaService;
        logger.info('RAG service using Chroma vector database');
        this.initialized = true;
        return true;
      }
    } catch (error) {
      logger.warn('Chroma service failed, using in-memory fallback', { error: error.message });
    }

    try {
      // Fall back to simple in-memory service
      await this.fallbackService.initialize();
      if (this.fallbackService.initialized) {
        this.activeService = this.fallbackService;
        logger.info('RAG service using in-memory vector storage (fallback)');
        this.initialized = true;
        return true;
      }
    } catch (error) {
      logger.error('All vector services failed to initialize', { error: error.message });
    }

    this.initialized = false;
    return false;
  }

  async vectorizeDocument(documentId, content, metadata = {}, workflowId = null) {
    if (!this.initialized) {
      logger.error('RAG service not initialized');
      return false;
    }

    // Use workflow-specific storage if available and workflowId provided
    if (this.activeService === 'workflow' && workflowId) {
      return await this.workflowDataService.vectorizeDocument(workflowId, documentId, content, metadata);
    }

    // Fallback to active service
    return await this.activeService.vectorizeDocument(documentId, content, metadata);
  }

  async searchSimilarContent(query, limit = 5, workflowId = null) {
    if (!this.initialized) {
      logger.error('RAG service not initialized');
      return [];
    }

    // Use workflow-specific storage if available and workflowId provided
    if (this.activeService === 'workflow' && workflowId) {
      return await this.workflowDataService.searchSimilarContent(workflowId, query, limit);
    }

    // Fallback to active service
    return await this.activeService.searchSimilarContent(query, limit);
  }

  async answerQuestion(question, workflowId = null) {
    if (!this.initialized) {
      logger.error('RAG service not initialized');
      return {
        answer: "RAG service is not available.",
        confidence: 0.0,
        sources: []
      };
    }

    // Use workflow-specific storage if available and workflowId provided
    if (this.activeService === 'workflow' && workflowId) {
      return await this.workflowDataService.answerQuestion(workflowId, question);
    }

    // If activeService is 'workflow' but no workflowId, or if activeService is an object
    if (this.activeService === 'workflow') {
      // No workflowId provided, but we're in workflow mode - this shouldn't happen in normal flow
      logger.warn('Workflow mode active but no workflowId provided for question');
      return {
        answer: "Please provide a workflow ID for this question.",
        confidence: 0.0,
        sources: []
      };
    }

    // Use the actual service object
    if (this.activeService && typeof this.activeService.answerQuestion === 'function') {
      return await this.activeService.answerQuestion(question, workflowId);
    }

    // Fallback error
    logger.error('No valid active service available for answering questions');
    return {
      answer: "No RAG service available to answer this question.",
      confidence: 0.0,
      sources: []
    };
  }

  async clearCollection() {
    if (!this.initialized) return;
    await this.activeService.clearCollection();
  }

  isUsingWorkflowSpecific() {
    return this.activeService === 'workflow';
  }

  isUsingChroma() {
    return this.activeService === this.chromaService;
  }

  isUsingPersistent() {
    return this.activeService === this.persistentService;
  }

  getActiveServiceType() {
    if (this.activeService === 'workflow') return 'Workflow-Specific';
    if (this.activeService === this.persistentService) return 'Persistent-JSON';
    if (this.activeService === this.chromaService) return 'Chroma';
    if (this.activeService === this.fallbackService) return 'In-Memory';
    return 'Unknown';
  }

  getStats() {
    if (!this.initialized) return { error: 'Not initialized' };
    
    const baseStats = {
      activeService: this.getActiveServiceType(),
      initialized: this.initialized
    };

    if (this.activeService && typeof this.activeService.getStats === 'function') {
      return { ...baseStats, ...this.activeService.getStats() };
    }

    return baseStats;
  }
}

// Create singleton instance
const ragService = new RAGService();

module.exports = ragService;