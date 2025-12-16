const express = require('express');
const agentOrchestrator = require('../orchestrator/agentOrchestrator');
const pdfGenerator = require('../services/pdfGenerator');
const logger = require('../utils/logger');

const router = express.Router();

// Start streaming workflow
router.post('/start-streaming', async (req, res) => {
  try {
    const { projectContext, companyDocuments = [] } = req.body;
    const uploadedFiles = req.files || [];

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No RFP documents uploaded'
      });
    }

    // Prepare documents for processing
    const documents = uploadedFiles.map(file => ({
      id: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    // Set up progress callback for streaming
    const progressCallback = (progress) => {
      // This would be handled by Socket.IO in the main server
      logger.info('Streaming progress:', progress);
    };

    // Start streaming workflow
    const result = await agentOrchestrator.processRFPStreaming(
      documents, 
      companyDocuments, 
      projectContext, 
      progressCallback
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Error starting streaming workflow:', error);
    res.status(500).json({
      error: 'Failed to start streaming workflow',
      details: error.message
    });
  }
});

// Get workflow metrics
router.get('/:workflowId/metrics', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const metrics = {
      workflowId,
      status: workflowState.status,
      startTime: workflowState.startTime,
      endTime: workflowState.endTime,
      duration: workflowState.duration,
      currentStep: workflowState.currentStep,
      progress: workflowState.progress,
      steps: {
        document_ingestion: {
          completed: !!workflowState.results.ingestedDocuments,
          documentsProcessed: workflowState.results.ingestedDocuments?.length || 0
        },
        requirements_analysis: {
          completed: !!workflowState.results.requirementsAnalysis,
          requirementsFound: workflowState.results.requirementsAnalysis ? 
            this.countRequirements(workflowState.results.requirementsAnalysis) : 0
        },
        clarification_questions: {
          completed: !!workflowState.results.clarificationQuestions,
          questionsGenerated: workflowState.results.clarificationQuestions?.questionSummary?.totalQuestions || 0
        },
        answer_extraction: {
          completed: !!workflowState.results.extractedAnswers,
          questionsAnswered: workflowState.results.extractedAnswers?.answeredQuestions?.length || 0,
          averageConfidence: workflowState.results.extractedAnswers?.answerSummary?.averageConfidence || 0
        },
        response_compilation: {
          completed: !!workflowState.results.compiledResponse,
          completenessScore: workflowState.results.compiledResponse?.qualityAssurance?.completenessScore || 0
        }
      }
    };

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    logger.error('Error fetching workflow metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow metrics',
      details: error.message
    });
  }
});

// Export workflow data
router.get('/:workflowId/export', (req, res) => {
  try {
    const { workflowId } = req.params;
    const { format = 'json' } = req.query;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const exportData = {
      workflowId,
      exportedAt: new Date().toISOString(),
      status: workflowState.status,
      startTime: workflowState.startTime,
      endTime: workflowState.endTime,
      duration: workflowState.duration,
      results: workflowState.results,
      summary: agentOrchestrator.generateWorkflowSummary(workflowId)
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="rfp-workflow-${workflowId}.json"`);
      res.json(exportData);
    } else {
      res.status(400).json({
        error: 'Unsupported export format',
        supportedFormats: ['json']
      });
    }

  } catch (error) {
    logger.error('Error exporting workflow data:', error);
    res.status(500).json({
      error: 'Failed to export workflow data',
      details: error.message
    });
  }
});

// Generate custom PDF with specific sections
router.post('/:workflowId/pdf/custom', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { sections, projectContext } = req.body;
    
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    if (workflowState.status !== 'completed') {
      return res.status(400).json({
        error: 'Workflow not completed yet',
        status: workflowState.status
      });
    }

    // Filter results based on requested sections
    const filteredResults = {};
    const availableSections = ['ingestedDocuments', 'requirementsAnalysis', 'clarificationQuestions', 'extractedAnswers', 'compiledResponse'];
    
    availableSections.forEach(section => {
      if (!sections || sections.includes(section)) {
        filteredResults[section] = workflowState.results[section];
      }
    });

    // Generate PDF with filtered content
    const pdfBuffer = await pdfGenerator.generateRFPReport(filteredResults, projectContext);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rfp-custom-${workflowId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Error generating custom PDF:', error);
    res.status(500).json({
      error: 'Failed to generate custom PDF',
      details: error.message
    });
  }
});

// Get workflow statistics
router.get('/statistics', (req, res) => {
  try {
    const allWorkflows = agentOrchestrator.getAllWorkflows();
    
    const stats = {
      total: allWorkflows.length,
      byStatus: {
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      averageDuration: 0,
      totalDocumentsProcessed: 0,
      totalRequirementsIdentified: 0,
      totalQuestionsGenerated: 0
    };

    let totalDuration = 0;
    let completedCount = 0;

    allWorkflows.forEach(workflow => {
      stats.byStatus[workflow.status] = (stats.byStatus[workflow.status] || 0) + 1;
      
      if (workflow.status === 'completed' && workflow.duration) {
        totalDuration += workflow.duration;
        completedCount++;
      }

      // Get workflow details for aggregation
      const workflowState = agentOrchestrator.workflowState[workflow.workflowId];
      if (workflowState && workflowState.results) {
        stats.totalDocumentsProcessed += workflowState.results.ingestedDocuments?.length || 0;
        stats.totalRequirementsIdentified += countRequirements(workflowState.results.requirementsAnalysis) || 0;
        stats.totalQuestionsGenerated += workflowState.results.clarificationQuestions?.questionSummary?.totalQuestions || 0;
      }
    });

    stats.averageDuration = completedCount > 0 ? totalDuration / completedCount : 0;

    res.json({
      success: true,
      statistics: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching workflow statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow statistics',
      details: error.message
    });
  }
});

// Cleanup old workflows
router.post('/cleanup', (req, res) => {
  try {
    const { maxAge } = req.body; // in milliseconds
    const maxAgeMs = maxAge || 24 * 60 * 60 * 1000; // Default 24 hours
    
    const beforeCount = Object.keys(agentOrchestrator.workflowState).length;
    agentOrchestrator.cleanupOldWorkflows(maxAgeMs);
    const afterCount = Object.keys(agentOrchestrator.workflowState).length;
    
    const cleanedCount = beforeCount - afterCount;

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} old workflows`,
      beforeCount,
      afterCount,
      cleanedCount
    });

  } catch (error) {
    logger.error('Error cleaning up workflows:', error);
    res.status(500).json({
      error: 'Failed to cleanup workflows',
      details: error.message
    });
  }
});

// Helper function to count requirements
function countRequirements(requirementsAnalysis) {
  if (!requirementsAnalysis?.requirements) return 0;
  
  let count = 0;
  Object.values(requirementsAnalysis.requirements).forEach(reqs => {
    if (Array.isArray(reqs)) count += reqs.length;
  });
  return count;
}

module.exports = router;