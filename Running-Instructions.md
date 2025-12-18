# RFP Automation System - Complete Setup Instructions

## Overview
The RFP Automation System is a full-stack application that automates RFP (Request for Proposal) processing using AI services. It features document analysis, question generation, answer extraction, mindmap creation, architecture analysis, and diagram generation.

## Architecture
- **Backend**: Node.js/Express server (Port 3001)
- **Frontend**: React application (Port 3000)
- **Database**: SQLite (auto-created)
- **AI Services**: AWS Bedrock (Claude), Google Gemini
- **File Storage**: Local filesystem
- **Vector Storage**: In-memory/persistent storage

## Prerequisites

### Required Software
1. **Node.js** (v16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Git** (for cloning repository)
   - Download from: https://git-scm.com/

### Required API Keys
1. **AWS Credentials** (for Bedrock Claude models)
   - AWS Access Key ID
   - AWS Secret Access Key
   - AWS Region (us-east-1 recommended)

2. **Google API Key** (for Gemini models)
   - Google Generative AI API key
   - Get from: https://makersuite.google.com/app/apikey

## Installation Steps

### Step 1: Clone and Setup Project
```bash
# Clone the repository
git clone <repository-url>
cd rfp-automation-system

# Create required directories
mkdir -p data logs uploads public/templates

# Copy environment configuration
cp .env.example .env
```

### Step 2: Configure Environment Variables
Edit the `.env` file with your credentials:

```env
# AWS Configuration (Required for Architecture Analysis & Technical Writeups)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Google Configuration (Required for Mindmaps)
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL_ID=models/gemini-2.5-flash

# Server Configuration
PORT=3001
NODE_ENV=development

# Database (SQLite - will be created automatically)
DATABASE_URL=./data/rfp_system.db

# Redis (disabled - uses in-memory cache instead)
REDIS_URL=disabled

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_DIR=./uploads

# Security
JWT_SECRET=your_jwt_secret_change_in_production
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Step 3: Install Backend Dependencies
Since there's no package.json in the root, you need to create one or install dependencies manually:

```bash
# Initialize package.json if it doesn't exist
npm init -y

# Install core backend dependencies
npm install express cors helmet multer socket.io dotenv
npm install winston sqlite3 sqlite
npm install @aws-sdk/client-bedrock-runtime
npm install @google/generative-ai
npm install pdf-parse mammoth exceljs csv-parser
npm install puppeteer chromadb redis
npm install @modelcontextprotocol/sdk

# Install development dependencies
npm install --save-dev nodemon
```

### Step 4: Install Frontend Dependencies
```bash
# Navigate to client directory
cd client

# Install frontend dependencies
npm install

# Return to root directory
cd ..
```

### Step 5: Create Required Files and Directories
```bash
# Create database schema (if not exists)
mkdir -p data
touch data/rfp_system.db

# Create logs directory
mkdir -p logs

# Create uploads directory
mkdir -p uploads

# Ensure public templates exist
mkdir -p public/templates
```

## Backend Dependencies Summary
Based on the code analysis, here are the required backend dependencies:

### Core Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0",
    "multer": "^1.4.5",
    "socket.io": "^4.6.0",
    "dotenv": "^16.0.0",
    "winston": "^3.8.0",
    "sqlite3": "^5.1.0",
    "sqlite": "^4.1.0",
    "@aws-sdk/client-bedrock-runtime": "^3.450.0",
    "@google/generative-ai": "^0.2.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.5.0",
    "exceljs": "^4.3.0",
    "csv-parser": "^3.0.0",
    "puppeteer": "^19.0.0",
    "chromadb": "^1.5.0",
    "redis": "^4.6.0",
    "@modelcontextprotocol/sdk": "^0.4.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

## Running the Application

### Method 1: Development Mode (Recommended)

#### Terminal 1 - Backend Server
```bash
# From project root directory
node src/server.js

# OR if you have nodemon installed
npx nodemon src/server.js
```

#### Terminal 2 - Frontend Development Server
```bash
# From project root directory
cd client
npm start
```

### Method 2: Production Mode
```bash
# Build frontend for production
cd client
npm run build
cd ..

# Start backend server
NODE_ENV=production node src/server.js
```

## Accessing the Application

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:3001
3. **API Documentation**: Available through the application interface

## Application Features

### 1. Document Processing
- Upload PDF, DOCX, TXT, CSV, XLSX files
- Automatic text extraction and processing
- Support for large files (up to 100MB)

### 2. RFP Workflow
- **Requirements Analysis**: AI-powered requirement extraction
- **Question Generation**: Automatic question creation from documents
- **Answer Extraction**: RAG-based answer generation
- **Custom Questions**: Add/edit/delete custom questions
- **Excel Upload**: Bulk question upload via Excel/CSV templates

### 3. Advanced Features
- **Mindmap Generation**: NotebookLM-style mindmaps using Google Gemini
- **Architecture Analysis**: AWS architecture recommendations using Claude
- **Architecture Diagrams**: Visual AWS diagrams with technical writeups
- **PDF Reports**: Generate comprehensive PDF reports

### 4. Architecture Diagram Features
- **AWS Component Shapes**: Distinctive service shapes (S3 bucket, RDS cylinder, Lambda function, etc.)
- **Multiple Formats**: Draw.io XML, Mermaid, SVG, PNG export
- **Technical Writeups**: Claude-generated technical analysis for each connection
- **Professional Styling**: AWS official colors and layouts

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill processes on ports 3000 and 3001
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

#### 2. AWS Credentials Issues
- Verify AWS credentials in `.env` file
- Ensure AWS region is set correctly
- Check AWS Bedrock service availability in your region

#### 3. Google API Issues
- Verify Google API key in `.env` file
- Ensure Generative AI API is enabled
- Check API quotas and limits

#### 4. Database Issues
```bash
# Reset database (will lose all data)
rm -f data/rfp_system.db
# Restart the application to recreate database
```

#### 5. File Upload Issues
- Check `uploads` directory permissions
- Verify `MAX_FILE_SIZE` setting in `.env`
- Ensure sufficient disk space

### Performance Optimization

#### 1. Large File Processing
- Files over 15MB are automatically chunked
- Intelligent content prioritization for AI processing
- Token management for AI model limits

#### 2. Caching
- Architecture diagrams are cached for performance
- Clear cache via API: `POST /api/rfp/clear-diagram-cache`

#### 3. Memory Management
- Vector storage uses persistent storage for large datasets
- Redis can be enabled for distributed caching

## Development Guidelines

### Code Structure
```
src/
├── agents/           # AI processing agents
├── config/           # Configuration management
├── orchestrator/     # Workflow orchestration
├── routes/           # API route handlers
├── services/         # Business logic services
└── utils/           # Utility functions

client/
├── public/          # Static assets
└── src/
    ├── components/  # React components
    ├── pages/       # Page components
    └── utils/       # Frontend utilities
```

### Adding New Features
1. Create service in `src/services/`
2. Add routes in `src/routes/`
3. Create React components in `client/src/components/`
4. Update configuration if needed

### Environment-Specific Configuration
- **Development**: Uses SQLite, in-memory cache, detailed logging
- **Production**: Can use external databases, Redis, optimized logging

## Security Considerations

### Production Deployment
1. Change `JWT_SECRET` to a strong, unique value
2. Use environment-specific AWS credentials
3. Enable HTTPS in production
4. Configure proper CORS origins
5. Set up proper file upload validation
6. Enable rate limiting
7. Use secure headers (Helmet.js is already configured)

### API Security
- All endpoints use proper authentication
- File uploads are validated and sanitized
- SQL injection protection via parameterized queries
- XSS protection via content security policy

## Monitoring and Logging

### Log Files
- Application logs: `./logs/app.log`
- Error tracking via Winston logger
- Configurable log levels (debug, info, warn, error)

### Health Checks
- Server status: `GET /api/health`
- Database connectivity: Automatic on startup
- AI service availability: Tested on first use

## Support and Maintenance

### Regular Maintenance
1. Update dependencies regularly
2. Monitor log files for errors
3. Clean up old uploaded files
4. Backup database files
5. Monitor API usage and quotas

### Backup Strategy
```bash
# Backup database
cp data/rfp_system.db data/backup_$(date +%Y%m%d).db

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## API Endpoints Summary

### Core Endpoints
- `POST /api/rfp/upload` - Upload documents
- `GET /api/rfp/workflows` - List workflows
- `POST /api/rfp/workflow/:id/generate-questions` - Generate questions
- `POST /api/rfp/workflow/:id/generate-answers` - Generate answers
- `POST /api/rfp/workflow/:id/generate-mindmap` - Generate mindmap
- `POST /api/rfp/workflow/:id/analyze-architecture` - Architecture analysis
- `POST /api/rfp/workflow/:id/generate-architecture-diagram` - Generate diagrams

### Management Endpoints
- `POST /api/rfp/clear-diagram-cache` - Clear diagram cache
- `GET /api/health` - Health check
- `POST /api/rfp/workflow/:id/export-pdf` - Export PDF report

This completes the comprehensive setup and running instructions for the RFP Automation System.