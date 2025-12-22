const express = require('express');
const router = express.Router();
const graphRagService = require('../services/graphRagService');
const logger = require('../utils/logger');

// Initialize GraphRAG service
router.post('/initialize', async (req, res) => {
  try {
    await graphRagService.initialize();
    res.json({
      success: true,
      message: 'GraphRAG service initialized successfully'
    });
  } catch (error) {
    logger.error('Error initializing GraphRAG service:', error);
    res.status(500).json({
      error: 'Failed to initialize GraphRAG service',
      details: error.message
    });
  }
});

// Hybrid search endpoint
router.post('/search', async (req, res) => {
  try {
    const { query, workflowId, options = {} } = req.body;

    if (!query || !workflowId) {
      return res.status(400).json({
        error: 'Query and workflowId are required'
      });
    }

    const results = await graphRagService.hybridSearch(query, workflowId, options);
    const explanation = await graphRagService.getSearchExplanation(query, results);

    res.json({
      success: true,
      query,
      workflowId,
      results,
      explanation,
      resultCount: results.length,
      searchType: 'hybrid_graphrag'
    });
  } catch (error) {
    logger.error('Error in GraphRAG search:', error);
    res.status(500).json({
      error: 'GraphRAG search failed',
      details: error.message
    });
  }
});

// Get knowledge graph for workflow
router.get('/workflow/:workflowId/knowledge-graph', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const knowledgeGraph = await graphRagService.getWorkflowKnowledgeGraph(workflowId);

    // Convert any BigInt values to regular numbers
    const sanitizedGraph = JSON.parse(JSON.stringify(knowledgeGraph, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));

    res.json({
      success: true,
      workflowId,
      knowledgeGraph: sanitizedGraph
    });
  } catch (error) {
    logger.error('Error getting knowledge graph:', error);
    res.status(500).json({
      error: 'Failed to get knowledge graph',
      details: error.message
    });
  }
});

// Process document with GraphRAG
router.post('/workflow/:workflowId/process-document', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { documentData, chunks, embeddings } = req.body;

    if (!documentData || !chunks) {
      return res.status(400).json({
        error: 'Document data and chunks are required'
      });
    }

    const result = await graphRagService.processDocument(workflowId, documentData, chunks, embeddings);

    res.json({
      success: true,
      workflowId,
      documentId: result.documentId,
      entitiesExtracted: result.entities.length,
      message: 'Document processed successfully with GraphRAG'
    });
  } catch (error) {
    logger.error('Error processing document with GraphRAG:', error);
    res.status(500).json({
      error: 'Failed to process document with GraphRAG',
      details: error.message
    });
  }
});

// Delete workflow data
router.delete('/workflow/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    await graphRagService.deleteWorkflowData(workflowId);

    res.json({
      success: true,
      workflowId,
      message: 'GraphRAG workflow data deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting GraphRAG workflow data:', error);
    res.status(500).json({
      error: 'Failed to delete GraphRAG workflow data',
      details: error.message
    });
  }
});

// Health check for GraphRAG services
router.get('/health', async (req, res) => {
  try {
    const health = {
      graphRagService: 'healthy',
      neo4jEnabled: graphRagService.neo4jEnabled,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      health
    });
  } catch (error) {
    logger.error('GraphRAG health check failed:', error);
    res.status(500).json({
      error: 'GraphRAG health check failed',
      details: error.message
    });
  }
});

module.exports = router;