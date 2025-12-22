const documentIngestionAgent = require('../agents/documentIngestionAgent');
const requirementsAnalysisAgent = require('../agents/requirementsAnalysisAgent');
const clarificationQuestionsAgent = require('../agents/clarificationQuestionsAgent');
const answerExtractionAgent = require('../agents/answerExtractionAgent');
const responseCompilationAgent = require('../agents/responseCompilationAgent');
const dataService = require('../services/workflowDataService');
const logger = require('../utils/logger');

class AgentOrchestrator {
  constructor() {
    this.agents = {
      documentIngestion: documentIngestionAgent,
      requirementsAnalysis: requirementsAnalysisAgent,
      clarificationQuestions: clarificationQuestionsAgent,
      answerExtraction: answerExtractionAgent,
      responseCompilation: responseCompilationAgent
    };
    
    this.workflowState = {};
    this.progressCallbacks = new Map();
  }

  async processRFP(documents, companyDocuments, projectContext, progressCallback, workflowId = null) {
    if (!workflowId) {
      workflowId = this.generateWorkflowId();
    }
    
    try {
      logger.info('Starting RFP processing workflow', { 
        workflowId, 
        rfpDocuments: documents.length,
        companyDocuments: companyDocuments.length 
      });

      // Initialize workflow state
      this.workflowState[workflowId] = {
        status: 'running',
        currentStep: 'document_ingestion',
        progress: 0,
        startTime: new Date(),
        results: {}
      };

      // Save workflow to database
      await dataService.createWorkflow({
        id: workflowId,
        status: 'running',
        currentStep: 'document_ingestion',
        progress: 0,
        projectContext
      });

      if (progressCallback) {
        this.progressCallbacks.set(workflowId, progressCallback);
      }

      // Save uploaded documents to database
      for (const doc of documents) {
        await dataService.createDocument({
          id: doc.id,
          workflowId: workflowId,
          originalName: doc.originalName,
          filePath: doc.path,
          fileSize: doc.size,
          mimeType: doc.mimetype,
          documentType: 'rfp',
          processingStatus: 'pending'
        });
      }

      // Step 1: Document Ingestion
      await this.updateProgress(workflowId, 'document_ingestion', 10, 'Processing RFP documents...');
      const ingestedDocuments = await this.agents.documentIngestion.processDocuments(documents, workflowId);
      this.workflowState[workflowId].results.ingestedDocuments = ingestedDocuments;
      
      // Save document ingestion results
      await dataService.saveWorkflowResult(workflowId, 'document_ingestion', ingestedDocuments, 0.9, Date.now() - this.workflowState[workflowId].startTime);

      // Step 1.5: GraphRAG Processing (ensure knowledge graph creation)
      await this.updateProgress(workflowId, 'graphrag_processing', 15, 'Creating knowledge graph...');
      try {
        const graphRagService = require('../services/graphRagService');
        await graphRagService.initialize();
        
        // Process each document for GraphRAG if it wasn't already processed
        for (const doc of ingestedDocuments) {
          if (doc.processedContent && doc.fileName) {
            logger.info(`Ensuring GraphRAG processing for: ${doc.fileName}`);
            
            const documentData = {
              filename: doc.fileName,
              content: doc.processedContent,
              metadata: doc.metadata || {}
            };
            
            // Create chunks and embeddings
            const documentProcessor = require('../services/documentProcessor');
            const chunks = documentProcessor.createChunks(doc.processedContent);
            const embeddings = await documentProcessor.generateEmbeddings(chunks);
            
            // Process with GraphRAG
            await graphRagService.processDocument(workflowId, documentData, chunks, embeddings);
            logger.info(`GraphRAG processing completed for: ${doc.fileName}`);
          }
        }
        
        logger.info(`GraphRAG processing completed for workflow: ${workflowId}`);
      } catch (graphError) {
        logger.warn(`GraphRAG processing failed for workflow ${workflowId}:`, graphError.message);
        // Don't fail the entire workflow if GraphRAG fails
      }

      // Step 2: Requirements Analysis
      await this.updateProgress(workflowId, 'requirements_analysis', 30, 'Analyzing requirements...');
      const requirementsAnalysis = await this.agents.requirementsAnalysis.analyzeRequirements(ingestedDocuments);
      this.workflowState[workflowId].results.requirementsAnalysis = requirementsAnalysis;
      
      // Save requirements analysis results
      await dataService.saveWorkflowResult(workflowId, 'requirements_analysis', requirementsAnalysis, 0.85, Date.now() - this.workflowState[workflowId].startTime);
      
      // Save individual requirements to database
      if (requirementsAnalysis && requirementsAnalysis.requirements) {
        const flattenedRequirements = this.flattenRequirements(requirementsAnalysis.requirements);
        if (flattenedRequirements.length > 0) {
          await dataService.saveRequirements(workflowId, flattenedRequirements);
        }
      }

      // Step 3: Generate Clarification Questions
      await this.updateProgress(workflowId, 'clarification_questions', 50, 'Generating clarification questions...');
      const clarificationQuestions = await this.agents.clarificationQuestions.generateQuestions(
        requirementsAnalysis, 
        ingestedDocuments
      );
      this.workflowState[workflowId].results.clarificationQuestions = clarificationQuestions;
      
      // Validate clarification questions step
      const flattenedQuestions = this.flattenQuestions(clarificationQuestions);
      if (flattenedQuestions.length === 0) {
        const errorMsg = 'Clarification questions generation failed - no valid questions produced';
        logger.error(errorMsg, { workflowId });
        this.workflowState[workflowId].status = 'failed';
        this.workflowState[workflowId].error = errorMsg;
        await dataService.updateWorkflowStatus(workflowId, 'failed', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Save clarification questions results
      await dataService.saveWorkflowResult(workflowId, 'clarification_questions', clarificationQuestions, 0.88, Date.now() - this.workflowState[workflowId].startTime);
      
      // Save individual questions to database
      await dataService.saveQuestions(workflowId, flattenedQuestions);

      // Step 4: Extract Answers from Company Documents
      await this.updateProgress(workflowId, 'answer_extraction', 70, 'Extracting answers from company documents...');
      const extractedAnswers = await this.agents.answerExtraction.extractAnswers(
        clarificationQuestions,
        companyDocuments,
        requirementsAnalysis,
        workflowId
      );
      this.workflowState[workflowId].results.extractedAnswers = extractedAnswers;
      
      // Validate answer extraction step
      const flattenedAnswers = this.flattenAnswers(extractedAnswers);
      if (flattenedAnswers.length === 0) {
        logger.warn('Answer extraction produced no answers', { workflowId, questionsCount: flattenedQuestions.length });
        // Don't fail the workflow for no answers, as this might be expected if no answers are found in documents
      }
      
      // Save answer extraction results
      await dataService.saveWorkflowResult(workflowId, 'answer_extraction', extractedAnswers, 0.82, Date.now() - this.workflowState[workflowId].startTime);
      
      // Save individual answers to database
      if (flattenedAnswers.length > 0) {
        await dataService.saveAnswers(workflowId, flattenedAnswers);
      }

      // Step 5: Compile Response
      await this.updateProgress(workflowId, 'response_compilation', 90, 'Compiling final response...');
      const compiledResponse = await this.agents.responseCompilation.compileResponse(
        requirementsAnalysis,
        clarificationQuestions,
        extractedAnswers,
        projectContext
      );
      this.workflowState[workflowId].results.compiledResponse = compiledResponse;
      
      // Save compiled response results
      await dataService.saveWorkflowResult(workflowId, 'response_compilation', compiledResponse, 0.95, Date.now() - this.workflowState[workflowId].startTime);

      // Complete workflow
      await this.updateProgress(workflowId, 'completed', 100, 'RFP processing completed successfully');
      
      // Update workflow status in database
      await dataService.updateWorkflow(workflowId, {
        status: 'completed',
        currentStep: 'completed',
        progress: 100,
        endTime: new Date(),
        duration: Date.now() - this.workflowState[workflowId].startTime
      });
      
      this.workflowState[workflowId].status = 'completed';
      this.workflowState[workflowId].endTime = new Date();
      this.workflowState[workflowId].duration = 
        this.workflowState[workflowId].endTime - this.workflowState[workflowId].startTime;

      logger.info('RFP processing workflow completed', { 
        workflowId,
        duration: this.workflowState[workflowId].duration
      });

      return {
        workflowId,
        status: 'completed',
        results: this.workflowState[workflowId].results,
        summary: this.generateWorkflowSummary(workflowId)
      };

    } catch (error) {
      logger.error('RFP processing workflow failed', { workflowId, error });
      
      this.workflowState[workflowId].status = 'failed';
      this.workflowState[workflowId].error = error.message;
      this.workflowState[workflowId].endTime = new Date();

      await this.updateProgress(workflowId, 'failed', -1, `Workflow failed: ${error.message}`);

      throw error;
    } finally {
      // Cleanup progress callback
      this.progressCallbacks.delete(workflowId);
    }
  }

  async processRFPStreaming(documents, companyDocuments, projectContext, progressCallback, workflowId = null) {
    if (!workflowId) {
      workflowId = this.generateWorkflowId();
    }
    
    try {
      logger.info('Starting streaming RFP processing workflow', { workflowId });

      // Initialize workflow state
      this.workflowState[workflowId] = {
        status: 'running',
        currentStep: 'document_ingestion',
        progress: 0,
        startTime: new Date(),
        results: {},
        streaming: true
      };

      if (progressCallback) {
        this.progressCallbacks.set(workflowId, progressCallback);
      }

      // Step 1: Document Ingestion (non-streaming)
      await this.updateProgress(workflowId, 'document_ingestion', 10, 'Processing RFP documents...');
      const ingestedDocuments = await this.agents.documentIngestion.processDocuments(documents, workflowId);
      this.workflowState[workflowId].results.ingestedDocuments = ingestedDocuments;

      // Step 2: Requirements Analysis (streaming)
      await this.updateProgress(workflowId, 'requirements_analysis', 30, 'Analyzing requirements...');
      const requirementsAnalysis = await this.executeStreamingAgent(
        this.agents.requirementsAnalysis,
        this.agents.requirementsAnalysis.combineDocumentData(ingestedDocuments),
        workflowId,
        'requirements_analysis'
      );
      this.workflowState[workflowId].results.requirementsAnalysis = requirementsAnalysis;

      // Continue with other steps...
      // (Similar pattern for other agents)

      return {
        workflowId,
        status: 'streaming',
        message: 'Streaming workflow initiated'
      };

    } catch (error) {
      logger.error('Streaming RFP processing workflow failed', { workflowId, error });
      throw error;
    }
  }

  async executeStreamingAgent(agent, input, workflowId, stepName) {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      
      const onChunk = (chunk) => {
        fullResponse += chunk;
        
        // Send streaming update
        const callback = this.progressCallbacks.get(workflowId);
        if (callback) {
          callback({
            workflowId,
            step: stepName,
            type: 'stream',
            chunk,
            fullResponse
          });
        }
      };

      agent.executeStreaming(input, {}, onChunk)
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  async updateProgress(workflowId, step, progress, message) {
    if (this.workflowState[workflowId]) {
      this.workflowState[workflowId].currentStep = step;
      this.workflowState[workflowId].progress = progress;
      this.workflowState[workflowId].lastUpdate = new Date();
    }

    // Update in database
    await dataService.updateWorkflow(workflowId, {
      currentStep: step,
      progress: progress,
      status: progress === 100 ? 'completed' : 'running'
    });

    const callback = this.progressCallbacks.get(workflowId);
    if (callback) {
      callback({
        workflowId,
        step,
        progress,
        message,
        timestamp: new Date()
      });
    }

    logger.info('Workflow progress update', { workflowId, step, progress, message });
  }

  generateWorkflowId() {
    return `rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateWorkflowSummary(workflowId) {
    const state = this.workflowState[workflowId];
    if (!state) return null;

    const results = state.results;
    
    return {
      workflowId,
      status: state.status,
      duration: state.duration,
      summary: {
        documentsProcessed: results.ingestedDocuments?.length || 0,
        requirementsIdentified: this.countRequirements(results.requirementsAnalysis),
        questionsGenerated: results.clarificationQuestions?.questionSummary?.totalQuestions || 0,
        questionsAnswered: results.extractedAnswers?.answeredQuestions?.length || 0,
        completenessScore: results.compiledResponse?.qualityAssurance?.completenessScore || 0,
        criticalGaps: results.compiledResponse?.gapsAndActions?.criticalGaps?.length || 0
      },
      recommendations: this.generateRecommendations(results)
    };
  }

  countRequirements(requirementsAnalysis) {
    if (!requirementsAnalysis?.requirements) return 0;
    
    let count = 0;
    Object.values(requirementsAnalysis.requirements).forEach(reqs => {
      if (Array.isArray(reqs)) count += reqs.length;
    });
    return count;
  }

  generateRecommendations(results) {
    const recommendations = [];

    // Check completeness
    const completeness = results.compiledResponse?.qualityAssurance?.completenessScore || 0;
    if (completeness < 0.7) {
      recommendations.push({
        type: 'completeness',
        priority: 'high',
        message: 'Response completeness is below 70%. Focus on filling gaps.'
      });
    }

    // Check unanswered questions
    const unanswered = results.extractedAnswers?.unansweredQuestions?.length || 0;
    if (unanswered > 0) {
      recommendations.push({
        type: 'gaps',
        priority: 'medium',
        message: `${unanswered} questions remain unanswered. Consider additional research.`
      });
    }

    // Check confidence levels
    const avgConfidence = results.extractedAnswers?.answerSummary?.averageConfidence || 0;
    if (avgConfidence < 0.7) {
      recommendations.push({
        type: 'confidence',
        priority: 'medium',
        message: 'Average answer confidence is low. Review and strengthen responses.'
      });
    }

    return recommendations;
  }

  async getWorkflowStatus(workflowId) {
    // First try to get from memory (most recent data)
    const state = this.workflowState[workflowId];
    if (state) {
      return {
        workflowId,
        status: state.status,
        currentStep: state.currentStep,
        progress: state.progress,
        startTime: state.startTime,
        lastUpdate: state.lastUpdate,
        error: state.error,
        results: state.results
      };
    }

    // If not in memory, try to load from database
    try {
      const dbWorkflow = await dataService.getWorkflow(workflowId);
      if (dbWorkflow) {
        // Reconstruct workflow state from database
        const reconstructedState = {
          workflowId: dbWorkflow.id,
          status: dbWorkflow.status,
          currentStep: dbWorkflow.current_step,
          progress: dbWorkflow.progress,
          startTime: new Date(dbWorkflow.start_time),
          endTime: dbWorkflow.end_time ? new Date(dbWorkflow.end_time) : null,
          duration: dbWorkflow.duration,
          error: dbWorkflow.error_message,
          projectContext: this.parseJSON(dbWorkflow.project_context)
        };

        // Load workflow results from database
        const [results, documents, requirements, questions, answers] = await Promise.all([
          dataService.getWorkflowResults(workflowId),
          dataService.getDocumentsByWorkflow(workflowId),
          dataService.getRequirements(workflowId),
          dataService.getQuestions(workflowId),
          dataService.getAnswers(workflowId)
        ]);

        // Reconstruct results structure
        reconstructedState.results = {
          ingestedDocuments: documents,
          requirementsAnalysis: this.reconstructRequirementsAnalysis(requirements, results),
          clarificationQuestions: this.reconstructClarificationQuestions(questions, results),
          extractedAnswers: this.reconstructExtractedAnswers(answers, results),
          compiledResponse: this.reconstructCompiledResponse(results)
        };

        // Store in memory for future access
        this.workflowState[workflowId] = reconstructedState;

        return reconstructedState;
      }
    } catch (error) {
      logger.error('Error loading workflow from database:', error);
    }

    return { error: 'Workflow not found' };
  }

  getAllWorkflows() {
    const workflows = [];
    
    // Get workflows from memory
    Object.keys(this.workflowState).forEach(workflowId => {
      const state = this.workflowState[workflowId];
      if (state) {
        // Ensure progress is within valid range (0-100)
        let validProgress = state.progress;
        if (validProgress < 0) validProgress = 0;
        if (validProgress > 100) validProgress = 100;
        
        // Ensure status consistency - if there's an error, status should be 'failed'
        let validStatus = state.status;
        if (state.error && validStatus === 'running') {
          validStatus = 'failed';
        }
        
        // Ensure current step consistency - if status is failed but currentStep is not 'failed'
        let validCurrentStep = state.currentStep;
        if (validStatus === 'failed' && validCurrentStep !== 'failed') {
          validCurrentStep = 'failed';
        }
        
        workflows.push({
          workflowId,
          status: validStatus,
          currentStep: validCurrentStep,
          progress: validProgress,
          startTime: state.startTime,
          lastUpdate: state.lastUpdate,
          error: state.error,
          results: state.results
        });
      }
    });
    
    return workflows;
  }

  async getAllWorkflowsWithDatabase() {
    try {
      // Get workflows from database
      const dbWorkflows = await dataService.getAllWorkflows(1000, 0);
      const memoryWorkflows = this.getAllWorkflows();
      
      // Create a map to merge data
      const workflowMap = new Map();
      
      // Add database workflows first
      dbWorkflows.forEach(workflow => {
        workflowMap.set(workflow.id, {
          workflowId: workflow.id,
          status: workflow.status,
          currentStep: workflow.current_step,
          progress: Math.max(0, Math.min(100, workflow.progress || 0)),
          startTime: new Date(workflow.start_time),
          endTime: workflow.end_time ? new Date(workflow.end_time) : null,
          duration: workflow.duration,
          error: workflow.error_message,
          source: 'database'
        });
      });
      
      // Update with memory workflows (more current data)
      memoryWorkflows.forEach(workflow => {
        const existing = workflowMap.get(workflow.workflowId) || {};
        workflowMap.set(workflow.workflowId, {
          ...existing,
          ...workflow,
          source: 'memory'
        });
      });
      
      // Filter out any workflows that don't have complete data
      const validWorkflows = Array.from(workflowMap.values()).filter(workflow => {
        return workflow.workflowId && workflow.status && workflow.startTime;
      });
      
      return validWorkflows.sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      );
      
    } catch (error) {
      logger.error('Error getting workflows with database:', error);
      // Fallback to memory-only workflows
      return this.getAllWorkflows();
    }
  }

  async retryWorkflow(workflowId, fromStep = null) {
    // First try to get workflow from memory
    let state = this.workflowState[workflowId];
    
    // If not in memory, try to load from database
    if (!state) {
      logger.info('Workflow not in memory, attempting to load from database', { workflowId });
      const workflowData = await this.getWorkflowStatus(workflowId);
      if (workflowData.error) {
        throw new Error('Workflow not found');
      }
      state = this.workflowState[workflowId]; // Should be loaded now
    }

    if (!state) {
      throw new Error('Workflow not found');
    }

    // Allow retry of running workflows that are actually stuck/failed
    if (state.status === 'running') {
      // Check if workflow is actually stuck (no progress for a while)
      const timeSinceLastUpdate = Date.now() - (state.lastUpdate?.getTime() || state.startTime?.getTime() || 0);
      const isStuck = timeSinceLastUpdate > 5 * 60 * 1000; // 5 minutes
      
      if (!isStuck) {
        throw new Error('Cannot retry running workflow - workflow is still actively processing');
      }
      
      logger.warn('Retrying stuck workflow', { workflowId, timeSinceLastUpdate });
    }

    logger.info('Retrying workflow', { workflowId, fromStep, currentStatus: state.status });

    try {
      // Reset state for retry
      state.status = 'running';
      state.error = null;
      state.progress = fromStep ? this.getStepProgress(fromStep) : 0;
      state.currentStep = fromStep || 'document_ingestion';
      state.lastUpdate = new Date();

      // Update database status
      await dataService.updateWorkflow(workflowId, {
        status: 'running',
        currentStep: state.currentStep,
        progress: state.progress,
        error_message: null
      });

      // Get original workflow data for reprocessing
      const [documents, requirements, questions] = await Promise.all([
        dataService.getDocumentsByWorkflow(workflowId),
        dataService.getRequirements(workflowId),
        dataService.getQuestions(workflowId)
      ]);

      // Determine what data we need for retry
      let rfpDocuments = [];
      let companyDocuments = []; // For now, empty - could be enhanced later
      let projectContext = state.projectContext || { title: 'Retried RFP Analysis' };

      // Convert database documents back to the format expected by processRFP
      if (documents && documents.length > 0) {
        rfpDocuments = documents.map(doc => ({
          id: doc.document_id,
          originalName: doc.original_name,
          path: doc.file_path,
          size: doc.file_size,
          mimetype: doc.mime_type
        }));
      }

      // Start processing from the specified step or beginning
      if (fromStep) {
        await this.resumeFromStep(workflowId, fromStep, state);
      } else {
        // Full retry - restart the entire workflow
        await this.processRFP(rfpDocuments, companyDocuments, projectContext, null, workflowId);
      }

      return {
        success: true,
        message: 'Workflow retry initiated successfully',
        workflowId,
        fromStep: fromStep || 'document_ingestion'
      };

    } catch (error) {
      logger.error('Error during workflow retry', { workflowId, error: error.message });
      
      // Update state to reflect retry failure
      state.status = 'failed';
      state.error = `Retry failed: ${error.message}`;
      
      await dataService.updateWorkflow(workflowId, {
        status: 'failed',
        error_message: state.error
      });
      
      throw error;
    }
  }

  async resumeFromStep(workflowId, fromStep, state) {
    logger.info('Resuming workflow from step', { workflowId, fromStep });
    
    try {
      // Get existing data from previous steps
      const results = state.results || {};
      
      switch (fromStep) {
        case 'requirements_analysis':
          if (!results.ingestedDocuments) {
            throw new Error('Cannot resume from requirements_analysis - no ingested documents found');
          }
          await this.executeRequirementsAnalysis(workflowId, results.ingestedDocuments);
          break;
          
        case 'clarification_questions':
          if (!results.requirementsAnalysis) {
            throw new Error('Cannot resume from clarification_questions - no requirements analysis found');
          }
          await this.executeClarificationQuestions(workflowId, results.requirementsAnalysis, results.ingestedDocuments);
          break;
          
        case 'answer_extraction':
          if (!results.clarificationQuestions) {
            throw new Error('Cannot resume from answer_extraction - no clarification questions found');
          }
          await this.executeAnswerExtraction(workflowId, results.clarificationQuestions, results.requirementsAnalysis);
          break;
          
        case 'response_compilation':
          if (!results.extractedAnswers) {
            throw new Error('Cannot resume from response_compilation - no extracted answers found');
          }
          await this.executeResponseCompilation(workflowId, results);
          break;
          
        default:
          throw new Error(`Unknown step: ${fromStep}`);
      }
    } catch (error) {
      logger.error('Error resuming workflow from step', { workflowId, fromStep, error: error.message });
      throw error;
    }
  }

  async executeRequirementsAnalysis(workflowId, ingestedDocuments) {
    await this.updateProgress(workflowId, 'requirements_analysis', 30, 'Analyzing requirements...');
    const requirementsAnalysis = await this.agents.requirementsAnalysis.analyzeRequirements(ingestedDocuments);
    this.workflowState[workflowId].results.requirementsAnalysis = requirementsAnalysis;
    
    await dataService.saveWorkflowResult(workflowId, 'requirements_analysis', requirementsAnalysis, 0.85, Date.now() - this.workflowState[workflowId].startTime);
    
    if (requirementsAnalysis && requirementsAnalysis.requirements) {
      const flattenedRequirements = this.flattenRequirements(requirementsAnalysis.requirements);
      if (flattenedRequirements.length > 0) {
        await dataService.saveRequirements(workflowId, flattenedRequirements);
      }
    }
    
    // Continue to next step
    await this.executeClarificationQuestions(workflowId, requirementsAnalysis, ingestedDocuments);
  }

  async executeClarificationQuestions(workflowId, requirementsAnalysis, ingestedDocuments) {
    await this.updateProgress(workflowId, 'clarification_questions', 50, 'Generating clarification questions...');
    const clarificationQuestions = await this.agents.clarificationQuestions.generateQuestions(
      requirementsAnalysis, 
      ingestedDocuments
    );
    this.workflowState[workflowId].results.clarificationQuestions = clarificationQuestions;
    
    const flattenedQuestions = this.flattenQuestions(clarificationQuestions);
    if (flattenedQuestions.length === 0) {
      const errorMsg = 'Clarification questions generation failed - no valid questions produced';
      logger.error(errorMsg, { workflowId });
      this.workflowState[workflowId].status = 'failed';
      this.workflowState[workflowId].error = errorMsg;
      await dataService.updateWorkflowStatus(workflowId, 'failed', errorMsg);
      throw new Error(errorMsg);
    }
    
    await dataService.saveWorkflowResult(workflowId, 'clarification_questions', clarificationQuestions, 0.88, Date.now() - this.workflowState[workflowId].startTime);
    await dataService.saveQuestions(workflowId, flattenedQuestions);
    
    // Continue to next step
    await this.executeAnswerExtraction(workflowId, clarificationQuestions, requirementsAnalysis);
  }

  async executeAnswerExtraction(workflowId, clarificationQuestions, requirementsAnalysis) {
    await this.updateProgress(workflowId, 'answer_extraction', 70, 'Extracting answers from company documents...');
    const extractedAnswers = await this.agents.answerExtraction.extractAnswers(
      clarificationQuestions,
      [], // No company documents for RAG-based extraction
      requirementsAnalysis,
      workflowId
    );
    this.workflowState[workflowId].results.extractedAnswers = extractedAnswers;
    
    const flattenedAnswers = this.flattenAnswers(extractedAnswers);
    await dataService.saveWorkflowResult(workflowId, 'answer_extraction', extractedAnswers, 0.82, Date.now() - this.workflowState[workflowId].startTime);
    
    if (flattenedAnswers.length > 0) {
      await dataService.saveAnswers(workflowId, flattenedAnswers);
    }
    
    // Continue to next step
    await this.executeResponseCompilation(workflowId, this.workflowState[workflowId].results);
  }

  async executeResponseCompilation(workflowId, results) {
    await this.updateProgress(workflowId, 'response_compilation', 90, 'Compiling final response...');
    const compiledResponse = await this.agents.responseCompilation.compileResponse(
      results.requirementsAnalysis,
      results.clarificationQuestions,
      results.extractedAnswers,
      this.workflowState[workflowId].projectContext || { title: 'RFP Analysis' }
    );
    this.workflowState[workflowId].results.compiledResponse = compiledResponse;
    
    await dataService.saveWorkflowResult(workflowId, 'response_compilation', compiledResponse, 0.95, Date.now() - this.workflowState[workflowId].startTime);
    
    // Complete workflow
    await this.updateProgress(workflowId, 'completed', 100, 'RFP processing completed successfully');
    
    await dataService.updateWorkflow(workflowId, {
      status: 'completed',
      currentStep: 'completed',
      progress: 100,
      endTime: new Date(),
      duration: Date.now() - this.workflowState[workflowId].startTime
    });
    
    this.workflowState[workflowId].status = 'completed';
    this.workflowState[workflowId].endTime = new Date();
    this.workflowState[workflowId].duration = 
      this.workflowState[workflowId].endTime - this.workflowState[workflowId].startTime;
  }

  getStepProgress(step) {
    const stepProgress = {
      'document_ingestion': 10,
      'requirements_analysis': 30,
      'clarification_questions': 50,
      'answer_extraction': 70,
      'response_compilation': 90
    };
    return stepProgress[step] || 0;
  }

  cleanup(workflowId) {
    if (this.workflowState[workflowId]) {
      delete this.workflowState[workflowId];
      this.progressCallbacks.delete(workflowId);
      logger.info('Workflow cleaned up', { workflowId });
    }
  }

  // Cleanup old workflows (call periodically)
  cleanupOldWorkflows(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = new Date();
    const workflowsToCleanup = [];

    Object.entries(this.workflowState).forEach(([workflowId, state]) => {
      const age = now - state.startTime;
      if (age > maxAge && state.status !== 'running') {
        workflowsToCleanup.push(workflowId);
      }
    });

    workflowsToCleanup.forEach(workflowId => {
      this.cleanup(workflowId);
    });

    if (workflowsToCleanup.length > 0) {
      logger.info('Cleaned up old workflows', { count: workflowsToCleanup.length });
    }
  }

  // Clean up corrupted workflow states
  async cleanupCorruptedWorkflows() {
    try {
      const workflowsToFix = [];
      
      // Check in-memory workflows first
      Object.entries(this.workflowState).forEach(([workflowId, state]) => {
        const issues = [];
        
        // Check for invalid progress values
        if (state.progress < -1 || state.progress > 100) {
          issues.push('invalid_progress');
        }
        
        // Check for status/step mismatches
        if (state.status === 'running' && state.currentStep === 'failed') {
          issues.push('status_step_mismatch');
        }
        
        // Check for stuck workflows (running for too long without updates)
        if (state.status === 'running') {
          const timeSinceLastUpdate = Date.now() - (state.lastUpdate?.getTime() || state.startTime?.getTime() || 0);
          if (timeSinceLastUpdate > 10 * 60 * 1000) { // 10 minutes
            issues.push('stuck_workflow');
          }
        }
        
        if (issues.length > 0) {
          workflowsToFix.push({ workflowId, issues, state, source: 'memory' });
        }
      });
      
      // Also check database-only workflows
      try {
        const dbWorkflows = await dataService.getAllWorkflows(1000, 0);
        
        for (const dbWorkflow of dbWorkflows) {
          // Skip if already in memory (handled above)
          if (this.workflowState[dbWorkflow.id]) {
            continue;
          }
          
          const issues = [];
          
          // Check for invalid progress values
          if (dbWorkflow.progress < -1 || dbWorkflow.progress > 100) {
            issues.push('invalid_progress');
          }
          
          // Check for status/step mismatches
          if (dbWorkflow.status === 'running' && dbWorkflow.current_step === 'failed') {
            issues.push('status_step_mismatch');
          }
          
          // Check for workflows with end_time but still running status
          if (dbWorkflow.status === 'running' && dbWorkflow.end_time) {
            issues.push('ended_but_running');
          }
          
          // Check for stuck workflows (running for too long)
          if (dbWorkflow.status === 'running') {
            const startTime = new Date(dbWorkflow.start_time).getTime();
            const timeSinceStart = Date.now() - startTime;
            if (timeSinceStart > 30 * 60 * 1000) { // 30 minutes
              issues.push('stuck_workflow');
            }
          }
          
          if (issues.length > 0) {
            workflowsToFix.push({ 
              workflowId: dbWorkflow.id, 
              issues, 
              state: dbWorkflow, 
              source: 'database' 
            });
          }
        }
      } catch (error) {
        logger.warn('Error checking database workflows for corruption:', error);
      }
      
      // Fix identified issues
      for (const { workflowId, issues, state, source } of workflowsToFix) {
        logger.warn('Fixing corrupted workflow', { workflowId, issues, source });
        
        let newStatus = state.status;
        let newProgress = state.progress;
        let newCurrentStep = state.current_step || state.currentStep;
        let errorMessage = state.error_message || state.error;
        
        if (issues.includes('invalid_progress')) {
          newProgress = Math.max(0, Math.min(100, newProgress));
        }
        
        if (issues.includes('status_step_mismatch') || 
            issues.includes('stuck_workflow') || 
            issues.includes('ended_but_running')) {
          newStatus = 'failed';
          newCurrentStep = 'failed';
          errorMessage = errorMessage || 'Workflow was in an inconsistent state and has been marked as failed';
        }
        
        // Update database
        await dataService.updateWorkflow(workflowId, {
          status: newStatus,
          currentStep: newCurrentStep,
          progress: newProgress,
          error_message: errorMessage
        });
        
        // Update memory if workflow is loaded
        if (source === 'memory' && this.workflowState[workflowId]) {
          this.workflowState[workflowId].status = newStatus;
          this.workflowState[workflowId].currentStep = newCurrentStep;
          this.workflowState[workflowId].progress = newProgress;
          this.workflowState[workflowId].error = errorMessage;
        }
      }
      
      if (workflowsToFix.length > 0) {
        logger.info('Fixed corrupted workflows', { 
          count: workflowsToFix.length,
          memory: workflowsToFix.filter(w => w.source === 'memory').length,
          database: workflowsToFix.filter(w => w.source === 'database').length
        });
      }
      
    } catch (error) {
      logger.error('Error cleaning up corrupted workflows:', error);
    }
  }

  // Helper method to flatten requirements from categorized format to array
  flattenRequirements(requirements) {
    const flattened = [];
    
    if (!requirements || typeof requirements !== 'object') {
      return flattened;
    }

    // Handle different requirement structures
    Object.entries(requirements).forEach(([category, reqs]) => {
      if (Array.isArray(reqs)) {
        reqs.forEach((req, index) => {
          flattened.push({
            id: req.id || `${category}_req_${index + 1}`,
            category: category,
            description: req.description || req.text || req,
            priority: req.priority || 'medium',
            complexity: req.complexity || 'medium',
            mandatory: req.mandatory || false,
            sourceDocumentId: req.sourceDocumentId || null
          });
        });
      }
    });

    return flattened;
  }

  // Helper method to flatten questions from categorized format to array
  flattenQuestions(questions) {
    const flattened = [];
    
    if (!questions || !questions.questionCategories) {
      return flattened;
    }

    Object.entries(questions.questionCategories).forEach(([category, questionList]) => {
      if (Array.isArray(questionList)) {
        questionList.forEach(q => {
          flattened.push({
            id: q.id,
            category: category,
            questionText: q.question,
            rationale: q.rationale,
            priority: q.priority,
            impact: q.impact,
            relatedRequirements: JSON.stringify(q.relatedRequirements || [])
          });
        });
      }
    });

    return flattened;
  }

  // Helper method to flatten answers from structured format to array
  flattenAnswers(answers) {
    const flattened = [];
    
    if (!answers || !answers.answeredQuestions) {
      return flattened;
    }

    if (Array.isArray(answers.answeredQuestions)) {
      answers.answeredQuestions.forEach(answer => {
        flattened.push({
          questionId: answer.questionId,
          answerText: answer.answer,
          confidenceScore: answer.confidence,
          answerType: answer.type || 'direct',
          completeness: answer.completeness || 'complete',
          sources: JSON.stringify(answer.sources || [])
        });
      });
    }

    return flattened;
  }

  // Helper methods to reconstruct data structures from database
  reconstructRequirementsAnalysis(requirements, results) {
    // Try to get from workflow results first
    if (Array.isArray(results)) {
      const requirementsResult = results.find(r => r.step_name === 'requirements_analysis');
      if (requirementsResult && requirementsResult.result_data) {
        try {
          return this.parseJSON(requirementsResult.result_data);
        } catch (e) {
          logger.warn('Failed to parse requirements analysis from results');
        }
      }
    }

    // Fallback: reconstruct from individual requirements
    const categorized = {
      technical: [],
      business: [],
      compliance: []
    };

    requirements.forEach(req => {
      const category = req.category || 'technical';
      if (categorized[category]) {
        categorized[category].push({
          id: req.requirement_id,
          description: req.description,
          priority: req.priority,
          complexity: req.complexity,
          mandatory: req.mandatory
        });
      }
    });

    return {
      requirements: categorized,
      projectOverview: {
        title: 'Reconstructed from database',
        description: 'Requirements loaded from database'
      }
    };
  }

  reconstructClarificationQuestions(questions, results) {
    // Try to get from workflow results first
    if (Array.isArray(results)) {
      const questionsResult = results.find(r => r.step_name === 'clarification_questions');
      if (questionsResult && questionsResult.result_data) {
        try {
          return this.parseJSON(questionsResult.result_data);
        } catch (e) {
          logger.warn('Failed to parse clarification questions from results');
        }
      }
    }

    // Fallback: reconstruct from individual questions
    const categorized = {
      technical: [],
      business: [],
      timeline: [],
      budget: [],
      compliance: []
    };

    questions.forEach(q => {
      const category = q.category || 'technical';
      if (categorized[category]) {
        categorized[category].push({
          id: q.question_id,
          questionId: q.question_id, // Add questionId for consistency
          question: q.question_text,
          questionText: q.question_text, // Add questionText for consistency
          rationale: q.rationale,
          priority: q.priority,
          impact: q.impact,
          relatedRequirements: this.parseJSON(q.related_requirements) || []
        });
      }
    });

    return {
      questionCategories: categorized,
      questionSummary: {
        totalQuestions: questions.length,
        highPriority: questions.filter(q => q.priority === 'high').length,
        mediumPriority: questions.filter(q => q.priority === 'medium').length,
        lowPriority: questions.filter(q => q.priority === 'low').length
      }
    };
  }

  reconstructExtractedAnswers(answers, results) {
    // Try to get from workflow results first
    if (Array.isArray(results)) {
      const answersResult = results.find(r => r.step_name === 'answer_extraction');
      if (answersResult && answersResult.result_data) {
        try {
          return this.parseJSON(answersResult.result_data);
        } catch (e) {
          logger.warn('Failed to parse extracted answers from results');
        }
      }
    }

    // Fallback: reconstruct from individual answers
    const answeredQuestions = answers.map(a => ({
      questionId: a.question_id,
      answerText: a.answer_text, // Use answerText to match frontend expectations
      answer: a.answer_text, // Keep both for compatibility
      confidenceScore: a.confidence_score, // Use confidenceScore to match frontend expectations
      confidence: a.confidence_score, // Keep both for compatibility
      answerType: a.answer_type, // Use answerType to match frontend expectations
      type: a.answer_type, // Keep both for compatibility
      completeness: a.completeness,
      sources: this.parseJSON(a.sources) || []
    }));

    return {
      answeredQuestions,
      answerSummary: {
        totalAnswered: answeredQuestions.length,
        averageConfidence: answeredQuestions.reduce((sum, a) => sum + (a.confidenceScore || a.confidence || 0), 0) / answeredQuestions.length || 0
      }
    };
  }

  reconstructCompiledResponse(results) {
    // Try to get from workflow results
    if (Array.isArray(results)) {
      const responseResult = results.find(r => r.step_name === 'response_compilation');
      if (responseResult && responseResult.result_data) {
        try {
          return this.parseJSON(responseResult.result_data);
        } catch (e) {
          logger.warn('Failed to parse compiled response from results');
        }
      }
    }

    // Fallback: basic structure
    return {
      qualityAssurance: {
        completenessScore: 0.8
      },
      gapsAndActions: {
        criticalGaps: []
      }
    };
  }

  // Helper method to safely parse JSON
  parseJSON(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        logger.warn('Failed to parse JSON:', value);
        return null;
      }
    }
    return null;
  }

  async reprocessAnswers(workflowId) {
    try {
      logger.info(`Reprocessing answers for workflow: ${workflowId}`);
      
      // Get existing workflow data
      const workflowData = await this.getWorkflowStatus(workflowId);
      if (workflowData.error) {
        throw new Error('Workflow not found');
      }

      // Get questions from the workflow
      logger.info('Workflow data structure:', { 
        hasQuestions: !!workflowData.questions,
        questionsLength: workflowData.questions?.length || 0,
        workflowKeys: Object.keys(workflowData)
      });
      
      const questions = workflowData.questions || [];
      if (questions.length === 0) {
        throw new Error('No questions found in workflow');
      }

      // Convert questions to the format expected by the answer extraction agent
      const questionCategories = {};
      questions.forEach(q => {
        const category = q.category || 'general';
        if (!questionCategories[category]) {
          questionCategories[category] = [];
        }
        // Normalize question format
        const normalizedQuestion = {
          id: q.question_id || q.id,
          questionText: q.question_text || q.questionText || q.question,
          question: q.question_text || q.questionText || q.question,
          rationale: q.rationale,
          priority: q.priority,
          impact: q.impact,
          category: q.category
        };
        questionCategories[category].push(normalizedQuestion);
      });

      const rfpQuestions = { questionCategories };

      // Re-run answer extraction with RAG
      const extractedAnswers = await this.agents.answerExtraction.extractAnswers(
        rfpQuestions,
        [], // No company documents needed for RAG
        workflowData.results?.requirementsAnalysis,
        workflowId
      );

      // Update the workflow in database
      await dataService.updateWorkflowResults(workflowId, {
        extractedAnswers,
        answers: extractedAnswers.answeredQuestions || []
      });

      logger.info(`Successfully reprocessed ${extractedAnswers.answeredQuestions?.length || 0} answers for workflow: ${workflowId}`);
      
      return extractedAnswers;
    } catch (error) {
      logger.error('Error reprocessing answers:', error);
      throw error;
    }
  }
}

module.exports = new AgentOrchestrator();