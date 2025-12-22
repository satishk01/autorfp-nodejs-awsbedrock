# Neo4j EC2 Installation Guide

## Overview
This guide helps you install Neo4j on an AWS EC2 instance and connect to it from your local Windows laptop for the RFP Automation System's GraphRAG features.

## Benefits of EC2 Installation
- No local resource usage
- Better performance for large datasets
- Persistent storage independent of local machine
- Can be accessed from multiple locations
- Easy to scale resources as needed

## Prerequisites
- AWS Account with EC2 access
- AWS CLI configured (optional but recommended)
- SSH client (PuTTY or Windows built-in SSH)

## Step 1: Launch EC2 Instance

### Instance Specifications
- **Instance Type**: t3.medium (2 vCPU, 4GB RAM) - minimum for Neo4j
- **AMI**: Ubuntu 22.04 LTS (free tier eligible)
- **Storage**: 20GB GP3 (adjust based on your data needs)
- **Security Group**: Custom (see security configuration below)

### Security Group Configuration
Create a security group with these inbound rules:

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|---------|-------------|
| SSH | TCP | 22 | Your IP | SSH access |
| HTTP | TCP | 7474 | Your IP | Neo4j Browser |
| Custom TCP | TCP | 7687 | Your IP | Neo4j Bolt |
| HTTPS | TCP | 7473 | Your IP | Neo4j HTTPS (optional) |

**Important**: Replace "Your IP" with your actual public IP address for security.

## Step 2: Connect to EC2 Instance

### Using Windows SSH (Windows 10/11)
```powershell
# Replace with your instance details
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip
```

### Using PuTTY
1. Convert .pem key to .ppk using PuTTYgen
2. Connect using PuTTY with the .ppk key

## Step 3: Install Neo4j on EC2

### Automated Installation Script
Save this as `install-neo4j-ec2.sh` and run on your EC2 instance:

```bash
#!/bin/bash

# Neo4j EC2 Installation Script
# Run this on your Ubuntu EC2 instance

set -e

echo "=== Neo4j EC2 Installation for RFP GraphRAG ==="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Java 17 (required for Neo4j)
echo "☕ Installing Java 17..."
sudo apt install -y openjdk-17-jdk

# Verify Java installation
java -version
echo "✅ Java installed successfully"

# Add Neo4j repository
echo "📋 Adding Neo4j repository..."
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list

# Update package list
sudo apt update

# Install Neo4j Community Edition
echo "🚀 Installing Neo4j Community Edition..."
sudo apt install -y neo4j

# Configure Neo4j
echo "⚙️ Configuring Neo4j..."

# Backup original config
sudo cp /etc/neo4j/neo4j.conf /etc/neo4j/neo4j.conf.backup

# Create new configuration
sudo tee /etc/neo4j/neo4j.conf > /dev/null <<EOF
# Basic settings
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474
server.https.listen_address=:7473

# Security settings
dbms.security.auth_enabled=true
server.bolt.tls_level=DISABLED

# Memory settings (adjust based on instance size)
server.memory.heap.initial_size=1G
server.memory.heap.max_size=2G
server.memory.pagecache.size=1G

# Database location
server.directories.data=/var/lib/neo4j/data
server.directories.logs=/var/lib/neo4j/logs

# Allow remote connections
dbms.connectors.default_listen_address=0.0.0.0
dbms.connector.bolt.enabled=true
dbms.connector.http.enabled=true

# Logging
dbms.logs.http.enabled=true
dbms.logs.http.rotation.keep_number=5
dbms.logs.http.rotation.size=20M
EOF

# Set initial password
echo "🔐 Setting initial password..."
sudo neo4j-admin dbms set-initial-password rfpgraph123

# Enable and start Neo4j service
echo "🎯 Starting Neo4j service..."
sudo systemctl enable neo4j
sudo systemctl start neo4j

# Wait for service to start
echo "⏳ Waiting for Neo4j to start..."
sleep 10

# Check service status
sudo systemctl status neo4j --no-pager

# Test connection
echo "🧪 Testing Neo4j connection..."
sleep 5

if curl -f http://localhost:7474 > /dev/null 2>&1; then
    echo "✅ Neo4j is running successfully!"
    echo "🌐 Web interface: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):7474"
    echo "🔌 Bolt connection: bolt://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):7687"
    echo "👤 Username: neo4j"
    echo "🔑 Password: rfpgraph123"
else
    echo "❌ Neo4j failed to start properly"
    echo "Check logs: sudo journalctl -u neo4j -f"
fi

echo ""
echo "=== Installation Complete! ==="
echo "Next steps:"
echo "1. Test web interface from your browser"
echo "2. Update your local .env file with the EC2 connection details"
echo "3. Test connection from your RFP application"
EOF
```

## Step 4: Run Installation

### Copy and Execute Script
```bash
# On your EC2 instance
curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh
chmod +x install-neo4j-ec2.sh
./install-neo4j-ec2.sh
```

### Manual Installation (Alternative)
If you prefer manual installation:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Java 17
sudo apt install -y openjdk-17-jdk

# Add Neo4j repository
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt update

# Install Neo4j
sudo apt install -y neo4j

# Set password
sudo neo4j-admin dbms set-initial-password rfpgraph123

# Configure for remote access
sudo sed -i 's/#server.default_listen_address=0.0.0.0/server.default_listen_address=0.0.0.0/' /etc/neo4j/neo4j.conf
sudo sed -i 's/#server.bolt.listen_address=:7687/server.bolt.listen_address=:7687/' /etc/neo4j/neo4j.conf
sudo sed -i 's/#server.http.listen_address=:7474/server.http.listen_address=:7474/' /etc/neo4j/neo4j.conf

