const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class WorkflowDatabaseManager {
  constructor() {
    this.databases = new Map(); // Cache of open database connections
    this.baseDataDir = './data';
  }

  /**
   * Get database path for a specific workflow
   */
  getWorkflowDatabasePath(workflowId) {
    return path.join(this.baseDataDir, workflowId, 'workflow.db');
  }

  /**
   * Get or create database connection for a specific workflow
   */
  async getWorkflowDatabase(workflowId) {
    // Return cached connection if exists
    if (this.databases.has(workflowId)) {
      return this.databases.get(workflowId);
    }

    try {
      const dbPath = this.getWorkflowDatabasePath(workflowId);
      const dbDir = path.dirname(dbPath);
      
      // Ensure workflow directory exists
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys and WAL mode
      await db.exec('PRAGMA foreign_keys = ON');
      await db.exec('PRAGMA journal_mode = WAL');

      // Initialize schema for this workflow
      await this.initializeWorkflowSchema(db);

      // Cache the connection
      this.databases.set(workflowId, db);

      logger.info('Workflow database initialized', { workflowId, path: dbPath });
      return db;
    } catch (error) {
      logger.error('Failed to initialize workflow database', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Initialize schema for a workflow-specific database
   */
  async initializeWorkflowSchema(db) {
    try {
      const schemaPath = path.join(process.cwd(), 'src/database/workflow-schema.sql');
      
      // Check if workflow-specific schema exists, otherwise use main schema
      let schema;
      try {
        schema = await fs.readFile(schemaPath, 'utf8');
      } catch {
        // Fallback to main schema
        const mainSchemaPath = path.join(process.cwd(), 'src/database/schema.sql');
        schema = await fs.readFile(mainSchemaPath, 'utf8');
      }
      
      await db.exec(schema);
      logger.debug('Workflow database schema initialized');
    } catch (error) {
      logger.error('Failed to initialize workflow database schema:', error);
      throw error;
    }
  }

  /**
   * Create a new workflow database and initialize it
   */
  async createWorkflowDatabase(workflowId, workflowData) {
    const db = await this.getWorkflowDatabase(workflowId);
    
    // Create initial workflow record
    const { status, currentStep, progress, projectContext } = workflowData;
    
    await db.run(`
      INSERT INTO workflows (id, status, current_step, progress, project_context)
      VALUES (?, ?, ?, ?, ?)
    `, [workflowId, status, currentStep, progress, JSON.stringify(projectContext)]);

    logger.info('Workflow database created and initialized', { workflowId });
    return db;
  }

  /**
   * Get all workflow IDs (by scanning data directory)
   */
  async getAllWorkflowIds() {
    try {
      const entries = await fs.readdir(this.baseDataDir, { withFileTypes: true });
      const workflowIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => name.startsWith('rfp_')); // Filter for RFP workflow IDs
      
      return workflowIds;
    } catch (error) {
      logger.warn('Error reading workflow directories', { error: error.message });
      return [];
    }
  }

  /**
   * Get workflow metadata from all workflows
   */
  async getAllWorkflowsMetadata(limit = 50, offset = 0) {
    const workflowIds = await this.getAllWorkflowIds();
    const workflows = [];

    for (const workflowId of workflowIds.slice(offset, offset + limit)) {
      try {
        const db = await this.getWorkflowDatabase(workflowId);
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        
        if (workflow) {
          if (workflow.project_context) {
            workflow.project_context = JSON.parse(workflow.project_context);
          }
          workflows.push(workflow);
        }
      } catch (error) {
        logger.warn('Error loading workflow metadata', { workflowId, error: error.message });
      }
    }

    // Sort by creation date
    workflows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return workflows;
  }

  /**
   * Delete a workflow database and its directory
   */
  async deleteWorkflowDatabase(workflowId) {
    try {
      // Close database connection if open
      if (this.databases.has(workflowId)) {
        const db = this.databases.get(workflowId);
        await db.close();
        this.databases.delete(workflowId);
      }

      // Remove the entire workflow directory
      const workflowDir = path.join(this.baseDataDir, workflowId);
      await fs.rm(workflowDir, { recursive: true, force: true });

      logger.info('Workflow database and directory deleted', { workflowId });
    } catch (error) {
      logger.error('Error deleting workflow database', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Get database statistics for a workflow
   */
  async getWorkflowDatabaseStats(workflowId) {
    try {
      const db = await this.getWorkflowDatabase(workflowId);
      
      const [workflow, documents, requirements, questions, answers] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM workflows'),
        db.get('SELECT COUNT(*) as count FROM documents'),
        db.get('SELECT COUNT(*) as count FROM requirements'),
        db.get('SELECT COUNT(*) as count FROM questions'),
        db.get('SELECT COUNT(*) as count FROM answers')
      ]);

      return {
        workflowId,
        workflows: workflow.count,
        documents: documents.count,
        requirements: requirements.count,
        questions: questions.count,
        answers: answers.count
      };
    } catch (error) {
      logger.error('Error getting workflow database stats', { workflowId, error: error.message });
      return null;
    }
  }

  /**
   * Close all database connections
   */
  async closeAllConnections() {
    const promises = [];
    
    for (const [workflowId, db] of this.databases.entries()) {
      promises.push(
        db.close().then(() => {
          logger.debug('Closed database connection', { workflowId });
        }).catch(error => {
          logger.warn('Error closing database connection', { workflowId, error: error.message });
        })
      );
    }

    await Promise.all(promises);
    this.databases.clear();
    logger.info('All workflow database connections closed');
  }

  /**
   * Migrate existing data to workflow-specific databases
   */
  async migrateExistingData() {
    try {
      // Check if main database exists
      const mainDbPath = path.resolve(config.database.url);
      
      try {
        await fs.access(mainDbPath);
      } catch {
        logger.info('No existing main database found, skipping migration');
        return;
      }

      logger.info('Starting migration of existing data to workflow-specific databases');

      // Open main database
      const mainDb = await open({
        filename: mainDbPath,
        driver: sqlite3.Database
      });

      // Get all workflows from main database
      const workflows = await mainDb.all('SELECT * FROM workflows');
      
      for (const workflow of workflows) {
        const workflowId = workflow.id;
        logger.info('Migrating workflow', { workflowId });

        // Create workflow-specific database
        const workflowDb = await this.createWorkflowDatabase(workflowId, {
          status: workflow.status,
          currentStep: workflow.current_step,
          progress: workflow.progress,
          projectContext: JSON.parse(workflow.project_context || '{}')
        });

        // Migrate documents
        const documents = await mainDb.all('SELECT * FROM documents WHERE workflow_id = ?', [workflowId]);
        for (const doc of documents) {
          await workflowDb.run(`
            INSERT INTO documents (
              id, workflow_id, original_name, file_path, file_size, mime_type,
              document_type, processing_status, processed_content, metadata, structured_data,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            doc.id, doc.workflow_id, doc.original_name, doc.file_path, doc.file_size,
            doc.mime_type, doc.document_type, doc.processing_status, doc.processed_content,
            doc.metadata, doc.structured_data, doc.created_at, doc.updated_at
          ]);
        }

        // Migrate requirements
        const requirements = await mainDb.all('SELECT * FROM requirements WHERE workflow_id = ?', [workflowId]);
        for (const req of requirements) {
          await workflowDb.run(`
            INSERT INTO requirements (
              workflow_id, requirement_id, category, description, priority,
              complexity, mandatory, source_document_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            req.workflow_id, req.requirement_id, req.category, req.description,
            req.priority, req.complexity, req.mandatory, req.source_document_id,
            req.created_at
          ]);
        }

        // Migrate questions
        const questions = await mainDb.all('SELECT * FROM questions WHERE workflow_id = ?', [workflowId]);
        for (const q of questions) {
          await workflowDb.run(`
            INSERT INTO questions (
              workflow_id, question_id, category, question_text, rationale,
              priority, impact, related_requirements, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            q.workflow_id, q.question_id, q.category, q.question_text,
            q.rationale, q.priority, q.impact, q.related_requirements,
            q.created_at
          ]);
        }

        // Migrate answers
        const answers = await mainDb.all('SELECT * FROM answers WHERE workflow_id = ?', [workflowId]);
        for (const a of answers) {
          await workflowDb.run(`
            INSERT INTO answers (
              workflow_id, question_id, answer_text, confidence_score,
              answer_type, completeness, sources, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            a.workflow_id, a.question_id, a.answer_text, a.confidence_score,
            a.answer_type, a.completeness, a.sources, a.created_at
          ]);
        }

        // Migrate workflow results
        const results = await mainDb.all('SELECT * FROM workflow_results WHERE workflow_id = ?', [workflowId]);
        for (const result of results) {
          await workflowDb.run(`
            INSERT INTO workflow_results (
              workflow_id, step_name, result_data, confidence_score,
              processing_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            result.workflow_id, result.step_name, result.result_data,
            result.confidence_score, result.processing_time, result.created_at
          ]);
        }

        logger.info('Workflow migration completed', { 
          workflowId, 
          documents: documents.length,
          requirements: requirements.length,
          questions: questions.length,
          answers: answers.length,
          results: results.length
        });
      }

      await mainDb.close();

      // Rename main database to backup
      const backupPath = mainDbPath + '.backup.' + Date.now();
      await fs.rename(mainDbPath, backupPath);
      
      logger.info('Migration completed successfully', { 
        totalWorkflows: workflows.length,
        backupPath
      });

    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = WorkflowDatabaseManager;