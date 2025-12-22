const neo4jGraphService = require('./neo4jGraphService');
const ragService = require('./ragService');
const logger = require('../utils/logger');
const config = require('../config');

class GraphRAGService {
  constructor() {
    this.neo4jEnabled = config.neo4j.enabled;
    this.hybridWeights = {
      vector: 0.6,
      graph: 0.4
    };
  }

  async initialize() {
    try {
      // Initialize the underlying RAG service first
      const ragInitialized = await ragService.initialize();
      if (!ragInitialized) {
        logger.warn('RAG service initialization failed, GraphRAG will have limited functionality');
      }

      if (this.neo4jEnabled) {
        await neo4jGraphService.connect();
        logger.info('GraphRAG service initialized with Neo4j support');
      } else {
        logger.info('GraphRAG service initialized without Neo4j (vector-only mode)');
      }
    } catch (error) {
      logger.error('Error initializing GraphRAG service:', error);
      this.neo4jEnabled = false;
    }
  }

  async processDocument(workflowId, documentData, chunks, embeddings) {
    try {
      // 1. Process with existing RAG service (FAISS)
      await ragService.vectorizeDocument(documentData.filename, documentData.content, documentData.metadata, workflowId);
      
      // 2. Process with Neo4j if enabled
      if (this.neo4jEnabled) {
        const documentId = await neo4jGraphService.createDocument(workflowId, documentData);
        await neo4jGraphService.createChunksWithEmbeddings(documentId, chunks, embeddings);
        
        // Extract entities and relationships
        const entities = await neo4jGraphService.extractAndCreateEntities(documentId, documentData.content);
        await neo4jGraphService.createEntityRelationships(entities, workflowId);
        
        logger.info(`Processed document in GraphRAG: ${documentData.filename}`);
        return { documentId, entities };
      }
      
      return { documentId: null, entities: [] };
    } catch (error) {
      logger.error('Error processing document in GraphRAG:', error);
      throw error;
    }
  }

  async hybridSearch(query, workflowId, options = {}) {
    const {
      limit = 10,
      vectorWeight = this.hybridWeights.vector,
      graphWeight = this.hybridWeights.graph,
      includeEntities = true,
      includeRelationships = true
    } = options;

    // Ensure limit is an integer
    const intLimit = parseInt(limit);

    try {
      let vectorResults = [];
      let graphResults = [];

      // 1. Vector search using existing RAG service
      try {
        const ragResults = await ragService.searchSimilarContent(query, intLimit * 2, workflowId);
        vectorResults = ragResults.map(result => ({
          ...result,
          source: 'vector',
          vectorScore: result.score || result.similarity || 0,
          graphScore: 0
        }));
      } catch (error) {
        logger.warn('Vector search failed:', error);
      }

      // 2. Graph search using Neo4j (if enabled)
      if (this.neo4jEnabled) {
        try {
          graphResults = await neo4jGraphService.hybridSearch(query, workflowId, intLimit);
        } catch (error) {
          logger.warn('Graph search failed:', error);
        }
      }

      // 3. Combine and rank results
      const combinedResults = this.combineAndRankResults(
        vectorResults, 
        graphResults, 
        vectorWeight, 
        graphWeight
      );

      // 4. Enhance with graph context if requested
      if (this.neo4jEnabled && (includeEntities || includeRelationships)) {
        await this.enhanceWithGraphContext(combinedResults, workflowId, includeEntities, includeRelationships);
      }

      logger.info(`GraphRAG search returned ${combinedResults.length} results for query: "${query}"`);
      return combinedResults.slice(0, intLimit);
    } catch (error) {
      logger.error('Error in GraphRAG hybrid search:', error);
      throw error;
    }
  }

