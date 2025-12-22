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

3. **Neo4j Database** (optional, for GraphRAG features)
   - Neo4j Community Edition (local installation)
   - Download from: https://neo4j.com/download/
   - Default credentials: username=neo4j, password=your_password

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

# Neo4j Configuration (Optional - for GraphRAG Knowledge Graph)
NEO4J_ENABLED=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j

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

# Install GraphRAG dependencies (for Neo4j integration)
npm install neo4j-driver uuid
npm install pdf-parse mammoth exceljs csv-parser
npm install puppeteer chromadb redis
npm install @modelcontextprotocol/sdk

# Install development dependencies
npm install --save-dev nodemon
```

### Step 4: Setup Neo4j (Optional - for GraphRAG Knowledge Graph)

**Option 1: Neo4j Desktop (Recommended for development)**
1. Download Neo4j Desktop from: https://neo4j.com/download/
2. Install and create a new project
3. Create a new database with:
   - Name: `rfp-graphrag`
   - Password: `your_password` (update in .env file)
4. Start the database
5. Verify connection at: http://localhost:7474

**Option 2: Neo4j Community Server**
```bash
# Using Docker (easiest)
docker run \
    --name neo4j-rfp \
    -p7474:7474 -p7687:7687 \
    -d \
    -v $HOME/neo4j/data:/data \
    -v $HOME/neo4j/logs:/logs \
    -v $HOME/neo4j/import:/var/lib/neo4j/import \
    -v $HOME/neo4j/plugins:/plugins \
    --env NEO4J_AUTH=neo4j/your_password \
    neo4j:latest

# Or download and install manually from neo4j.com
```

**Option 3: Disable Neo4j (Vector-only mode)**
If you don't want to install Neo4j, set in `.env`:
```env
NEO4J_ENABLED=false
```
The system will work with vector-only RAG (no knowledge graph features).

### Step 5: Install Frontend Dependencies
```bash
# Navigate to client directory
cd client

# Install frontend dependencies
npm install

# Return to root directory
cd ..
```

### Step 6: Create Required Files and Directories
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

### 4. GraphRAG Knowledge Graph Features (Optional)
- **Entity Extraction**: AI-powered entity identification from documents
- **Relationship Mapping**: Automatic relationship discovery between entities
- **Hybrid Search**: Combines vector similarity with graph traversal
- **Knowledge Graph Visualization**: Interactive graph display
- **Enhanced Context**: Richer answers using entity relationships

### 5. Architecture Diagram Features
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

#### 5. Neo4j Connection Issues (GraphRAG)
```bash
# Check if Neo4j is running
# Neo4j Desktop: Check status in application
# Docker: docker ps | grep neo4j

# Test connection
curl http://localhost:7474

# Reset Neo4j data (will lose all graph data)
# Stop Neo4j, delete data directory, restart

# Disable Neo4j if not needed
# Set NEO4J_ENABLED=false in .env file
```

#### 6. File Upload Issues
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