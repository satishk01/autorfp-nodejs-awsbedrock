const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { Server } = require('socket.io');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs').promises;

const config = require('./config');
const logger = require('./utils/logger');
const agentOrchestrator = require('./orchestrator/agentOrchestrator');
const pdfGenerator = require('./services/pdfGenerator');
const dataService = require('./services/workflowDataService');

// Import route handlers
const rfpRoutes = require('./routes/rfp');
const documentsRoutes = require('./routes/documents');
const workflowRoutes = require('./routes/workflow');

class RFPServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.server.corsOrigin,
        methods: ['GET', 'POST']
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: config.server.corsOrigin,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // File upload configuration
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = config.upload.uploadDir;
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: this.parseFileSize(config.upload.maxFileSize)
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = config.upload.allowedTypes;
        const fileExt = path.extname(file.originalname).toLowerCase().slice(1);
        
        if (allowedTypes.includes(fileExt)) {
          cb(null, true);
        } else {
          cb(new Error(`File type .${fileExt} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
        }
      }
    });

    // Apply multer middleware to the process-rfp endpoint
    this.upload = upload;

    // Static files
    this.app.use('/uploads', express.static(config.upload.uploadDir));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const healthStatus = await dataService.healthCheck();
        res.json({
          status: healthStatus.overall,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: config.server.nodeEnv,
          services: healthStatus
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });

    // API routes
    this.app.use('/api/rfp', rfpRoutes);
    this.app.use('/api/documents', documentsRoutes);
    this.app.use('/api/workflow', workflowRoutes);

    // Main RFP processing endpoint
    this.app.post('/api/process-rfp', this.upload.array('documents', 10), async (req, res) => {
      try {
        let { projectContext, companyDocuments = [] } = req.body;
        const uploadedFiles = req.files || [];

        // Parse JSON strings if needed
        if (typeof projectContext === 'string') {
          try {
            projectContext = JSON.parse(projectContext);
          } catch (e) {
            logger.warn('Failed to parse projectContext JSON:', e);
            projectContext = {};
          }
        }

        if (typeof companyDocuments === 'string') {
          try {
            companyDocuments = JSON.parse(companyDocuments);
          } catch (e) {
            logger.warn('Failed to parse companyDocuments JSON:', e);
            companyDocuments = [];
          }
        }

        // Ensure companyDocuments is an array
        if (!Array.isArray(companyDocuments)) {
          companyDocuments = [];
        }

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

        // Start processing workflow
        const workflowId = agentOrchestrator.generateWorkflowId();
        
        // Set up progress callback for Socket.IO
        const progressCallback = (progress) => {
          this.io.emit('workflow-progress', progress);
        };

        // Process asynchronously
        agentOrchestrator.processRFP(documents, companyDocuments, projectContext, progressCallback, workflowId)
          .then(result => {
            this.io.emit('workflow-complete', result);
            logger.info('RFP processing completed', { workflowId: result.workflowId });
          })
          .catch(error => {
            this.io.emit('workflow-error', { workflowId, error: error.message });
            logger.error('RFP processing failed', { workflowId, error });
          });

        res.json({
          success: true,
          workflowId,
          message: 'RFP processing started',
          documentsUploaded: documents.length
        });

      } catch (error) {
        logger.error('Error starting RFP processing:', error);
        res.status(500).json({
          error: 'Failed to start RFP processing',
          details: error.message
        });
      }
    });

    // Test RAG service endpoint
    this.app.post('/api/test-rag', async (req, res) => {
      try {
        const { question } = req.body;
        if (!question) {
          return res.status(400).json({ error: 'Question is required' });
        }

        const ragService = require('./services/ragService');
        const result = await ragService.answerQuestion(question);
        
        res.json({
          success: true,
          question,
          result,
          serviceType: ragService.getActiveServiceType(),
          stats: ragService.getStats()
        });
      } catch (error) {
        logger.error('Error testing RAG service:', error);
        res.status(500).json({
          error: 'RAG service error',
          details: error.message
        });
      }
    });

    // RAG service status endpoint
    this.app.get('/api/rag-status', async (req, res) => {
      try {
        const ragService = require('./services/ragService');
        const stats = ragService.getStats();
        
        res.json({
          success: true,
          ...stats
        });
      } catch (error) {
        logger.error('Error getting RAG status:', error);
        res.status(500).json({
          error: 'Failed to get RAG status',
          details: error.message
        });
      }
    });

    // Vectorize existing documents endpoint
    this.app.post('/api/vectorize-documents', async (req, res) => {
      try {
        const documentProcessor = require('./services/documentProcessor');
        const fs = require('fs').promises;
        const path = require('path');
        
        logger.info('Starting document vectorization...');
        const uploadsDir = './uploads';
        const files = await fs.readdir(uploadsDir);
        
        let processed = 0;
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            try {
              const filePath = path.join(uploadsDir, file);
              await documentProcessor.processDocument(filePath, file);
              processed++;
              logger.info(`Vectorized document: ${file}`);
            } catch (error) {
              logger.error(`Error vectorizing ${file}:`, error.message);
            }
          }
        }
        
        res.json({
          success: true,
          message: `Successfully vectorized ${processed} documents`,
          processedCount: processed
        });
      } catch (error) {
        logger.error('Error vectorizing documents:', error);
        res.status(500).json({
          error: 'Document vectorization failed',
          details: error.message
        });
      }
    });

    // Test RAG with workflow questions
    this.app.post('/api/test-workflow-rag/:workflowId', async (req, res) => {
      try {
        const { workflowId } = req.params;
        const ragService = require('./services/ragService');
        
        // Get workflow questions
        const workflowResponse = await fetch(`http://localhost:3001/api/rfp/workflow/${workflowId}`);
        const workflowData = await workflowResponse.json();
        
        if (!workflowData.questions || workflowData.questions.length === 0) {
          return res.status(400).json({ error: 'No questions found in workflow' });
        }
        
        const answers = [];
        let processed = 0;
        
        // Process first 3 questions as a test
        const questionsToTest = workflowData.questions.slice(0, 3);
        
        for (const question of questionsToTest) {
          try {
            const result = await ragService.answerQuestion(question.question_text);
            answers.push({
              questionId: question.question_id,
              question: question.question_text,
              answer: result.answer,
              confidence: result.confidence,
              sources: result.sources
            });
            processed++;
          } catch (error) {
            logger.error(`Error answering question ${question.question_id}:`, error.message);
          }
        }
        
        res.json({
          success: true,
          workflowId,
          processedQuestions: processed,
          totalQuestions: workflowData.questions.length,
          answers
        });
      } catch (error) {
        logger.error('Error testing workflow RAG:', error);
        res.status(500).json({
          error: 'Workflow RAG test failed',
          details: error.message
        });
      }
    });

    // Generate PDF report
    this.app.post('/api/generate-pdf/:workflowId', async (req, res) => {
      try {
        const { workflowId } = req.params;
        const workflowStatus = await agentOrchestrator.getWorkflowStatus(workflowId);

        if (workflowStatus.error) {
          return res.status(404).json({ error: 'Workflow not found' });
        }

        if (workflowStatus.status !== 'completed') {
          return res.status(400).json({ 
            error: 'Workflow not completed yet',
            status: workflowStatus.status
          });
        }

        const results = workflowStatus.results;
        const projectContext = workflowStatus.projectContext || req.body.projectContext || {};

        // Generate PDF
        const pdfBuffer = await pdfGenerator.generateRFPReport(results, projectContext);

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="rfp-analysis-${workflowId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Accept-Ranges', 'bytes');

        // Ensure we're sending binary data correctly
        res.writeHead(200);
        res.end(pdfBuffer);

      } catch (error) {
        logger.error('Error generating PDF:', error);
        res.status(500).json({
          error: 'Failed to generate PDF',
          details: error.message
        });
      }
    });

    // Serve React app (production)
    if (config.server.nodeEnv === 'production') {
      this.app.use(express.static(path.join(process.cwd(), 'client/build')));
      
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'client/build', 'index.html'));
      });
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });

      socket.on('join-workflow', (workflowId) => {
        socket.join(`workflow-${workflowId}`);
        logger.info('Client joined workflow', { socketId: socket.id, workflowId });
      });

      socket.on('leave-workflow', (workflowId) => {
        socket.leave(`workflow-${workflowId}`);
        logger.info('Client left workflow', { socketId: socket.id, workflowId });
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected', { socketId: socket.id });
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            maxSize: config.upload.maxFileSize
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files',
            maxCount: 10
          });
        }
      }

      res.status(500).json({
        error: 'Internal server error',
        message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  parseFileSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    
    if (!match) {
      return 50 * 1024 * 1024; // Default 50MB
    }
    
    const [, size, unit] = match;
    return parseFloat(size) * units[unit.toUpperCase()];
  }

  async start() {
    try {
      // Ensure required directories exist
      await fs.mkdir(config.upload.uploadDir, { recursive: true });
      await fs.mkdir('./logs', { recursive: true });
      await fs.mkdir('./data', { recursive: true });

      // Initialize data services
      await dataService.initialize();
      logger.info('Data services initialized');

      // Initialize RAG service
      const ragService = require('./services/ragService');
      const ragInitialized = await ragService.initialize();
      if (ragInitialized) {
        logger.info('RAG service initialized successfully');
      } else {
        logger.warn('RAG service initialization failed, answers may be limited');
      }

      // Clean up any corrupted workflows from previous runs
      await agentOrchestrator.cleanupCorruptedWorkflows();
      logger.info('Corrupted workflows cleanup completed');

      // Start server
      this.server.listen(config.server.port, () => {
        logger.info(`RFP Automation Server started`, {
          port: config.server.port,
          environment: config.server.nodeEnv,
          uploadDir: config.upload.uploadDir,
          database: config.database.url,
          redis: config.redis.url
        });
      });

      // Cleanup old workflows periodically
      setInterval(async () => {
        try {
          await dataService.cleanupOldWorkflows();
          agentOrchestrator.cleanupOldWorkflows();
          await agentOrchestrator.cleanupCorruptedWorkflows();
        } catch (error) {
          logger.error('Cleanup error:', error);
        }
      }, 60 * 60 * 1000); // Every hour

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(signal) {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    try {
      // Close server
      await new Promise((resolve) => {
        this.server.close(resolve);
      });

      // Close PDF generator
      await pdfGenerator.close();

      // Close data services
      await dataService.close();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new RFPServer();
server.start();

module.exports = server;