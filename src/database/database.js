const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return this.db;

    try {
      // Ensure database directory exists
      const dbPath = path.resolve(config.database.url);
      const dbDir = path.dirname(dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys = ON');
      await this.db.exec('PRAGMA journal_mode = WAL');

      // Initialize schema
      await this.initializeSchema();

      this.isInitialized = true;
      logger.info('Database initialized successfully', { path: dbPath });

      return this.db;
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async initializeSchema() {
    try {
      const schemaPath = path.join(process.cwd(), 'src/database/schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      await this.db.exec(schema);
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  // Workflow operations
  async createWorkflow(workflowData) {
    const { id, status, currentStep, progress, projectContext } = workflowData;
    
    const result = await this.db.run(`
      INSERT INTO workflows (id, status, current_step, progress, project_context)
      VALUES (?, ?, ?, ?, ?)
    `, [id, status, currentStep, progress, JSON.stringify(projectContext)]);

    logger.info('Workflow created in database', { workflowId: id });
    return result;
  }

  async updateWorkflow(workflowId, updates) {
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
    const result = await this.db.run(query, values);

    logger.debug('Workflow updated in database', { workflowId, updates });
    return result;
  }

  async getWorkflow(workflowId) {
    const workflow = await this.db.get(`
      SELECT * FROM workflows WHERE id = ?
    `, [workflowId]);

    if (workflow && workflow.project_context) {
      workflow.project_context = JSON.parse(workflow.project_context);
    }

    return workflow;
  }

  async getAllWorkflows(limit = 50, offset = 0) {
    const workflows = await this.db.all(`
      SELECT * FROM workflows 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return workflows.map(workflow => {
      if (workflow.project_context) {
        workflow.project_context = JSON.parse(workflow.project_context);
      }
      return workflow;
    });
  }

  async deleteWorkflow(workflowId) {
    const result = await this.db.run(`
      DELETE FROM workflows WHERE id = ?
    `, [workflowId]);

    logger.info('Workflow deleted from database', { workflowId });
    return result;
  }

  // Document operations
  async createDocument(documentData) {
    const {
      id, workflowId, originalName, filePath, fileSize, mimeType,
      documentType, processingStatus, processedContent, metadata, structuredData
    } = documentData;

    const result = await this.db.run(`
      INSERT INTO documents (
        id, workflow_id, original_name, file_path, file_size, mime_type,
        document_type, processing_status, processed_content, metadata, structured_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, workflowId, originalName, filePath, fileSize, mimeType,
      documentType, processingStatus, processedContent,
      JSON.stringify(metadata), JSON.stringify(structuredData)
    ]);

    logger.debug('Document created in database', { documentId: id, workflowId });
    return result;
  }

  async updateDocument(documentId, updates) {
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
    values.push(documentId);

    const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`;
    const result = await this.db.run(query, values);

    return result;
  }

  async getDocumentsByWorkflow(workflowId) {
    const documents = await this.db.all(`
      SELECT * FROM documents WHERE workflow_id = ?
      ORDER BY created_at ASC
    `, [workflowId]);

    return documents.map(doc => {
      if (doc.metadata) doc.metadata = JSON.parse(doc.metadata);
      if (doc.structured_data) doc.structured_data = JSON.parse(doc.structured_data);
      return doc;
    });
  }

  // Workflow results operations
  async saveWorkflowResult(workflowId, stepName, resultData, confidenceScore = null, processingTime = null) {
    const result = await this.db.run(`
      INSERT INTO workflow_results (workflow_id, step_name, result_data, confidence_score, processing_time)
      VALUES (?, ?, ?, ?, ?)
    `, [workflowId, stepName, JSON.stringify(resultData), confidenceScore, processingTime]);

    logger.debug('Workflow result saved', { workflowId, stepName });
    return result;
  }

  async getWorkflowResults(workflowId) {
    const results = await this.db.all(`
      SELECT * FROM workflow_results 
      WHERE workflow_id = ? 
      ORDER BY created_at ASC
    `, [workflowId]);

    const resultMap = {};
    results.forEach(result => {
      resultMap[result.step_name] = {
        ...JSON.parse(result.result_data),
        confidence_score: result.confidence_score,
        processing_time: result.processing_time,
        created_at: result.created_at
      };
    });

    return resultMap;
  }

  // Requirements operations
  async saveRequirements(workflowId, requirements) {
    const stmt = await this.db.prepare(`
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
    logger.debug('Requirements saved', { workflowId, count: requirements.length });
  }

  async getRequirements(workflowId) {
    return await this.db.all(`
      SELECT * FROM requirements 
      WHERE workflow_id = ? 
      ORDER BY priority DESC, created_at ASC
    `, [workflowId]);
  }

  // Questions operations
  async saveQuestions(workflowId, questions) {
    const stmt = await this.db.prepare(`
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
    logger.debug('Questions saved', { workflowId, count: questions.length });
  }

  async getQuestions(workflowId) {
    const questions = await this.db.all(`
      SELECT * FROM questions 
      WHERE workflow_id = ? 
      ORDER BY priority DESC, created_at ASC
    `, [workflowId]);

    return questions.map(q => {
      if (q.related_requirements) {
        q.related_requirements = JSON.parse(q.related_requirements);
      }
      return q;
    });
  }

  // Answers operations
  async saveAnswers(workflowId, answers) {
    const stmt = await this.db.prepare(`
      INSERT INTO answers (
        workflow_id, question_id, answer_text, confidence_score,
        answer_type, completeness, sources
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const answer of answers) {
      await stmt.run([
        workflowId, answer.questionId, answer.answerText || answer.answer, answer.confidenceScore || answer.confidence,
        answer.answerType, answer.completeness, answer.sources || JSON.stringify(answer.sources || [])
      ]);
    }

    await stmt.finalize();
    logger.debug('Answers saved', { workflowId, count: answers.length });
  }

  async getAnswers(workflowId) {
    const answers = await this.db.all(`
      SELECT * FROM answers 
      WHERE workflow_id = ? 
      ORDER BY confidence_score DESC, created_at ASC
    `, [workflowId]);

    return answers.map(a => {
      if (a.sources) {
        a.sources = JSON.parse(a.sources);
      }
      return a;
    });
  }

  async updateWorkflowStatus(workflowId, status, errorMessage = null) {
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
    
    await this.db.run(`
      UPDATE workflows 
      SET ${setClause}
      WHERE id = ?
    `, values);
    
    logger.debug('Workflow status updated', { workflowId, status, errorMessage });
  }

  // Statistics and analytics
  async getWorkflowStatistics() {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avg_duration
      FROM workflows
    `);

    const documentStats = await this.db.get(`
      SELECT COUNT(*) as total_documents
      FROM documents
    `);

    const requirementStats = await this.db.get(`
      SELECT COUNT(*) as total_requirements
      FROM requirements
    `);

    const questionStats = await this.db.get(`
      SELECT COUNT(*) as total_questions
      FROM questions
    `);

    return {
      ...stats,
      ...documentStats,
      ...requirementStats,
      ...questionStats
    };
  }

  // Audit logging
  async logActivity(workflowId, action, details, userId = null, ipAddress = null) {
    await this.db.run(`
      INSERT INTO audit_log (workflow_id, action, details, user_id, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [workflowId, action, JSON.stringify(details), userId, ipAddress]);
  }

  // Performance metrics
  async savePerformanceMetric(workflowId, metricName, metricValue, unit = null) {
    await this.db.run(`
      INSERT INTO performance_metrics (workflow_id, metric_name, metric_value, unit)
      VALUES (?, ?, ?, ?)
    `, [workflowId, metricName, metricValue, unit]);
  }

  // Cleanup operations
  async cleanupOldWorkflows(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const cutoffDate = new Date(Date.now() - maxAge).toISOString();
    
    const result = await this.db.run(`
      DELETE FROM workflows 
      WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')
    `, [cutoffDate]);

    logger.info('Old workflows cleaned up', { deletedCount: result.changes });
    return result.changes;
  }

  // Settings operations
  async getSetting(key) {
    const setting = await this.db.get(`
      SELECT value FROM settings WHERE key = ?
    `, [key]);
    
    return setting ? setting.value : null;
  }

  async setSetting(key, value, description = null) {
    await this.db.run(`
      INSERT OR REPLACE INTO settings (key, value, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [key, value, description]);
  }

  async getAllSettings() {
    return await this.db.all(`SELECT * FROM settings ORDER BY key`);
  }

  // Health check
  async healthCheck() {
    try {
      await this.db.get('SELECT 1');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Close database connection
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      logger.info('Database connection closed');
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;