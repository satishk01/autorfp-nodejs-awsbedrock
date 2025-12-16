import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class AWSDeployment {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.instanceType = process.env.EC2_INSTANCE_TYPE || 't3.medium';
    this.keyPairName = process.env.EC2_KEY_PAIR || 'rfp-automation-key';
    this.securityGroupName = 'rfp-automation-sg';
    this.instanceName = 'rfp-automation-server';
  }

  async deploy() {
    try {
      console.log('🚀 Starting AWS EC2 deployment...');
      
      // Step 1: Create security group
      await this.createSecurityGroup();
      
      // Step 2: Launch EC2 instance
      const instanceId = await this.launchInstance();
      
      // Step 3: Wait for instance to be running
      await this.waitForInstance(instanceId);
      
      // Step 4: Get instance public IP
      const publicIp = await this.getInstancePublicIp(instanceId);
      
      // Step 5: Generate deployment script
      await this.generateDeploymentScript(publicIp);
      
      console.log('✅ Deployment completed successfully!');
      console.log(`📍 Instance ID: ${instanceId}`);
      console.log(`🌐 Public IP: ${publicIp}`);
      console.log(`🔗 Application URL: http://${publicIp}:3000`);
      console.log('\n📋 Next steps:');
      console.log('1. SSH into the instance using the generated script');
      console.log('2. Run the setup commands');
      console.log('3. Configure your environment variables');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  async createSecurityGroup() {
    console.log('🔒 Creating security group...');
    
    try {
      // Check if security group exists
      execSync(`aws ec2 describe-security-groups --group-names ${this.securityGroupName} --region ${this.region}`, 
        { stdio: 'ignore' });
      console.log('✅ Security group already exists');
    } catch {
      // Create security group
      const sgResult = execSync(`aws ec2 create-security-group \
        --group-name ${this.securityGroupName} \
        --description "Security group for RFP Automation System" \
        --region ${this.region}`, { encoding: 'utf8' });
      
      const sgData = JSON.parse(sgResult);
      const groupId = sgData.GroupId;
      
      // Add inbound rules
      execSync(`aws ec2 authorize-security-group-ingress \
        --group-id ${groupId} \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region ${this.region}`);
      
      execSync(`aws ec2 authorize-security-group-ingress \
        --group-id ${groupId} \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 \
        --region ${this.region}`);
      
      execSync(`aws ec2 authorize-security-group-ingress \
        --group-id ${groupId} \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region ${this.region}`);
      
      execSync(`aws ec2 authorize-security-group-ingress \
        --group-id ${groupId} \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region ${this.region}`);
      
      console.log('✅ Security group created with rules');
    }
  }

  async launchInstance() {
    console.log('🖥️ Launching EC2 instance...');
    
    // Get latest Amazon Linux 2 AMI
    const amiResult = execSync(`aws ec2 describe-images \
      --owners amazon \
      --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
      --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" \
      --output text \
      --region ${this.region}`, { encoding: 'utf8' });
    
    const amiId = amiResult.trim();
    console.log(`📀 Using AMI: ${amiId}`);
    
    // Launch instance
    const instanceResult = execSync(`aws ec2 run-instances \
      --image-id ${amiId} \
      --count 1 \
      --instance-type ${this.instanceType} \
      --key-name ${this.keyPairName} \
      --security-groups ${this.securityGroupName} \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${this.instanceName}}]" \
      --region ${this.region}`, { encoding: 'utf8' });
    
    const instanceData = JSON.parse(instanceResult);
    const instanceId = instanceData.Instances[0].InstanceId;
    
    console.log(`✅ Instance launched: ${instanceId}`);
    return instanceId;
  }

  async waitForInstance(instanceId) {
    console.log('⏳ Waiting for instance to be running...');
    
    execSync(`aws ec2 wait instance-running --instance-ids ${instanceId} --region ${this.region}`);
    
    console.log('✅ Instance is running');
  }

  async getInstancePublicIp(instanceId) {
    console.log('🌐 Getting instance public IP...');
    
    const ipResult = execSync(`aws ec2 describe-instances \
      --instance-ids ${instanceId} \
      --query "Reservations[0].Instances[0].PublicIpAddress" \
      --output text \
      --region ${this.region}`, { encoding: 'utf8' });
    
    const publicIp = ipResult.trim();
    console.log(`✅ Public IP: ${publicIp}`);
    
    return publicIp;
  }

  async generateDeploymentScript(publicIp) {
    console.log('📝 Generating deployment scripts...');
    
    const sshScript = `#!/bin/bash
# SSH into the RFP Automation Server
ssh -i ~/.ssh/${this.keyPairName}.pem ec2-user@${publicIp}
`;

    const setupScript = `#!/bin/bash
# RFP Automation System Setup Script for Amazon Linux 2

echo "🚀 Setting up RFP Automation System..."

# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install PM2 for process management
sudo npm install -g pm2

# Install Python and pip (for document processing)
sudo yum install -y python3 python3-pip

# Install Redis (optional - can be disabled)
sudo amazon-linux-extras install redis4.0 -y
sudo systemctl enable redis
sudo systemctl start redis

# Install system dependencies for Puppeteer
sudo yum install -y \
    alsa-lib.x86_64 \
    atk.x86_64 \
    cups-libs.x86_64 \
    gtk3.x86_64 \
    ipa-gothic-fonts \
    libXcomposite.x86_64 \
    libXcursor.x86_64 \
    libXdamage.x86_64 \
    libXext.x86_64 \
    libXi.x86_64 \
    libXrandr.x86_64 \
    libXScrnSaver.x86_64 \
    libXtst.x86_64 \
    pango.x86_64 \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-misc \
    xorg-x11-fonts-Type1 \
    xorg-x11-utils

# Create application directory
sudo mkdir -p /opt/rfp-automation
sudo chown ec2-user:ec2-user /opt/rfp-automation
cd /opt/rfp-automation

# Clone the repository (you'll need to replace with your actual repo)
# git clone https://github.com/your-username/rfp-automation-system.git .

echo "📁 Please upload your application files to /opt/rfp-automation"
echo "📋 Next steps:"
echo "1. Upload your application files"
echo "2. Run: npm install"
echo "3. Create .env file with your configuration"
echo "4. Run: npm run build (if you have a client)"
echo "5. Start with: pm2 start src/server.js --name rfp-automation"
echo "6. Save PM2 config: pm2 save && pm2 startup"

# Create sample .env file
cat > .env.sample << 'EOF'
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

# Redis (optional - for caching, set to 'disabled' to use in-memory cache)
REDIS_URL=redis://localhost:6379

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_DIR=./uploads

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://${publicIp}:3000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF

echo "✅ Setup script completed!"
echo "🔧 Configure your .env file based on .env.sample"
`;

    const deploymentGuide = `# RFP Automation System - AWS Deployment Guide

## Instance Information
- **Instance Type**: ${this.instanceType}
- **Region**: ${this.region}
- **Public IP**: ${publicIp}
- **Security Group**: ${this.securityGroupName}

## Quick Start

### 1. SSH into the instance
\`\`\`bash
chmod +x ssh-connect.sh
./ssh-connect.sh
\`\`\`

### 2. Run the setup script
\`\`\`bash
chmod +x setup-server.sh
./setup-server.sh
\`\`\`

### 3. Upload your application
\`\`\`bash
# From your local machine
scp -i ~/.ssh/${this.keyPairName}.pem -r . ec2-user@${publicIp}:/opt/rfp-automation/
\`\`\`

### 4. Install dependencies and start
\`\`\`bash
cd /opt/rfp-automation
npm install
cp .env.sample .env
# Edit .env with your actual values
nano .env

# Start the application
pm2 start src/server.js --name rfp-automation
pm2 save
pm2 startup
\`\`\`

## Configuration

### Environment Variables
Update the \`.env\` file with your actual values:

- **AWS_ACCESS_KEY_ID**: Your AWS access key
- **AWS_SECRET_ACCESS_KEY**: Your AWS secret key
- **BEDROCK_MODEL_ID**: Claude Haiku model ID
- **JWT_SECRET**: Generate a secure secret

### AWS Bedrock Setup
1. Enable Claude Haiku model in AWS Bedrock console
2. Ensure your AWS credentials have Bedrock permissions
3. Test the connection

## Monitoring

### View logs
\`\`\`bash
pm2 logs rfp-automation
\`\`\`

### Monitor performance
\`\`\`bash
pm2 monit
\`\`\`

### Restart application
\`\`\`bash
pm2 restart rfp-automation
\`\`\`

## Security Considerations

1. **Update security group**: Restrict SSH access to your IP
2. **SSL/TLS**: Set up HTTPS with Let's Encrypt
3. **Firewall**: Configure additional firewall rules
4. **Backup**: Set up automated backups
5. **Monitoring**: Set up CloudWatch monitoring

## Troubleshooting

### Common Issues

1. **Port 3000 not accessible**
   - Check security group rules
   - Verify application is running: \`pm2 status\`

2. **AWS Bedrock errors**
   - Verify AWS credentials
   - Check Bedrock model availability in your region
   - Ensure proper IAM permissions

3. **File upload issues**
   - Check disk space: \`df -h\`
   - Verify upload directory permissions

### Useful Commands

\`\`\`bash
# Check system resources
htop
df -h
free -h

# Check application status
pm2 status
pm2 logs rfp-automation --lines 100

# Restart services
sudo systemctl restart nginx  # if using nginx
pm2 restart rfp-automation
\`\`\`

## Scaling Considerations

For production use, consider:

1. **Load Balancer**: Use Application Load Balancer
2. **Auto Scaling**: Set up Auto Scaling Group
3. **Database**: Use RDS instead of SQLite
4. **File Storage**: Use S3 for file uploads
5. **Caching**: Set up ElastiCache Redis
6. **CDN**: Use CloudFront for static assets

## Support

For issues and questions:
1. Check the logs: \`pm2 logs rfp-automation\`
2. Review the troubleshooting section
3. Check AWS CloudWatch for system metrics
`;

    // Write files
    await fs.writeFile('ssh-connect.sh', sshScript);
    await fs.writeFile('setup-server.sh', setupScript);
    await fs.writeFile('DEPLOYMENT.md', deploymentGuide);
    
    // Make scripts executable
    execSync('chmod +x ssh-connect.sh setup-server.sh');
    
    console.log('✅ Deployment scripts generated:');
    console.log('  - ssh-connect.sh: SSH connection script');
    console.log('  - setup-server.sh: Server setup script');
    console.log('  - DEPLOYMENT.md: Detailed deployment guide');
  }
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployment = new AWSDeployment();
  deployment.deploy();
}

export default AWSDeployment;