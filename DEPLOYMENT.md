# RFP Automation System - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the RFP Automation System to AWS EC2 using AWS Bedrock with Claude Haiku 3.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Node.js 18+ installed locally
- EC2 Key Pair created

## Quick Deployment

### 1. Automated Deployment

```bash
# Clone the repository
git clone <repository-url>
cd rfp-automation-system

# Install dependencies
npm install

# Set environment variables
export AWS_REGION=us-east-1
export EC2_INSTANCE_TYPE=t3.medium
export EC2_KEY_PAIR=your-key-pair-name

# Run automated deployment
npm run deploy
```

This will:
- Create security group with proper rules
- Launch EC2 instance
- Generate connection scripts
- Provide setup instructions

### 2. Manual Setup on EC2

After deployment, connect to your instance:

```bash
# Make connection script executable
chmod +x ssh-connect.sh

# Connect to instance
./ssh-connect.sh
```

Run the setup script on the instance:

```bash
# Make setup script executable
chmod +x setup-server.sh

# Run setup
./setup-server.sh
```

### 3. Upload Application Code

From your local machine:

```bash
# Upload code to EC2 instance
scp -i ~/.ssh/your-key.pem -r . ec2-user@<PUBLIC_IP>:/opt/rfp-automation/
```

### 4. Configure and Start Application

On the EC2 instance:

```bash
cd /opt/rfp-automation

# Install dependencies
npm install

# Configure environment
cp .env.sample .env
nano .env  # Edit with your actual values

# Build client (if needed)
cd client && npm install && npm run build && cd ..

# Start with PM2
pm2 start src/server.js --name rfp-automation
pm2 save
pm2 startup
```

## Configuration

### Environment Variables

Edit `/opt/rfp-automation/.env`:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=./data/rfp_system.db

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_DIR=./uploads

# Security
JWT_SECRET=your_secure_jwt_secret_here
CORS_ORIGIN=http://your-domain.com

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### AWS Bedrock Setup

1. **Enable Claude Haiku Model**:
   - Go to AWS Bedrock Console
   - Navigate to "Model access"
   - Request access to "Claude 3 Haiku"
   - Wait for approval (usually instant)

2. **IAM Permissions**:
   Create an IAM policy with these permissions:

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
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
            ]
        }
    ]
}
```

3. **Test Bedrock Access**:
```bash
aws bedrock list-foundation-models --region us-east-1
```

## Validation Steps

### 1. System Health Check

```bash
# Check application status
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. Test File Upload

```bash
# Test document upload endpoint
curl -X POST http://localhost:3000/api/documents/formats/supported

# Expected response with supported formats
```

### 3. Test RFP Processing

1. **Prepare Test Documents**:
   - Create a sample RFP PDF
   - Prepare company profile documents

2. **Upload via Web Interface**:
   - Navigate to `http://your-ec2-ip:3000`
   - Use the upload interface
   - Monitor workflow progress

3. **Test API Directly**:
```bash
curl -X POST http://localhost:3000/api/process-rfp \
  -F "documents=@sample-rfp.pdf" \
  -F 'projectContext={"title":"Test RFP","client":"Test Client"}'
```

### 4. Validate PDF Generation

After workflow completion:

```bash
# Test PDF generation
curl -X POST http://localhost:3000/api/generate-pdf/WORKFLOW_ID \
  -H "Content-Type: application/json" \
  -d '{"projectContext":{"title":"Test Report"}}' \
  --output test-report.pdf
```

## Monitoring and Maintenance

### Application Monitoring

```bash
# View application logs
pm2 logs rfp-automation

# Monitor performance
pm2 monit

# Check system resources
htop
df -h
free -h
```

### Log Files

- Application logs: `/opt/rfp-automation/logs/app.log`
- PM2 logs: `~/.pm2/logs/`
- System logs: `/var/log/messages`

### Backup Strategy

1. **Database Backup**:
```bash
# Backup SQLite database
cp /opt/rfp-automation/data/rfp_system.db /backup/rfp_system_$(date +%Y%m%d).db
```

2. **File Uploads Backup**:
```bash
# Backup uploaded files
tar -czf /backup/uploads_$(date +%Y%m%d).tar.gz /opt/rfp-automation/uploads/
```

3. **Configuration Backup**:
```bash
# Backup configuration
cp /opt/rfp-automation/.env /backup/env_$(date +%Y%m%d).backup
```

## Troubleshooting

### Common Issues

1. **Port 3000 Not Accessible**:
   - Check security group rules
   - Verify application is running: `pm2 status`
   - Check firewall: `sudo iptables -L`

2. **AWS Bedrock Errors**:
   - Verify AWS credentials: `aws sts get-caller-identity`
   - Check model access in Bedrock console
   - Verify IAM permissions

3. **File Upload Issues**:
   - Check disk space: `df -h`
   - Verify upload directory permissions: `ls -la uploads/`
   - Check file size limits in configuration

4. **Memory Issues**:
   - Monitor memory usage: `free -h`
   - Consider upgrading instance type
   - Optimize PM2 configuration

### Debug Commands

```bash
# Check application status
pm2 status
pm2 logs rfp-automation --lines 100

# Test AWS connectivity
aws bedrock list-foundation-models --region us-east-1

# Check network connectivity
netstat -tlnp | grep 3000
curl -I http://localhost:3000/health

# Monitor system resources
top
iostat 1 5
```

## Security Considerations

### 1. Network Security

- Restrict SSH access to your IP only
- Use HTTPS in production (setup SSL/TLS)
- Configure proper firewall rules

### 2. Application Security

- Use strong JWT secrets
- Regularly update dependencies
- Implement rate limiting
- Validate all inputs

### 3. AWS Security

- Use IAM roles instead of access keys when possible
- Enable CloudTrail for API logging
- Set up CloudWatch monitoring
- Regular security audits

## Production Optimizations

### 1. Performance

- Use Application Load Balancer
- Set up Auto Scaling Group
- Implement Redis caching
- Use RDS instead of SQLite

### 2. Reliability

- Multi-AZ deployment
- Automated backups
- Health checks and monitoring
- Disaster recovery plan

### 3. Scalability

- Containerize with Docker
- Use ECS or EKS for orchestration
- Implement horizontal scaling
- Use S3 for file storage

## Cost Optimization

1. **Instance Right-Sizing**:
   - Monitor CPU/memory usage
   - Use appropriate instance types
   - Consider Spot instances for development

2. **Bedrock Usage**:
   - Monitor token usage
   - Implement caching for repeated queries
   - Use appropriate model for workload

3. **Storage Optimization**:
   - Regular cleanup of old files
   - Use S3 lifecycle policies
   - Compress uploaded documents

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Check application logs
   - Monitor system resources
   - Review security updates

2. **Monthly**:
   - Update dependencies
   - Backup configuration
   - Performance review

3. **Quarterly**:
   - Security audit
   - Cost optimization review
   - Disaster recovery testing

### Getting Help

1. Check application logs first
2. Review this deployment guide
3. Check AWS service status
4. Contact support team

---

**Deployment completed successfully!** 🎉

Your RFP Automation System should now be running at `http://your-ec2-ip:3000`