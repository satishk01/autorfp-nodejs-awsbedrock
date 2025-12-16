const WorkflowDatabaseManager = require('./workflowDatabaseManager');
const WorkflowVectorManager = require('./workflowVectorManager');
const redis = require('./redis');
const logger = require('../utils/logger');

class WorkflowDataService {
  constructor() {
    this.dbManager = new WorkflowDatabaseManager();
    this.vectorManager = new WorkflowVectorManager();
    this.cache = redis;
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing workflow data service...');
      
      // Initialize vector manager
      await this.vectorManager.initialize();
      
      // Skip migration as requested
      
      this.initialized = true;
      logger.info('Workflow data service initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize workflow data service:', error);
      this.initialized = false;
      return false;
    }
  }

  // Migration methods removed as per user request

  // Workflow operations
  async createWorkflow(workflowData) {
    const { id } = workflowData;
    
    try {
      // Create workflow-specific database
      const db = await this.dbManager.createWorkflowDatabase(id, workflowData);
      
      // Clear cache for this workflow
      await this.cache.del(`workflow:${id}`);
      
      logger.info('Workflow created', { workflowId: id });
      return { success: true, workflowId: id };
    } catch (error) {
      logger.error('Error creating workflow', { workflowId: id, error: error.message });
      throw error;
    }
  }

  async updateWorkflow(workflowId, updates) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const fields = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      });

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(workflowId);

      const query = `UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`;
      const result = await db.run(query, values);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}`);

      logger.debug('Workflow updated', { workflowId, updates });
      return result;
    } catch (error) {
      logger.error('Error updating workflow', { workflowId, error: error.message });
      throw error;
    }
  }

  async getWorkflow(workflowId) {
    try {
      // Try cache first
      const cacheKey = `workflow:${workflowId}`;
      let workflow = await this.cache.get(cacheKey);
      
      if (!workflow) {
        // Get from workflow-specific database
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        
        if (workflow) {
          if (workflow.project_context) {
            workflow.project_context = JSON.parse(workflow.project_context);
          }
          
          // Cache for future requests
          await this.cache.set(cacheKey, workflow, 3600);
        }
      }

      return workflow;
    } catch (error) {
      logger.error('Error getting workflow', { workflowId, error: error.message });
      return null;
    }
  }

  async getAllWorkflows(limit = 50, offset = 0) {
    try {
      const cacheKey = `workflows:list:${limit}:${offset}`;
      
      // Try cache first
      let workflows = await this.cache.get(cacheKey);
      
      if (!workflows) {
        // Get from all workflow databases
        workflows = await this.dbManager.getAllWorkflowsMetadata(limit, offset);
        
        // Cache for a shorter time since this changes frequently
        await this.cache.set(cacheKey, workflows, 300); // 5 minutes
      }

      return workflows;
    } catch (error) {
      logger.error('Error getting all workflows', { error: error.message });
      return [];
    }
  }

  async deleteWorkflow(workflowId) {
    try {
      // Delete workflow database
      await this.dbManager.deleteWorkflowDatabase(workflowId);
      
      // Delete workflow vectors
      await this.vectorManager.deleteWorkflowVectors(workflowId);
      
      // Clear cache
      await this.cache.del(`workflow:${workflowId}`);
      await this.cache.del('workflows:list:*');
      
      logger.info('Workflow deleted completely', { workflowId });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting workflow', { workflowId, error: error.message });
      throw error;
    }
  }

  // Document operations
  async createDocument(documentData) {
    const { workflowId } = documentData;
    
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const {
        id, originalName, filePath, fileSize, mimeType,
        documentType, processingStatus, processedContent, metadata, structuredData
      } = documentData;

      const result = await db.run(`
        INSERT INTO documents (
          id, workflow_id, original_name, file_path, file_size, mime_type,
          document_type, processing_status, processed_content, metadata, structured_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, workflowId, originalName, filePath, fileSize, mimeType,
        documentType, processingStatus, processedContent,
        JSON.stringify(metadata), JSON.stringify(structuredData)
      ]);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:documents`);

      logger.debug('Document created', { documentId: id, workflowId });
      return result;
    } catch (error) {
      logger.error('Error creating document', { documentData, error: error.message });
      throw error;
    }
  }

  async getDocumentsByWorkflow(workflowId) {
    try {
      const cacheKey = `workflow:${workflowId}:documents`;
      let documents = await this.cache.get(cacheKey);
      
      if (!documents) {
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        documents = await db.all(`
          SELECT * FROM documents WHERE workflow_id = ?
          ORDER BY created_at ASC
        `, [workflowId]);

        documents = documents.map(doc => {
          if (doc.metadata) doc.metadata = JSON.parse(doc.metadata);
          if (doc.structured_data) doc.structured_data = JSON.parse(doc.structured_data);
          return doc;
        });
        
        await this.cache.set(cacheKey, documents, 3600);
      }

      return documents;
    } catch (error) {
      logger.error('Error getting documents', { workflowId, error: error.message });
      return [];
    }
  }

  // Vector operations
  async vectorizeDocument(workflowId, documentId, content, metadata = {}) {
    try {
      const vectorService = await this.vectorManager.getWorkflowVectorService(workflowId);
      return await vectorService.vectorizeDocument(documentId, content, metadata);
    } catch (error) {
      logger.error('Error vectorizing document', { workflowId, documentId, error: error.message });
      return false;
    }
  }

  async searchSimilarContent(workflowId, query, limit = 5) {
    try {
      const vectorService = await this.vectorManager.getWorkflowVectorService(workflowId);
      return await vectorService.searchSimilarContent(query, limit);
    } catch (error) {
      logger.error('Error searching similar content', { workflowId, query, error: error.message });
      return [];
    }
  }

  async answerQuestion(workflowId, question) {
    try {
      const vectorService = await this.vectorManager.getWorkflowVectorService(workflowId);
      return await vectorService.answerQuestion(question);
    } catch (error) {
      logger.error('Error answering question', { workflowId, question, error: error.message });
      return {
        answer: "An error occurred while trying to answer this question.",
        confidence: 0.0,
        sources: []
      };
    }
  }

  // Requirements operations
  async saveRequirements(workflowId, requirements) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const stmt = await db.prepare(`
        INSERT INTO requirements (
          workflow_id, requirement_id, category, description, priority, 
          complexity, mandatory, source_document_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const req of requirements) {
        await stmt.run([
          workflowId, req.id, req.category, req.description,
          req.priority, req.complexity, req.mandatory, req.sourceDocumentId
        ]);
      }

      await stmt.finalize();
      
      // Clear cache
      await this.cache.del(`workflow:${workflowId}:requirements`);
      
      logger.debug('Requirements saved', { workflowId, count: requirements.length });
      return { success: true };
    } catch (error) {
      logger.error('Error saving requirements', { workflowId, error: error.message });
      throw error;
    }
  }

  async getRequirements(workflowId) {
    try {
      const cacheKey = `workflow:${workflowId}:requirements`;
      let requirements = await this.cache.get(cacheKey);
      
      if (!requirements) {
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        requirements = await db.all(`
          SELECT * FROM requirements 
          WHERE workflow_id = ? 
          ORDER BY priority DESC, created_at ASC
        `, [workflowId]);
        
        await this.cache.set(cacheKey, requirements, 3600);
      }

      return requirements;
    } catch (error) {
      logger.error('Error getting requirements', { workflowId, error: error.message });
      return [];
    }
  }

  // Questions operations
  async saveQuestions(workflowId, questions) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const stmt = await db.prepare(`
        INSERT INTO questions (
          workflow_id, question_id, category, question_text, rationale,
          priority, impact, related_requirements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const question of questions) {
        await stmt.run([
          workflowId, question.id, question.category, question.questionText || question.question,
          question.rationale, question.priority, question.impact,
          question.relatedRequirements || JSON.stringify(question.relatedRequirements || [])
        ]);
      }

      await stmt.finalize();
      
      // Clear cache
      await this.cache.del(`workflow:${workflowId}:questions`);
      
      logger.debug('Questions saved', { workflowId, count: questions.length });
      return { success: true };
    } catch (error) {
      logger.error('Error saving questions', { workflowId, error: error.message });
      throw error;
    }
  }

  async getQuestions(workflowId) {
    try {
      const cacheKey = `workflow:${workflowId}:questions`;
      let questions = await this.cache.get(cacheKey);
      
      if (!questions) {
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        questions = await db.all(`
          SELECT * FROM questions 
          WHERE workflow_id = ? 
          ORDER BY priority DESC, created_at ASC
        `, [workflowId]);

        questions = questions.map(q => {
          if (q.related_requirements) {
            q.related_requirements = JSON.parse(q.related_requirements);
          }
          return q;
        });
        
        await this.cache.set(cacheKey, questions, 3600);
      }

      return questions;
    } catch (error) {
      logger.error('Error getting questions', { workflowId, error: error.message });
      return [];
    }
  }

  // Answers operations
  async saveAnswers(workflowId, answers) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const stmt = await db.prepare(`
        INSERT INTO answers (
          workflow_id, question_id, answer_text, confidence_score,
          answer_type, completeness, sources
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const answer of answers) {
        await stmt.run([
          workflowId, answer.questionId, answer.answerText || answer.answer, 
          answer.confidenceScore || answer.confidence,
          answer.answerType, answer.completeness, 
          answer.sources || JSON.stringify(answer.sources || [])
        ]);
      }

      await stmt.finalize();
      
      // Clear cache
      await this.cache.del(`workflow:${workflowId}:answers`);
      
      logger.debug('Answers saved', { workflowId, count: answers.length });
      return { success: true };
    } catch (error) {
      logger.error('Error saving answers', { workflowId, error: error.message });
      throw error;
    }
  }

  async saveAnswer(workflowId, answerData) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const result = await db.run(`
        INSERT OR REPLACE INTO answers (
          workflow_id, question_id, answer_text, confidence_score,
          answer_type, completeness, sources
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        answerData.workflow_id || workflowId,
        answerData.question_id,
        answerData.answer_text,
        answerData.confidence_score,
        answerData.answer_type || 'inferred',
        answerData.completeness || 'partial',
        answerData.sources || '[]'
      ]);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:answers`);
      
      logger.debug('Answer saved', { workflowId, questionId: answerData.question_id });
      return result;
    } catch (error) {
      logger.error('Error saving answer', { workflowId, questionId: answerData.question_id, error: error.message });
      throw error;
    }
  }

  async getAnswers(workflowId) {
    try {
      const cacheKey = `workflow:${workflowId}:answers`;
      let answers = await this.cache.get(cacheKey);
      
      if (!answers) {
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        answers = await db.all(`
          SELECT * FROM answers 
          WHERE workflow_id = ? 
          ORDER BY confidence_score DESC, created_at ASC
        `, [workflowId]);

        answers = answers.map(a => {
          if (a.sources) {
            a.sources = JSON.parse(a.sources);
          }
          return a;
        });
        
        await this.cache.set(cacheKey, answers, 3600);
      }

      return answers;
    } catch (error) {
      logger.error('Error getting answers', { workflowId, error: error.message });
      return [];
    }
  }

  // Workflow results operations
  async saveWorkflowResult(workflowId, stepName, resultData, confidenceScore = null, processingTime = null) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const result = await db.run(`
        INSERT INTO workflow_results (workflow_id, step_name, result_data, confidence_score, processing_time)
        VALUES (?, ?, ?, ?, ?)
      `, [workflowId, stepName, JSON.stringify(resultData), confidenceScore, processingTime]);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:results`);

      logger.debug('Workflow result saved', { workflowId, stepName });
      return result;
    } catch (error) {
      logger.error('Error saving workflow result', { workflowId, stepName, error: error.message });
      throw error;
    }
  }

  async getWorkflowResults(workflowId) {
    try {
      const cacheKey = `workflow:${workflowId}:results`;
      let results = await this.cache.get(cacheKey);
      
      if (!results) {
        const db = await this.dbManager.getWorkflowDatabase(workflowId);
        const resultRows = await db.all(`
          SELECT * FROM workflow_results 
          WHERE workflow_id = ? 
          ORDER BY created_at ASC
        `, [workflowId]);

        results = {};
        resultRows.forEach(result => {
          results[result.step_name] = {
            ...JSON.parse(result.result_data),
            confidence_score: result.confidence_score,
            processing_time: result.processing_time,
            created_at: result.created_at
          };
        });
        
        await this.cache.set(cacheKey, results, 3600);
      }

      return results;
    } catch (error) {
      logger.error('Error getting workflow results', { workflowId, error: error.message });
      return {};
    }
  }

  // Status operations
  async updateWorkflowStatus(workflowId, status, errorMessage = null) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };
      
      if (errorMessage) {
        updateData.error_message = errorMessage;
      }
      
      if (status === 'completed') {
        updateData.end_time = new Date().toISOString();
        updateData.progress = 100;
      } else if (status === 'failed') {
        updateData.end_time = new Date().toISOString();
      }
      
      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateData);
      values.push(workflowId);
      
      await db.run(`
        UPDATE workflows 
        SET ${setClause}
        WHERE id = ?
      `, values);
      
      // Clear cache
      await this.cache.del(`workflow:${workflowId}`);
      
      logger.debug('Workflow status updated', { workflowId, status, errorMessage });
      return { success: true };
    } catch (error) {
      logger.error('Error updating workflow status', { workflowId, status, error: error.message });
      throw error;
    }
  }

  // Statistics operations
  async getWorkflowStatistics() {
    try {
      const cacheKey = 'workflow:statistics';
      let stats = await this.cache.get(cacheKey);
      
      if (!stats) {
        const workflowIds = await this.dbManager.getAllWorkflowIds();
        
        stats = {
          total: 0,
          completed: 0,
          running: 0,
          failed: 0,
          total_documents: 0,
          total_requirements: 0,
          total_questions: 0,
          total_answers: 0
        };

        for (const workflowId of workflowIds) {
          try {
            const workflowStats = await this.dbManager.getWorkflowDatabaseStats(workflowId);
            if (workflowStats) {
              stats.total += workflowStats.workflows;
              stats.total_documents += workflowStats.documents;
              stats.total_requirements += workflowStats.requirements;
              stats.total_questions += workflowStats.questions;
              stats.total_answers += workflowStats.answers;
            }

            // Get workflow status
            const workflow = await this.getWorkflow(workflowId);
            if (workflow) {
              stats[workflow.status] = (stats[workflow.status] || 0) + 1;
            }
          } catch (error) {
            logger.warn('Error getting stats for workflow', { workflowId, error: error.message });
          }
        }
        
        await this.cache.set(cacheKey, stats, 300); // Cache for 5 minutes
      }

      return stats;
    } catch (error) {
      logger.error('Error getting workflow statistics', { error: error.message });
      return {
        total: 0,
        completed: 0,
        running: 0,
        failed: 0,
        total_documents: 0,
        total_requirements: 0,
        total_questions: 0,
        total_answers: 0
      };
    }
  }

  // Cleanup operations
  async cleanupOldWorkflows(maxAge = 7 * 24 * 60 * 60 * 1000) {
    try {
      const workflowIds = await this.dbManager.getAllWorkflowIds();
      const cutoffDate = new Date(Date.now() - maxAge);
      let deletedCount = 0;

      for (const workflowId of workflowIds) {
        try {
          const workflow = await this.getWorkflow(workflowId);
          if (workflow && 
              (workflow.status === 'completed' || workflow.status === 'failed' || workflow.status === 'cancelled') &&
              new Date(workflow.created_at) < cutoffDate) {
            
            await this.deleteWorkflow(workflowId);
            deletedCount++;
          }
        } catch (error) {
          logger.warn('Error during cleanup of workflow', { workflowId, error: error.message });
        }
      }

      logger.info('Old workflows cleaned up', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Error during workflow cleanup', { error: error.message });
      return 0;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const workflowIds = await this.dbManager.getAllWorkflowIds();
      const vectorIds = await this.vectorManager.getAllWorkflowVectorIds();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        workflows: workflowIds.length,
        vectorStores: vectorIds.length,
        initialized: this.initialized
      };
    } catch (error) {
      logger.error('Workflow data service health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Close all connections
  // Custom questions operations
  async addCustomQuestion(workflowId, questionData) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      const result = await db.run(`
        INSERT INTO questions (
          workflow_id, question_id, category, question_text, rationale,
          priority, impact, related_requirements, is_custom, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        workflowId,
        questionData.question_id,
        questionData.category,
        questionData.question_text,
        questionData.rationale,
        questionData.priority,
        questionData.impact,
        questionData.related_requirements,
        questionData.is_custom,
        questionData.created_by
      ]);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:questions`);

      // Get the inserted question
      const question = await db.get('SELECT * FROM questions WHERE id = ?', [result.lastID]);
      
      logger.info('Custom question added', { workflowId, questionId: questionData.question_id });
      return question;
    } catch (error) {
      logger.error('Error adding custom question', { workflowId, error: error.message });
      throw error;
    }
  }

  async updateCustomQuestion(workflowId, questionId, updates) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      // First check if the question exists and is custom
      const existingQuestion = await db.get(`
        SELECT * FROM questions 
        WHERE workflow_id = ? AND question_id = ? AND is_custom = 1
      `, [workflowId, questionId]);

      if (!existingQuestion) {
        return null;
      }

      // Build update query dynamically
      const fields = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return existingQuestion;
      }

      values.push(workflowId, questionId);

      const query = `
        UPDATE questions 
        SET ${fields.join(', ')} 
        WHERE workflow_id = ? AND question_id = ? AND is_custom = 1
      `;

      await db.run(query, values);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:questions`);

      logger.info('Custom question updated', { workflowId, questionId });
      return true;
    } catch (error) {
      logger.error('Error updating custom question', { workflowId, questionId, error: error.message });
      throw error;
    }
  }

  async deleteCustomQuestion(workflowId, questionId) {
    try {
      const db = await this.dbManager.getWorkflowDatabase(workflowId);
      
      // Delete only if it's a custom question
      const result = await db.run(`
        DELETE FROM questions 
        WHERE workflow_id = ? AND question_id = ? AND is_custom = 1
      `, [workflowId, questionId]);

      if (result.changes === 0) {
        return null;
      }

      // Also delete any associated answers
      await db.run(`
        DELETE FROM answers 
        WHERE workflow_id = ? AND question_id = ?
      `, [workflowId, questionId]);

      // Clear cache
      await this.cache.del(`workflow:${workflowId}:questions`);
      await this.cache.del(`workflow:${workflowId}:answers`);

      logger.info('Custom question deleted', { workflowId, questionId });
      return true;
    } catch (error) {
      logger.error('Error deleting custom question', { workflowId, questionId, error: error.message });
      throw error;
    }
  }

  async close() {
    try {
      await this.dbManager.closeAllConnections();
      this.vectorManager.clearCache();
      logger.info('Workflow data service closed');
    } catch (error) {
      logger.error('Error closing workflow data service', { error: error.message });
    }
  }
}

// Create singleton instance
const workflowDataService = new WorkflowDataService();

module.exports = workflowDataService;