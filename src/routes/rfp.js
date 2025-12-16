const express = require('express');
const agentOrchestrator = require('../orchestrator/agentOrchestrator');
const dataService = require('../services/workflowDataService');
const logger = require('../utils/logger');

const router = express.Router();

// Get all RFP processing workflows with database persistence
router.get('/workflows', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Use the new method that handles data consistency
    const workflows = await agentOrchestrator.getAllWorkflowsWithDatabase();
    
    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedWorkflows = workflows.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      workflows: paginatedWorkflows,
      count: paginatedWorkflows.length,
      total: workflows.length
    });
  } catch (error) {
    logger.error('Error fetching workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch workflows',
      details: error.message
    });
  }
});

// Get specific workflow status with full details
router.get('/workflow/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    
    // Get workflow status (now handles both memory and database)
    const workflow = await agentOrchestrator.getWorkflowStatus(workflowId);
    
    // Only return 404 if the workflow truly doesn't exist (no workflowId)
    // A workflow with an error message is still a valid workflow, just failed
    if (!workflow.workflowId) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    // Get additional details from database
    const [documents, results, requirements, questions, answers] = await Promise.all([
      dataService.getDocumentsByWorkflow(workflowId),
      dataService.getWorkflowResults(workflowId),
      dataService.getRequirements(workflowId),
      dataService.getQuestions(workflowId),
      dataService.getAnswers(workflowId)
    ]);

    res.json({
      success: true,
      ...workflow,
      documents,
      results,
      requirements,
      questions,
      answers
    });
  } catch (error) {
    logger.error('Error fetching workflow status:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow status',
      details: error.message
    });
  }
});

// Get workflow results
router.get('/workflow/:workflowId/results', (req, res) => {
  try {
    const { workflowId } = req.params;
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
        status: workflowState.status,
        progress: workflowState.progress
      });
    }

    res.json({
      success: true,
      workflowId,
      results: workflowState.results,
      summary: agentOrchestrator.generateWorkflowSummary(workflowId)
    });
  } catch (error) {
    logger.error('Error fetching workflow results:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow results',
      details: error.message
    });
  }
});

// Retry failed workflow
router.post('/workflow/:workflowId/retry', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { fromStep } = req.body;

    const result = await agentOrchestrator.retryWorkflow(workflowId, fromStep);

    res.json({
      success: true,
      message: result.message || 'Workflow retry initiated',
      workflowId,
      fromStep: result.fromStep
    });
  } catch (error) {
    logger.error('Error retrying workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry workflow',
      details: error.message,
      workflowId
    });
  }
});

// Cancel running workflow
router.post('/workflow/:workflowId/cancel', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    if (workflowState.status !== 'running') {
      return res.status(400).json({
        error: 'Workflow is not running',
        status: workflowState.status
      });
    }

    // Mark as cancelled
    workflowState.status = 'cancelled';
    workflowState.endTime = new Date();

    res.json({
      success: true,
      message: 'Workflow cancelled',
      workflowId
    });
  } catch (error) {
    logger.error('Error cancelling workflow:', error);
    res.status(500).json({
      error: 'Failed to cancel workflow',
      details: error.message
    });
  }
});

// Delete workflow
router.delete('/workflow/:workflowId', (req, res) => {
  try {
    const { workflowId } = req.params;
    
    agentOrchestrator.cleanup(workflowId);

    res.json({
      success: true,
      message: 'Workflow deleted',
      workflowId
    });
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    res.status(500).json({
      error: 'Failed to delete workflow',
      details: error.message
    });
  }
});

// Get workflow step details
router.get('/workflow/:workflowId/step/:stepName', (req, res) => {
  try {
    const { workflowId, stepName } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const stepResult = workflowState.results[stepName];
    
    if (!stepResult) {
      return res.status(404).json({
        error: 'Step not found or not completed',
        workflowId,
        stepName
      });
    }

    res.json({
      success: true,
      workflowId,
      stepName,
      result: stepResult
    });
  } catch (error) {
    logger.error('Error fetching step details:', error);
    res.status(500).json({
      error: 'Failed to fetch step details',
      details: error.message
    });
  }
});

