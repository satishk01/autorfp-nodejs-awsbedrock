# RFP Response Automation System

A production-grade RFP (Request for Proposal) response automation system built with Strands agents and AWS Bedrock Claude Haiku 3. This system intelligently processes RFP documents, analyzes requirements, generates clarification questions, extracts answers from company documents, and compiles comprehensive responses.

## 🚀 Features

### Core Functionality
- **Multi-format Document Ingestion**: PDF, DOCX, TXT, CSV, Excel support
- **Intelligent Requirements Analysis**: AI-powered extraction and categorization
- **Smart Question Generation**: Identifies gaps and generates clarification questions
- **Answer Extraction**: Semantic search through company documents
- **Response Compilation**: Professional proposal generation
- **PDF Report Generation**: Comprehensive analysis reports

### Production Features
- **Real-time Progress Updates**: WebSocket-based streaming
- **Error Handling & Retry Logic**: Robust failure recovery
- **Caching System**: Optimized performance
- **RESTful API**: Complete API for integration
- **Security**: Helmet.js, CORS, input validation
- **Logging**: Comprehensive Winston logging
- **File Upload**: Secure multi-file upload with validation

## 🏗️ Architecture

### Agent-Based System
- **Document Ingestion Agent**: Processes and extracts content
- **Requirements Analysis Agent**: Identifies and categorizes requirements
- **Clarification Questions Agent**: Generates intelligent questions
- **Answer Extraction Agent**: Finds relevant answers in company docs
- **Response Compilation Agent**: Creates structured responses

### Technology Stack
- **Backend**: Node.js, Express.js
- **AI/ML**: AWS Bedrock (Claude Haiku 3)
- **Document Processing**: pdf-parse, mammoth, xlsx
- **PDF Generation**: Puppeteer
- **Real-time**: Socket.IO
- **Database**: SQLite with comprehensive schema
- **Caching**: Redis with in-memory fallback

## 📋 Prerequisites

- Node.js 18+ 
- AWS Account with Bedrock access
- AWS CLI configured
- EC2 Key Pair (for deployment)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd rfp-automation-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your AWS credentials and configuration
```

4. **Start development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### AWS EC2 Deployment

1. **Configure AWS CLI**
```bash
aws configure
```

2. **Create EC2 Key Pair** (if you don't have one)
```bash
aws ec2 create-key-pair --key-name rfp-automation-key --query 'KeyMaterial' --output text > ~/.ssh/rfp-automation-key.pem
chmod 400 ~/.ssh/rfp-automation-key.pem
```

3. **Deploy to AWS**
```bash
npm run deploy
```

This will:
- Create security group with proper rules
- Launch EC2 instance (t3.medium)
- Generate deployment scripts
- Provide connection details

4. **Complete setup on EC2**
```bash
# SSH into the instance
./ssh-connect.sh

# Run setup script
./setup-server.sh

# Upload your code
scp -i ~/.ssh/rfp-automation-key.pem -r . ec2-user@<PUBLIC_IP>:/opt/rfp-automation/

# Install and start
cd /opt/rfp-automation
npm install
cp .env.sample .env
# Edit .env with your values
nano .env

pm2 start src/server.js --name rfp-automation
pm2 save
pm2 startup
```

## 🔧 Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DATABASE_URL=./data/rfp_system.db

# Redis Configuration (set to 'disabled' for in-memory cache)
REDIS_URL=redis://localhost:6379

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_DIR=./uploads

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://your-domain.com
```

### Database & Caching

The system uses **SQLite** as the primary database with a comprehensive schema for:
- Workflow tracking and state management
- Document metadata and processing results
- Requirements, questions, and answers storage
- Audit logging and performance metrics

**Redis** is used for caching and can be configured as:
- **Enabled**: Set `REDIS_URL=redis://localhost:6379` for production caching
- **Disabled**: Set `REDIS_URL=disabled` to use in-memory cache fallback

The system automatically falls back to in-memory caching if Redis is unavailable.

### AWS Bedrock Setup

