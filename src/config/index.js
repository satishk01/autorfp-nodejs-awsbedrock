const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001'
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bedrockModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
    bedrockMindmapModelId: process.env.BEDROCK_MINDMAP_MODEL_ID || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
  },
  database: {
    url: process.env.DATABASE_URL || './data/rfp_system.db',
    workflowSpecific: process.env.WORKFLOW_SPECIFIC_DB !== 'false' // Default to true
  },
  redis: {
    url: process.env.REDIS_URL || 'disabled' // Set to 'disabled' to use in-memory cache
  },
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '50MB',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    allowedTypes: ['pdf', 'docx', 'txt', 'csv', 'xlsx', 'xls']
  },
  storage: {
    dataDir: process.env.DATA_DIR || './data',
    vectorDir: process.env.VECTOR_DIR || './data/vectors',
    workflowSpecific: process.env.WORKFLOW_SPECIFIC_STORAGE !== 'false' // Default to true
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  }
};

module.exports = config;