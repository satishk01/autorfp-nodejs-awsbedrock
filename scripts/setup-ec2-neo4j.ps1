# EC2 Neo4j Setup Script for Windows
# This script helps you launch an EC2 instance and install Neo4j

Write-Host "=== EC2 Neo4j Setup for RFP GraphRAG ===" -ForegroundColor Green
Write-Host ""

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version 2>$null
    Write-Host "✅ AWS CLI found: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    Write-Host "   Or use: winget install Amazon.AWSCLI" -ForegroundColor Yellow
    $installAWS = Read-Host "Would you like to continue without AWS CLI? (y/n)"
    if ($installAWS -notin @('y', 'Y', 'yes', 'Yes')) {
        exit 1
    }
}

# Get user's public IP for security group
Write-Host "🌐 Getting your public IP address..." -ForegroundColor Yellow
try {
    $publicIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
    Write-Host "✅ Your public IP: $publicIP" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not detect public IP. You'll need to configure security group manually." -ForegroundColor Yellow
    $publicIP = Read-Host "Enter your public IP address (or press Enter to skip)"
    if ([string]::IsNullOrEmpty($publicIP)) {
        $publicIP = "0.0.0.0/0"
        Write-Host "⚠️  Using 0.0.0.0/0 (open to all) - SECURITY RISK!" -ForegroundColor Red
    }
}

# Configuration
$region = Read-Host "Enter AWS region (default: us-east-1)"
if ([string]::IsNullOrEmpty($region)) { $region = "us-east-1" }

$keyPairName = Read-Host "Enter your EC2 Key Pair name (must exist in AWS)"
if ([string]::IsNullOrEmpty($keyPairName)) {
    Write-Host "❌ Key Pair name is required!" -ForegroundColor Red
    exit 1
}

$instanceType = Read-Host "Enter instance type (default: t3.medium)"
if ([string]::IsNullOrEmpty($instanceType)) { $instanceType = "t3.medium" }

Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   Region: $region" -ForegroundColor White
Write-Host "   Instance Type: $instanceType" -ForegroundColor White
Write-Host "   Key Pair: $keyPairName" -ForegroundColor White
Write-Host "   Your IP: $publicIP" -ForegroundColor White

$confirm = Read-Host "Continue with EC2 launch? (y/n)"
if ($confirm -notin @('y', 'Y', 'yes', 'Yes')) {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit 0
}

# Create security group
Write-Host ""
Write-Host "🔒 Creating security group..." -ForegroundColor Yellow

$sgName = "neo4j-rfp-sg-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$sgDescription = "Security group for Neo4j RFP GraphRAG"

try {
    $sgResult = aws ec2 create-security-group --group-name $sgName --description $sgDescription --region $region 2>$null | ConvertFrom-Json
    $securityGroupId = $sgResult.GroupId
    Write-Host "✅ Security group created: $securityGroupId" -ForegroundColor Green
    
    # Add inbound rules
    Write-Host "🔧 Adding security group rules..." -ForegroundColor Yellow
    
    # SSH access
    aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 22 --cidr "$publicIP/32" --region $region 2>$null
    
    # Neo4j HTTP
    aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 7474 --cidr "$publicIP/32" --region $region 2>$null
    
    # Neo4j Bolt
    aws ec2 authorize-security-group-ingress --group-id $securityGroupId --protocol tcp --port 7687 --cidr "$publicIP/32" --region $region 2>$null
    
    Write-Host "✅ Security group rules added" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to create security group. You may need to create it manually." -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $securityGroupId = Read-Host "Enter existing security group ID (or press Enter to skip)"
}