  combineAndRankResults(vectorResults, graphResults, vectorWeight, graphWeight) {
    const resultMap = new Map();

    // Add vector results
    vectorResults.forEach(result => {
      const key = result.chunkId || result.id || result.content?.substring(0, 50);
      resultMap.set(key, {
        ...result,
        vectorScore: result.vectorScore || result.score || 0,
        graphScore: 0,
        source: 'vector'
      });
    });

    // Merge graph results
    graphResults.forEach(result => {
      const key = result.chunkId || result.id || result.content?.substring(0, 50);
      if (resultMap.has(key)) {
        const existing = resultMap.get(key);
        existing.graphScore = result.graphScore || 0;
        existing.entities = result.entities || [];
        existing.relatedEntities = result.relatedEntities || [];
        existing.source = 'hybrid';
      } else {
        resultMap.set(key, {
          ...result,
          vectorScore: 0,
          graphScore: result.graphScore || 0,
          source: 'graph'
        });
      }
    });

    // Calculate combined scores and sort
    const combined = Array.from(resultMap.values()).map(result => ({
      ...result,
      combinedScore: (result.vectorScore * vectorWeight) + (result.graphScore * graphWeight)
    }));

    return combined.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  async enhanceWithGraphContext(results, workflowId, includeEntities, includeRelationships) {
    if (!this.neo4jEnabled) return;

    for (const result of results) {
      try {
        if (includeEntities && !result.entities) {
          // Get entities mentioned in this chunk
          result.entities = await this.getChunkEntities(result.chunkId, workflowId);
        }

        if (includeRelationships && result.entities?.length > 0) {
          // Get relationships for these entities
          result.relationships = await this.getEntityRelationships(result.entities, workflowId);
        }
      } catch (error) {
        logger.warn(`Error enhancing result with graph context: ${error.message}`);
      }
    }
  }

  async getChunkEntities(chunkId, workflowId) {
    // Implementation would query Neo4j for entities in this chunk
    return [];
  }

  async getEntityRelationships(entities, workflowId) {
    // Implementation would query Neo4j for relationships between entities
    return [];
  }

  async getWorkflowKnowledgeGraph(workflowId) {
    if (!this.neo4jEnabled) {
      return {
        nodes: [],
        edges: [],
        message: 'Neo4j not enabled - knowledge graph not available'
      };
    }

    try {
      const graphData = await neo4jGraphService.getWorkflowGraph(workflowId);
      
      // Transform to visualization format
      const nodes = new Map();
      const edges = [];

      graphData.forEach(item => {
        // Add document node
        if (!nodes.has(item.document)) {
          nodes.set(item.document, {
            id: item.document,
            label: item.document,
            type: 'document',
            size: 20,
            color: '#4A90E2'
          });
        }

        // Add entity nodes
        item.entities.forEach(entity => {
          if (!nodes.has(entity.name)) {
            // Ensure frequency is a regular number
            let frequency = entity.frequency;
            if (typeof frequency === 'bigint') {
              frequency = Number(frequency);
            } else if (typeof frequency !== 'number' || isNaN(frequency)) {
              frequency = 1;
            }
            
            nodes.set(entity.name, {
              id: entity.name,
              label: entity.name,
              type: entity.type.toLowerCase(),
              size: Math.min(10 + (frequency * 2), 30),
              color: this.getEntityColor(entity.type)
            });
          }

          // Add document-entity edge
          let frequency = entity.frequency;
          if (typeof frequency === 'bigint') {
            frequency = Number(frequency);
          } else if (typeof frequency !== 'number' || isNaN(frequency)) {
            frequency = 1;
          }
          
          edges.push({
            id: `${item.document}-${entity.name}`,
            source: item.document,
            target: entity.name,
            type: 'mentions',
            weight: frequency
          });
        });

        // Add entity relationships
        item.relationships.forEach(rel => {
          if (rel.source && rel.target) {
            // Ensure confidence is a regular number
            let confidence = rel.confidence;
            if (typeof confidence === 'bigint') {
              confidence = Number(confidence);
            } else if (typeof confidence !== 'number' || isNaN(confidence)) {
              confidence = 0.5;
            }
            
            edges.push({
              id: `${rel.source}-${rel.target}`,
              source: rel.source,
              target: rel.target,
              type: rel.type.toLowerCase(),
              weight: confidence,
              label: rel.type
            });
          }
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        edges: edges,
        stats: {
          totalNodes: nodes.size,
          totalEdges: edges.length,
          documentNodes: Array.from(nodes.values()).filter(n => n.type === 'document').length,
          entityNodes: Array.from(nodes.values()).filter(n => n.type !== 'document').length
        }
      };
    } catch (error) {
      logger.error('Error getting workflow knowledge graph:', error);
      throw error;
    }
  }

  getEntityColor(entityType) {
    const colors = {
      'person': '#E74C3C',
      'organization': '#9B59B6',
      'location': '#2ECC71',
      'technology': '#F39C12',
      'concept': '#34495E',
      'default': '#95A5A6'
    };
    return colors[entityType.toLowerCase()] || colors.default;
  }

  async deleteWorkflowData(workflowId) {
    try {
      // Delete from existing RAG service
      await ragService.deleteWorkflowData(workflowId);
      
      // Delete from Neo4j if enabled
      if (this.neo4jEnabled) {
        await neo4jGraphService.deleteWorkflowData(workflowId);
      }
      
      logger.info(`Deleted GraphRAG data for workflow: ${workflowId}`);
    } catch (error) {
      logger.error('Error deleting GraphRAG workflow data:', error);
      throw error;
    }
  }

  async getSearchExplanation(query, results) {
    if (!this.neo4jEnabled) {
      return 'Vector-only search using FAISS similarity matching.';
    }

    const vectorCount = results.filter(r => r.source === 'vector').length;
    const graphCount = results.filter(r => r.source === 'graph').length;
    const hybridCount = results.filter(r => r.source === 'hybrid').length;

    return `Hybrid GraphRAG search combining vector similarity and graph relationships:
    - Vector matches: ${vectorCount}
    - Graph matches: ${graphCount}  
    - Hybrid matches: ${hybridCount}
    - Total results: ${results.length}`;
  }

  async disconnect() {
    if (this.neo4jEnabled) {
      await neo4jGraphService.disconnect();
    }
  }
}

module.exports = new GraphRAGService();