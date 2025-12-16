const database = require('../database/database');
const redisService = require('./redis');
const logger = require('../utils/logger');

class DataService {
  constructor() {
    this.db = database;
    this.cache = redisService;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize database
      await this.db.initialize();
      
      // Initialize Redis cache
      await this.cache.initialize();
      
      this.isInitialized = true;
      logger.info('Data service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize data service:', error);
      throw error;
    }
  }

  // Workflow operations with caching
  async createWorkflow(workflowData) {
    const result = await this.db.createWorkflow(workflowData);
    
    // Cache workflow data
    await this.cache.set(`workflow:${workflowData.id}`, workflowData, 3600);
    
    return result;
  }

  async updateWorkflow(workflowId, updates) {
    const result = await this.db.updateWorkflow(workflowId, updates);
    
    // Update cache
    const cached = await this.cache.get(`workflow:${workflowId}`);
    if (cached) {
      const updated = { ...cached, ...updates };
      await this.cache.set(`workflow:${workflowId}`, updated, 3600);
    }
    
    // Cache progress separately for real-time updates
    if (updates.progress !== undefined) {
      await this.cache.cacheWorkflowProgress(workflowId, {
        progress: updates.progress,
        currentStep: updates.currentStep,
        status: updates.status,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  }

  async getWorkflow(workflowId) {
    // Try cache first
    let workflow = await this.cache.get(`workflow:${workflowId}`);
    
    if (!workflow) {
      // Fallback to database
      workflow = await this.db.getWorkflow(workflowId);
      
      if (workflow) {
        // Cache for future requests
        await this.cache.set(`workflow:${workflowId}`, workflow, 3600);
      }
    }
    
    return workflow;
  }

  async getAllWorkflows(limit = 50, offset = 0) {
    const cacheKey = `workflows:list:${limit}:${offset}`;
    
    // Try cache first
    let workflows = await this.cache.get(cacheKey);
    
    if (!workflows) {
      workflows = await this.db.getAllWorkflows(limit, offset);
      
      // Cache for 5 minutes
      await this.cache.set(cacheKey, workflows, 300);
    }
    
    return workflows;
  }

  async deleteWorkflow(workflowId) {
    const result = await this.db.deleteWorkflow(workflowId);
    
    // Clear cache
    await this.cache.del(`workflow:${workflowId}`);
    await this.cache.del(`workflow:${workflowId}:progress`);
    
    // Clear related caches
    const keys = await this.cache.keys(`workflow:${workflowId}:*`);
    for (const key of keys) {
      await this.cache.del(key);
    }
    
    // Clear list caches
    const listKeys = await this.cache.keys('workflows:list:*');
    for (const key of listKeys) {
      await this.cache.del(key);
    }
    
    return result;
  }

  // Document operations with caching
  async createDocument(documentData) {
    const result = await this.db.createDocument(documentData);
    
    // Cache document metadata
    await this.cache.set(`document:${documentData.id}:meta`, documentData, 7200);
    
    return result;
  }

  async updateDocument(documentId, updates) {
    const result = await this.db.updateDocument(documentId, updates);
    
    // Update cache
    const cached = await this.cache.get(`document:${documentId}:meta`);
    if (cached) {
      const updated = { ...cached, ...updates };
      await this.cache.set(`document:${documentId}:meta`, updated, 7200);
    }
    
    return result;
  }

  async getDocumentsByWorkflow(workflowId) {
    const cacheKey = `workflow:${workflowId}:documents`;
    
    // Try cache first
    let documents = await this.cache.get(cacheKey);
    
    if (!documents) {
      documents = await this.db.getDocumentsByWorkflow(workflowId);
      
      // Cache for 1 hour
      await this.cache.set(cacheKey, documents, 3600);
    }
    
    return documents;
  }

  // Workflow results with caching
  async saveWorkflowResult(workflowId, stepName, resultData, confidenceScore, processingTime) {
    const result = await this.db.saveWorkflowResult(workflowId, stepName, resultData, confidenceScore, processingTime);
    
    // Cache the result
    await this.cache.cacheWorkflowResult(workflowId, stepName, {
      data: resultData,
      confidence: confidenceScore,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }

  async getWorkflowResults(workflowId) {
    const cacheKey = `workflow:${workflowId}:results`;
    
    // Try cache first
    let results = await this.cache.get(cacheKey);
    
    if (!results) {
      results = await this.db.getWorkflowResults(workflowId);
      
      // Cache for 30 minutes
      await this.cache.set(cacheKey, results, 1800);
    }
    
    return results;
  }

  // Requirements operations
  async saveRequirements(workflowId, requirements) {
    const result = await this.db.saveRequirements(workflowId, requirements);
    
    // Cache requirements
    await this.cache.set(`workflow:${workflowId}:requirements`, requirements, 3600);
    
    return result;
  }

  async getRequirements(workflowId) {
    const cacheKey = `workflow:${workflowId}:requirements`;
    
    let requirements = await this.cache.get(cacheKey);
    
    if (!requirements) {
      requirements = await this.db.getRequirements(workflowId);
      await this.cache.set(cacheKey, requirements, 3600);
    }
    
    return requirements;
  }

  // Questions operations
  async saveQuestions(workflowId, questions) {
    const result = await this.db.saveQuestions(workflowId, questions);
    
    // Cache questions
    await this.cache.set(`workflow:${workflowId}:questions`, questions, 3600);
    
    return result;
  }

  async getQuestions(workflowId) {
    const cacheKey = `workflow:${workflowId}:questions`;
    
    let questions = await this.cache.get(cacheKey);
    
    if (!questions) {
      questions = await this.db.getQuestions(workflowId);
      await this.cache.set(cacheKey, questions, 3600);
    }
    
    return questions;
  }

  // Answers operations
  async saveAnswers(workflowId, answers) {
    const result = await this.db.saveAnswers(workflowId, answers);
    
    // Cache answers
    await this.cache.set(`workflow:${workflowId}:answers`, answers, 3600);
    
    return result;
  }

  async getAnswers(workflowId) {
    const cacheKey = `workflow:${workflowId}:answers`;
    
    let answers = await this.cache.get(cacheKey);
    
    if (!answers) {
      answers = await this.db.getAnswers(workflowId);
      await this.cache.set(cacheKey, answers, 3600);
    }
    
    return answers;
  }

  async updateWorkflowStatus(workflowId, status, errorMessage = null) {
    const result = await this.db.updateWorkflowStatus(workflowId, status, errorMessage);
    
    // Clear cache for this workflow
    const cacheKey = `workflow:${workflowId}`;
    await this.cache.delete(cacheKey);
    
    return result;
  }

  // Statistics with caching
  async getWorkflowStatistics() {
    const cacheKey = 'workflow:statistics';
    
    let stats = await this.cache.get(cacheKey);
    
    if (!stats) {
      stats = await this.db.getWorkflowStatistics();
      
      // Cache for 5 minutes
      await this.cache.set(cacheKey, stats, 300);
    }
    
    return stats;
  }

  // Session management
  async createSession(sessionId, data) {
    return await this.cache.setSession(sessionId, data);
  }

  async getSession(sessionId) {
    return await this.cache.getSession(sessionId);
  }

  async deleteSession(sessionId) {
    return await this.cache.deleteSession(sessionId);
  }

  // Rate limiting
  async checkRateLimit(identifier, limit = 100, window = 3600) {
    return await this.cache.checkRateLimit(identifier, limit, window);
  }

  // Audit logging
  async logActivity(workflowId, action, details, userId = null, ipAddress = null) {
    return await this.db.logActivity(workflowId, action, details, userId, ipAddress);
  }

  // Performance metrics
  async savePerformanceMetric(workflowId, metricName, metricValue, unit = null) {
    const result = await this.db.savePerformanceMetric(workflowId, metricName, metricValue, unit);
    
    // Also increment counter in cache
    await this.cache.incrementCounter(`metric:${metricName}`, metricValue);
    
    return result;
  }

  // Settings management
  async getSetting(key) {
    const cacheKey = `setting:${key}`;
    
    let value = await this.cache.get(cacheKey);
    
    if (value === null) {
      value = await this.db.getSetting(key);
      
      if (value !== null) {
        // Cache for 1 hour
        await this.cache.set(cacheKey, value, 3600);
      }
    }
    
    return value;
  }

  async setSetting(key, value, description = null) {
    const result = await this.db.setSetting(key, value, description);
    
    // Update cache
    await this.cache.set(`setting:${key}`, value, 3600);
    
    return result;
  }

  async getAllSettings() {
    const cacheKey = 'settings:all';
    
    let settings = await this.cache.get(cacheKey);
    
    if (!settings) {
      settings = await this.db.getAllSettings();
      
      // Cache for 30 minutes
      await this.cache.set(cacheKey, settings, 1800);
    }
    
    return settings;
  }

  // Cleanup operations
  async cleanupOldWorkflows(maxAge) {
    const result = await this.db.cleanupOldWorkflows(maxAge);
    
    // Clear related caches
    await this.cache.cleanup();
    
    // Clear list caches
    const listKeys = await this.cache.keys('workflows:list:*');
    for (const key of listKeys) {
      await this.cache.del(key);
    }
    
    return result;
  }

  // Health checks
  async healthCheck() {
    const dbHealth = await this.db.healthCheck();
    const cacheHealth = await this.cache.healthCheck();
    
    return {
      database: dbHealth,
      cache: cacheHealth,
      overall: dbHealth.status === 'healthy' ? 'healthy' : 'degraded'
    };
  }

  // Graceful shutdown
  async close() {
    await this.cache.close();
    await this.db.close();
    logger.info('Data service closed');
  }

  async updateWorkflowResults(workflowId, results) {
    try {
      await database.initialize();
      const db = database.db;
      
      // Update or insert answers
      if (results.answers && Array.isArray(results.answers)) {
        // Clear existing answers for this workflow
        await db.run('DELETE FROM answers WHERE workflow_id = ?', [workflowId]);
        
        // Insert new answers
        for (const answer of results.answers) {
          await db.run(`
            INSERT INTO answers (
              workflow_id, question_id, answer_text, confidence_score, 
              sources, answer_type, completeness, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            workflowId,
            answer.questionId,
            answer.answer,
            answer.confidence,
            JSON.stringify(answer.sources || []),
            answer.answerType || 'inferred',
            answer.completeness || 'partial'
          ]);
        }
      }
      
      // Update workflow results in workflow_results table
      if (results.extractedAnswers) {
        await db.run(`
          INSERT OR REPLACE INTO workflow_results (
            workflow_id, step_name, result_data, created_at
          ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          workflowId,
          'answer_extraction',
          JSON.stringify(results.extractedAnswers)
        ]);
      }
      
      logger.info('Workflow results updated successfully', { 
        workflowId, 
        answersCount: results.answers?.length || 0 
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error updating workflow results:', error);
      throw error;
    }
  }
}

// Create singleton instance
const dataService = new DataService();

module.exports = dataService;