# Get latest Ubuntu AMI ID
Write-Host "🔍 Finding latest Ubuntu 22.04 AMI..." -ForegroundColor Yellow
try {
    $amiResult = aws ec2 describe-images --owners 099720109477 --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" --query 'Images[*].[ImageId,CreationDate]' --output text --region $region 2>$null
    $latestAmi = ($amiResult -split "`n" | Sort-Object { [DateTime]($_ -split "`t")[1] } -Descending)[0] -split "`t"
    $amiId = $latestAmi[0]
    Write-Host "✅ Latest Ubuntu AMI: $amiId" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not find Ubuntu AMI automatically. Using default." -ForegroundColor Yellow
    $amiId = "ami-0c02fb55956c7d316"  # Default Ubuntu 22.04 in us-east-1
}

# Launch EC2 instance
Write-Host ""
Write-Host "🚀 Launching EC2 instance..." -ForegroundColor Yellow

$userData = @"
#!/bin/bash
cd /home/ubuntu
curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh
chmod +x install-neo4j-ec2.sh
# Note: User will need to run this manually after connecting
"@

$userDataEncoded = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($userData))

try {
    $launchParams = @(
        "ec2", "run-instances"
        "--image-id", $amiId
        "--count", "1"
        "--instance-type", $instanceType
        "--key-name", $keyPairName
        "--security-group-ids", $securityGroupId
        "--user-data", $userDataEncoded
        "--tag-specifications", "ResourceType=instance,Tags=[{Key=Name,Value=Neo4j-RFP-GraphRAG},{Key=Purpose,Value=RFP-Automation}]"
        "--region", $region
    )
    
    $instanceResult = & aws @launchParams 2>$null | ConvertFrom-Json
    $instanceId = $instanceResult.Instances[0].InstanceId
    Write-Host "✅ Instance launched: $instanceId" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to launch instance: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to launch the instance manually from AWS Console." -ForegroundColor Yellow
    exit 1
}

# Wait for instance to be running
Write-Host "⏳ Waiting for instance to be running..." -ForegroundColor Yellow
$maxWait = 300  # 5 minutes
$waited = 0

do {
    Start-Sleep -Seconds 10
    $waited += 10
    
    try {
        $instanceState = aws ec2 describe-instances --instance-ids $instanceId --query 'Reservations[0].Instances[0].State.Name' --output text --region $region 2>$null
        Write-Host "   Instance state: $instanceState" -ForegroundColor Cyan
        
        if ($instanceState -eq "running") {
            break
        }
    } catch {
        Write-Host "   Checking instance state..." -ForegroundColor Cyan
    }
    
    if ($waited -ge $maxWait) {
        Write-Host "⚠️  Instance taking longer than expected to start." -ForegroundColor Yellow
        break
    }
} while ($true)

# Get instance details
Write-Host "📊 Getting instance details..." -ForegroundColor Yellow
try {
    $instanceDetails = aws ec2 describe-instances --instance-ids $instanceId --region $region 2>$null | ConvertFrom-Json
    $instance = $instanceDetails.Reservations[0].Instances[0]
    $publicIP = $instance.PublicIpAddress
    $privateIP = $instance.PrivateIpAddress
    
    Write-Host "✅ Instance Details:" -ForegroundColor Green
    Write-Host "   Instance ID: $instanceId" -ForegroundColor White
    Write-Host "   Public IP: $publicIP" -ForegroundColor White
    Write-Host "   Private IP: $privateIP" -ForegroundColor White
    Write-Host "   State: $($instance.State.Name)" -ForegroundColor White
    
} catch {
    Write-Host "⚠️  Could not get instance details. Check AWS Console." -ForegroundColor Yellow
    $publicIP = "YOUR_EC2_PUBLIC_IP"
}

# Create connection instructions
Write-Host ""
Write-Host "=== Connection Instructions ===" -ForegroundColor Green