// Get requirements analysis
router.get('/workflow/:workflowId/requirements', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const requirementsAnalysis = workflowState.results.requirementsAnalysis;
    
    if (!requirementsAnalysis) {
      return res.status(404).json({
        error: 'Requirements analysis not available',
        workflowId
      });
    }

    res.json({
      success: true,
      workflowId,
      requirementsAnalysis
    });
  } catch (error) {
    logger.error('Error fetching requirements analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch requirements analysis',
      details: error.message
    });
  }
});

// Get clarification questions
router.get('/workflow/:workflowId/questions', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const clarificationQuestions = workflowState.results.clarificationQuestions;
    
    if (!clarificationQuestions) {
      return res.status(404).json({
        error: 'Clarification questions not available',
        workflowId
      });
    }

    res.json({
      success: true,
      workflowId,
      clarificationQuestions
    });
  } catch (error) {
    logger.error('Error fetching clarification questions:', error);
    res.status(500).json({
      error: 'Failed to fetch clarification questions',
      details: error.message
    });
  }
});

// Get extracted answers
router.get('/workflow/:workflowId/answers', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const extractedAnswers = workflowState.results.extractedAnswers;
    
    if (!extractedAnswers) {
      return res.status(404).json({
        error: 'Extracted answers not available',
        workflowId
      });
    }

    res.json({
      success: true,
      workflowId,
      extractedAnswers
    });
  } catch (error) {
    logger.error('Error fetching extracted answers:', error);
    res.status(500).json({
      error: 'Failed to fetch extracted answers',
      details: error.message
    });
  }
});

// Get compiled response
router.get('/workflow/:workflowId/response', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowState = agentOrchestrator.workflowState[workflowId];
    
    if (!workflowState) {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    const compiledResponse = workflowState.results.compiledResponse;
    
    if (!compiledResponse) {
      return res.status(404).json({
        error: 'Compiled response not available',
        workflowId
      });
    }

    res.json({
      success: true,
      workflowId,
      compiledResponse
    });
  } catch (error) {
    logger.error('Error fetching compiled response:', error);
    res.status(500).json({
      error: 'Failed to fetch compiled response',
      details: error.message
    });
  }
});

// Reprocess answers for an existing workflow using RAG
router.post('/workflow/:workflowId/reprocess-answers', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const ragService = require('../services/ragService');
    
    logger.info(`Reprocessing answers for workflow: ${workflowId}`);
    
    // Get workflow questions directly from database
    const workflowResponse = await fetch(`http://localhost:3001/api/rfp/workflow/${workflowId}`);
    const workflowData = await workflowResponse.json();
    
    if (!workflowData.questions || workflowData.questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in workflow' });
    }
    
    const answers = [];
    let processed = 0;
    
    // Process all questions with RAG
    for (const question of workflowData.questions) {
      try {
        const result = await ragService.answerQuestion(question.question_text);
        
        if (result.confidence > 0.3) { // Minimum confidence threshold
          answers.push({
            questionId: question.question_id,
            question: question.question_text,
            answer: result.answer,
            confidence: result.confidence,
            sources: Array.isArray(result.sources) ? result.sources.map(source => ({
              documentName: source.documentId,
              excerpt: source.content,
              relevanceScore: source.similarity
            })) : [],
            answerType: result.confidence > 0.8 ? 'direct' : 'inferred',
            completeness: result.confidence > 0.7 ? 'complete' : 'partial'
          });
        }
        processed++;
      } catch (error) {
        logger.error(`Error answering question ${question.question_id}:`, error.message);
      }
    }
    
    // Update the workflow in database
    await dataService.updateWorkflowResults(workflowId, {
      extractedAnswers: {
        answeredQuestions: answers,
        unansweredQuestions: [],
        answerSummary: {
          totalQuestions: workflowData.questions.length,
          answered: answers.length,
          unanswered: workflowData.questions.length - answers.length,
          averageConfidence: answers.length > 0 ? 
            answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length : 0
        }
      },
      answers: answers
    });
    
    res.json({
      success: true,
      workflowId,
      message: 'Answers reprocessed successfully using RAG',
      totalQuestions: workflowData.questions.length,
      answersGenerated: answers.length,
      averageConfidence: answers.length > 0 ? 
        answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length : 0
    });
  } catch (error) {
    logger.error('Error reprocessing answers:', error);
    res.status(500).json({
      error: 'Failed to reprocess answers',
      details: error.message
    });
  }
});