# Start Neo4j
sudo systemctl enable neo4j
sudo systemctl start neo4j
```

## Step 5: Configure Local Connection

### Update .env File
Update your local `.env` file with your EC2 instance details:

```env
# Neo4j Configuration (EC2 Instance)
NEO4J_ENABLED=true
NEO4J_URI=bolt://YOUR_EC2_PUBLIC_IP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
```

Replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 instance public IP.

## Step 6: Test Connection

### From Web Browser
1. Open browser and go to: `http://YOUR_EC2_PUBLIC_IP:7474`
2. Login with username `neo4j` and password `rfpgraph123`
3. Run test query: `RETURN "Hello from EC2!" as message`

### From Local Application
Use the connection test script provided in the main installation guide.

## Management Scripts

### Start/Stop Neo4j Service
```bash
# Start Neo4j
sudo systemctl start neo4j

# Stop Neo4j
sudo systemctl stop neo4j

# Restart Neo4j
sudo systemctl restart neo4j

# Check status
sudo systemctl status neo4j

# View logs
sudo journalctl -u neo4j -f
```

### Backup Script
```bash
#!/bin/bash
# Save as backup-neo4j.sh

BACKUP_DIR="/home/ubuntu/neo4j-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

sudo neo4j-admin database dump --to-path=$BACKUP_DIR neo4j
sudo chown ubuntu:ubuntu $BACKUP_DIR/neo4j.dump

echo "Backup completed: $BACKUP_DIR/neo4j.dump"
echo "Backup size: $(du -h $BACKUP_DIR/neo4j.dump | cut -f1)"
```

### Monitoring Script
```bash
#!/bin/bash
# Save as monitor-neo4j.sh

echo "=== Neo4j Status ==="
sudo systemctl status neo4j --no-pager

echo ""
echo "=== Memory Usage ==="
free -h

echo ""
echo "=== Disk Usage ==="
df -h /var/lib/neo4j

echo ""
echo "=== Neo4j Connections ==="
netstat -tlnp | grep :7474
netstat -tlnp | grep :7687

echo ""
echo "=== Recent Logs ==="
sudo journalctl -u neo4j --since "1 hour ago" --no-pager | tail -10
```

## Security Considerations

### Firewall Configuration
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22

# Allow Neo4j ports from your IP only
sudo ufw allow from YOUR_LOCAL_IP to any port 7474
sudo ufw allow from YOUR_LOCAL_IP to any port 7687

# Check firewall status
sudo ufw status
```

### SSL/TLS Configuration (Optional)
For production use, consider enabling HTTPS:

```bash
# Generate self-signed certificate
sudo openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -keyout /var/lib/neo4j/certificates/neo4j.key \
    -out /var/lib/neo4j/certificates/neo4j.cert

# Update neo4j.conf
sudo tee -a /etc/neo4j/neo4j.conf > /dev/null <<EOF
# HTTPS Configuration
server.https.enabled=true
dbms.ssl.policy.https.enabled=true
dbms.ssl.policy.https.base_directory=/var/lib/neo4j/certificates
dbms.ssl.policy.https.private_key=neo4j.key
dbms.ssl.policy.https.public_certificate=neo4j.cert
EOF

sudo systemctl restart neo4j
```

## Cost Optimization

### Instance Sizing Guidelines
- **Development**: t3.small (2GB RAM) - $15-20/month
- **Testing**: t3.medium (4GB RAM) - $30-40/month  
- **Production**: t3.large (8GB RAM) - $60-80/month

### Storage Optimization
- Use GP3 storage for better price/performance
- Enable EBS snapshots for backups
- Monitor storage usage regularly

### Auto-shutdown Script
```bash
#!/bin/bash
# Save as auto-shutdown.sh
# Add to crontab to shutdown during off-hours

# Shutdown at 10 PM weekdays
0 22 * * 1-5 /sbin/shutdown -h now

# Startup can be automated using AWS Lambda or scheduled start
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
# Check if Neo4j is running
sudo systemctl status neo4j

# Check if ports are open
sudo netstat -tlnp | grep neo4j

# Check firewall
sudo ufw status
```

#### 2. Memory Issues
```bash
# Check memory usage
free -h

# Adjust Neo4j memory settings in /etc/neo4j/neo4j.conf
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m
```

#### 3. Permission Issues
```bash
# Fix Neo4j file permissions
sudo chown -R neo4j:neo4j /var/lib/neo4j
sudo chown -R neo4j:neo4j /var/log/neo4j
```

#### 4. Service Won't Start
```bash
# Check detailed logs
sudo journalctl -u neo4j -f

# Check configuration syntax
sudo neo4j-admin server console
```

## Maintenance

### Regular Tasks
1. **Weekly**: Check disk space and memory usage
2. **Monthly**: Create database backup
3. **Quarterly**: Update Neo4j version
4. **As needed**: Monitor logs for errors

### Update Neo4j
```bash
# Update to latest version
sudo apt update
sudo apt upgrade neo4j

# Restart service
sudo systemctl restart neo4j
```

## Benefits of EC2 Setup

### Advantages
- **Performance**: Dedicated resources for Neo4j
- **Scalability**: Easy to upgrade instance size
- **Persistence**: Data survives local machine issues
- **Accessibility**: Connect from anywhere
- **Cost-effective**: Pay only for what you use

### Considerations
- **Network latency**: Slight delay compared to local
- **Internet dependency**: Requires stable connection
- **AWS costs**: Monthly EC2 charges
- **Security**: Need proper firewall configuration

This setup provides a robust, scalable Neo4j installation that integrates seamlessly with your local RFP Automation System while keeping your laptop resources free.