# SSH connection
Write-Host ""
Write-Host "1. Connect to your EC2 instance:" -ForegroundColor Cyan
Write-Host "   ssh -i `"$keyPairName.pem`" ubuntu@$publicIP" -ForegroundColor White

# Installation instructions
Write-Host ""
Write-Host "2. Install Neo4j on the instance:" -ForegroundColor Cyan
Write-Host "   curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh" -ForegroundColor White
Write-Host "   chmod +x install-neo4j-ec2.sh" -ForegroundColor White
Write-Host "   ./install-neo4j-ec2.sh" -ForegroundColor White

# Alternative manual installation
Write-Host ""
Write-Host "   Or copy the installation script manually and run it." -ForegroundColor Yellow

# Local configuration
Write-Host ""
Write-Host "3. Update your local .env file:" -ForegroundColor Cyan
Write-Host "   NEO4J_ENABLED=true" -ForegroundColor White
Write-Host "   NEO4J_URI=bolt://$publicIP:7687" -ForegroundColor White
Write-Host "   NEO4J_USERNAME=neo4j" -ForegroundColor White
Write-Host "   NEO4J_PASSWORD=rfpgraph123" -ForegroundColor White
Write-Host "   NEO4J_DATABASE=neo4j" -ForegroundColor White

# Save configuration to file
$configContent = @"
# EC2 Neo4j Configuration
# Generated on $(Get-Date)

Instance ID: $instanceId
Public IP: $publicIP
Private IP: $privateIP
Region: $region
Security Group: $securityGroupId

# SSH Connection:
ssh -i "$keyPairName.pem" ubuntu@$publicIP

# Local .env Configuration:
NEO4J_ENABLED=true
NEO4J_URI=bolt://$publicIP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j

# Neo4j Web Interface (after installation):
http://$publicIP:7474

# Installation Command (run on EC2):
curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh
chmod +x install-neo4j-ec2.sh
./install-neo4j-ec2.sh
"@

$configFile = "neo4j-ec2-config.txt"
$configContent | Out-File -FilePath $configFile -Encoding UTF8
Write-Host ""
Write-Host "📝 Configuration saved to: $configFile" -ForegroundColor Green

# Create installation script locally
$installScript = @"
#!/bin/bash

# Neo4j EC2 Installation Script
# This is a local copy - upload to your EC2 instance

# [Content of install-neo4j-ec2.sh would go here]
# For brevity, this references the online version
curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh
chmod +x install-neo4j-ec2.sh
./install-neo4j-ec2.sh
"@

$installScript | Out-File -FilePath "install-neo4j-ec2-local.sh" -Encoding UTF8

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Connect to EC2 instance via SSH" -ForegroundColor White
Write-Host "2. Run the Neo4j installation script" -ForegroundColor White
Write-Host "3. Update your local .env file with the configuration above" -ForegroundColor White
Write-Host "4. Test connection from your RFP application" -ForegroundColor White

Write-Host ""
Write-Host "=== Cost Information ===" -ForegroundColor Yellow
Write-Host "Instance Type: $instanceType" -ForegroundColor White
Write-Host "Estimated Cost: ~$30-40/month (t3.medium)" -ForegroundColor White
Write-Host "Remember to stop/terminate the instance when not in use!" -ForegroundColor Red

Write-Host ""
Write-Host "=== Management Commands ===" -ForegroundColor Cyan
Write-Host "Stop instance:  aws ec2 stop-instances --instance-ids $instanceId --region $region" -ForegroundColor White
Write-Host "Start instance: aws ec2 start-instances --instance-ids $instanceId --region $region" -ForegroundColor White
Write-Host "Terminate:      aws ec2 terminate-instances --instance-ids $instanceId --region $region" -ForegroundColor White

$openBrowser = Read-Host "Would you like to open AWS Console to view your instance? (y/n)"
if ($openBrowser -in @('y', 'Y', 'yes', 'Yes')) {
    $consoleUrl = "https://console.aws.amazon.com/ec2/v2/home?region=$region#Instances:instanceId=$instanceId"
    Start-Process $consoleUrl
}

Write-Host ""
Write-Host "🎉 EC2 setup complete! Check $configFile for all details." -ForegroundColor Green

Read-Host "Press Enter to exit"