// Get comprehensive dashboard statistics
router.get('/dashboard/statistics', async (req, res) => {
  try {
    const dataService = require('../services/workflowDataService');
    await dataService.initialize();
    
    // Get all workflows from database
    const allWorkflows = await dataService.getAllWorkflows(1000, 0);
    
    // Get in-memory workflows for current status
    const memoryWorkflows = agentOrchestrator.getAllWorkflows();
    
    // Merge and calculate statistics
    const workflowMap = new Map();
    
    // Add database workflows
    allWorkflows.forEach(workflow => {
      workflowMap.set(workflow.id, {
        ...workflow,
        source: 'database'
      });
    });
    
    // Update with memory workflows (more current status)
    memoryWorkflows.forEach(workflow => {
      const existing = workflowMap.get(workflow.workflowId) || {};
      workflowMap.set(workflow.workflowId, {
        ...existing,
        ...workflow,
        id: workflow.workflowId,
        source: 'memory'
      });
    });
    
    const workflows = Array.from(workflowMap.values());
    
    // Calculate statistics
    const stats = {
      total: workflows.length,
      byStatus: {
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        pending: 0
      },
      totalDocumentsProcessed: 0,
      totalRequirementsIdentified: 0,
      totalQuestionsGenerated: 0,
      totalAnswersGenerated: 0,
      averageConfidence: 0,
      weeklyActivity: []
    };
    
    let totalConfidence = 0;
    let answersCount = 0;
    
    // Count by status and aggregate data
    for (const workflow of workflows) {
      const status = workflow.status || 'pending';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Get additional data from database
      try {
        const [documents, requirements, questions, answers] = await Promise.all([
          dataService.getDocumentsByWorkflow(workflow.id),
          dataService.getRequirements(workflow.id),
          dataService.getQuestions(workflow.id),
          dataService.getAnswers(workflow.id)
        ]);
        
        stats.totalDocumentsProcessed += documents?.length || 0;
        stats.totalRequirementsIdentified += requirements?.length || 0;
        stats.totalQuestionsGenerated += questions?.length || 0;
        stats.totalAnswersGenerated += answers?.length || 0;
        
        // Calculate average confidence
        if (answers && answers.length > 0) {
          answers.forEach(answer => {
            if (answer.confidence_score) {
              totalConfidence += answer.confidence_score;
              answersCount++;
            }
          });
        }
      } catch (error) {
        logger.warn(`Error getting data for workflow ${workflow.id}:`, error.message);
      }
    }
    
    stats.averageConfidence = answersCount > 0 ? totalConfidence / answersCount : 0;
    
    // Calculate weekly activity (last 7 days)
    const now = new Date();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = weekDays[date.getDay()];
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayWorkflows = workflows.filter(w => {
        const createdAt = new Date(w.created_at || w.startTime);
        return createdAt >= dayStart && createdAt <= dayEnd;
      });
      
      stats.weeklyActivity.push({
        name: dayName,
        workflows: dayWorkflows.length,
        date: date.toISOString().split('T')[0]
      });
    }
    
    res.json({
      success: true,
      statistics: stats,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      details: error.message
    });
  }
});

// Delete workflow and cleanup
router.delete('/workflow/:workflowId/cleanup', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const dataService = require('../services/workflowDataService');
    
    // Delete from database
    await dataService.deleteWorkflow(workflowId);
    
    // Cleanup from memory
    agentOrchestrator.cleanup(workflowId);
    
    res.json({
      success: true,
      message: 'Workflow deleted and cleaned up successfully',
      workflowId
    });
    
  } catch (error) {
    logger.error('Error cleaning up workflow:', error);
    res.status(500).json({
      error: 'Failed to cleanup workflow',
      details: error.message
    });
  }
});

// Cleanup corrupted workflows
router.post('/workflows/cleanup-corrupted', async (req, res) => {
  try {
    await agentOrchestrator.cleanupCorruptedWorkflows();
    
    res.json({
      success: true,
      message: 'Corrupted workflows cleaned up successfully'
    });
    
  } catch (error) {
    logger.error('Error cleaning up corrupted workflows:', error);
    res.status(500).json({
      error: 'Failed to cleanup corrupted workflows',
      details: error.message
    });
  }
});

module.exports = router;