1. **Enable Claude Haiku in Bedrock Console**
   - Go to AWS Bedrock Console
   - Navigate to Model Access
   - Request access to Claude Haiku 3

2. **IAM Permissions**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
        }
    ]
}
```

## 📖 API Documentation

### Upload and Process RFP

```bash
POST /api/process-rfp
Content-Type: multipart/form-data

# Form data:
# - documents: RFP files (PDF, DOCX, etc.)
# - projectContext: JSON with project details
# - companyDocuments: JSON array of company document references
```

### Get Workflow Status

```bash
GET /api/rfp/workflow/{workflowId}
```

### Generate PDF Report

```bash
POST /api/generate-pdf/{workflowId}
```

### WebSocket Events

```javascript
// Connect to workflow updates
socket.emit('join-workflow', workflowId);

// Listen for progress
socket.on('workflow-progress', (progress) => {
  console.log(`Step: ${progress.step}, Progress: ${progress.progress}%`);
});

// Listen for completion
socket.on('workflow-complete', (result) => {
  console.log('Workflow completed:', result);
});
```

## 🧪 Testing & Validation

### Sample RFP Processing

1. **Prepare test documents**
   - Sample RFP document (PDF/DOCX)
   - Company profile documents
   - Technical specifications

2. **Test the workflow**
```bash
curl -X POST http://localhost:3000/api/process-rfp \
  -F "documents=@sample-rfp.pdf" \
  -F "projectContext={\"title\":\"Test RFP\",\"client\":\"Test Client\"}"
```

3. **Monitor progress**
   - Check WebSocket events
   - Review generated logs
   - Validate PDF output

### Validation Steps

1. **Document Processing**: Verify text extraction accuracy
2. **Requirements Analysis**: Check requirement categorization
3. **Question Generation**: Review question relevance and priority
4. **Answer Extraction**: Validate answer confidence scores
5. **PDF Generation**: Ensure professional formatting

## 📊 Monitoring & Maintenance

### Logs
```bash
# View application logs
pm2 logs rfp-automation

# Check system logs
tail -f /var/log/messages
```

### Performance Monitoring
```bash
# Monitor PM2 processes
pm2 monit

# Check system resources
htop
df -h
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Workflow statistics
curl http://localhost:3000/api/workflow/statistics
```

## 🔒 Security Considerations

1. **Input Validation**: All uploads validated for type and size
2. **CORS Configuration**: Restricted to allowed origins
3. **Rate Limiting**: Implement rate limiting for production
4. **File Sanitization**: Uploaded files are processed securely
5. **AWS Credentials**: Use IAM roles instead of access keys
6. **HTTPS**: Enable SSL/TLS in production

## 🚀 Production Deployment

### Scaling Recommendations

1. **Load Balancer**: Use Application Load Balancer
2. **Auto Scaling**: Configure Auto Scaling Group
3. **Database**: Migrate to RDS for production
4. **File Storage**: Use S3 for document storage
5. **Caching**: Implement Redis for better performance
6. **CDN**: Use CloudFront for static assets

### Performance Optimization

1. **Caching**: Enable Redis caching
2. **Connection Pooling**: Configure database connections
3. **File Compression**: Compress uploaded files
4. **Background Processing**: Use job queues for long tasks

## 🐛 Troubleshooting

### Common Issues

1. **AWS Bedrock Access Denied**
   - Verify IAM permissions
   - Check model availability in region
   - Ensure Bedrock service is enabled

2. **File Upload Failures**
   - Check file size limits
   - Verify supported formats
   - Ensure sufficient disk space

3. **PDF Generation Issues**
   - Install required system fonts
   - Check Puppeteer dependencies
   - Verify memory availability

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Verify file permissions
ls -la uploads/

# Check application status
pm2 status
pm2 logs rfp-automation --lines 50
```

## 📚 Additional Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude API Reference](https://docs.anthropic.com/claude/reference)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./docs/API.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section
2. Review the logs
3. Open an issue on GitHub
4. Contact the development team

---

**Built with ❤️ for efficient RFP processing**