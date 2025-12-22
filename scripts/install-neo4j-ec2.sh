#!/bin/bash

# Neo4j EC2 Installation Script
# Run this on your Ubuntu EC2 instance

set -e

echo "=== Neo4j EC2 Installation for RFP GraphRAG ==="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "? Please don't run this script as root. Run as ubuntu user with sudo privileges."
    exit 1
fi

# Update system
echo "?? Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Java 17 (required for Neo4j)
echo "? Installing Java 17..."
sudo apt install -y openjdk-17-jdk curl wget gnupg

# Verify Java installation
echo "Java version:"
java -version
echo "? Java installed successfully"

# Add Neo4j repository
echo "?? Adding Neo4j repository..."
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list

# Update package list
sudo apt update

# Install Neo4j Community Edition
echo "?? Installing Neo4j Community Edition..."
sudo apt install -y neo4j

# Get EC2 instance details
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "?? Instance Details:"
echo "   Private IP: $PRIVATE_IP"
echo "   Public IP: $PUBLIC_IP"

# Configure Neo4j
echo "?? Configuring Neo4j for remote access..."

# Backup original config
sudo cp /etc/neo4j/neo4j.conf /etc/neo4j/neo4j.conf.backup

# Create new configuration
sudo tee /etc/neo4j/neo4j.conf > /dev/null <<EOF
# Basic settings - Allow connections from anywhere
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474
server.https.listen_address=:7473

# Security settings
dbms.security.auth_enabled=true
server.bolt.tls_level=DISABLED

# Memory settings (optimized for t3.medium)
server.memory.heap.initial_size=1G
server.memory.heap.max_size=2G
server.memory.pagecache.size=1G

# Database location
server.directories.data=/var/lib/neo4j/data
server.directories.logs=/var/lib/neo4j/logs
server.directories.plugins=/var/lib/neo4j/plugins
server.directories.import=/var/lib/neo4j/import

# Network connector configuration
dbms.connectors.default_listen_address=0.0.0.0
dbms.connector.bolt.enabled=true
dbms.connector.http.enabled=true
dbms.connector.https.enabled=false

# Logging
dbms.logs.http.enabled=true
dbms.logs.http.rotation.keep_number=5
dbms.logs.http.rotation.size=20M

# Performance tuning
dbms.tx_log.rotation.retention_policy=1G size
dbms.checkpoint.interval.time=15m

# Security - Allow connections from any IP (configure firewall for security)
dbms.security.allow_csv_import_from_file_urls=true
dbms.security.procedures.unrestricted=apoc.*

# JVM tuning
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:+UnlockExperimentalVMOptions
server.jvm.additional=-XX:+UseJVMCICompiler
EOF

# Set initial password
echo "?? Setting initial password..."
sudo neo4j-admin dbms set-initial-password rfpgraph123

# Set proper permissions
sudo chown -R neo4j:neo4j /var/lib/neo4j
sudo chown -R neo4j:neo4j /var/log/neo4j
sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf

# Configure firewall (UFW)
echo "?? Configuring firewall..."
sudo ufw --force enable

# Allow SSH
sudo ufw allow 22

# Allow Neo4j ports (you should restrict these to your IP later)
sudo ufw allow 7474 comment 'Neo4j HTTP'
sudo ufw allow 7687 comment 'Neo4j Bolt'

# Show firewall status
sudo ufw status

# Enable and start Neo4j service
echo "?? Starting Neo4j service..."
sudo systemctl enable neo4j
sudo systemctl start neo4j

# Wait for service to start
echo "? Waiting for Neo4j to start..."
sleep 15

# Check service status
echo "?? Service Status:"
sudo systemctl status neo4j --no-pager -l

#### After failure with previous step run the below set of commands
# Quick fix - copy and paste this entire block
sudo systemctl stop neo4j

sudo tee /etc/neo4j/neo4j.conf > /dev/null <<'EOF'
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474
dbms.security.auth_enabled=true
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m
dbms.connector.bolt.enabled=true
dbms.connector.http.enabled=true
EOF

sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf
sudo systemctl start neo4j
sleep 10
sudo systemctl status neo4j --no-pager

##############################################################

# Test connection
echo "?? Testing Neo4j connection..."
sleep 5

# Test HTTP endpoint
if curl -f http://localhost:7474 > /dev/null 2>&1; then
    echo "? Neo4j HTTP is running successfully!"
else
    echo "? Neo4j HTTP failed to start"
    echo "Checking logs..."
    sudo journalctl -u neo4j --no-pager -l | tail -20
fi

# Test Bolt endpoint
if nc -z localhost 7687; then
    echo "? Neo4j Bolt port is accessible!"
else
    echo "? Neo4j Bolt port is not accessible"
fi

# Display connection information
echo ""
echo "=== Connection Information ==="
echo "?? Web Interface: http://$PUBLIC_IP:7474"
echo "?? Bolt Connection: bolt://$PUBLIC_IP:7687"
echo "?? Username: neo4j"
echo "?? Password: rfpgraph123"
echo ""

# Create management scripts
echo "?? Creating management scripts..."

# Create start script
cat > ~/start-neo4j.sh << 'EOF'
#!/bin/bash
echo "Starting Neo4j..."
sudo systemctl start neo4j
sudo systemctl status neo4j --no-pager
EOF

# Create stop script
cat > ~/stop-neo4j.sh << 'EOF'
#!/bin/bash
echo "Stopping Neo4j..."
sudo systemctl stop neo4j
sudo systemctl status neo4j --no-pager
EOF

# Create status script
cat > ~/neo4j-status.sh << 'EOF'
#!/bin/bash
echo "=== Neo4j Status ==="
sudo systemctl status neo4j --no-pager

echo ""
echo "=== Memory Usage ==="
free -h

echo ""
echo "=== Disk Usage ==="
df -h /var/lib/neo4j

echo ""
echo "=== Network Connections ==="
sudo netstat -tlnp | grep -E ':(7474|7687)'

echo ""
echo "=== Recent Logs ==="
sudo journalctl -u neo4j --since "10 minutes ago" --no-pager | tail -10
EOF

# Create backup script
cat > ~/backup-neo4j.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/neo4j-backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Creating backup directory..."
mkdir -p $BACKUP_DIR

echo "Creating Neo4j backup..."
sudo neo4j-admin database dump --to-path=$BACKUP_DIR neo4j

if [ $? -eq 0 ]; then
    sudo chown ubuntu:ubuntu $BACKUP_DIR/neo4j.dump
    echo "? Backup completed: $BACKUP_DIR/neo4j.dump"
    echo "?? Backup size: $(du -h $BACKUP_DIR/neo4j.dump | cut -f1)"
    
    # Keep only last 5 backups
    cd $BACKUP_DIR
    ls -t neo4j*.dump | tail -n +6 | xargs -r rm
    echo "?? Old backups cleaned up"
else
    echo "? Backup failed"
fi
EOF

# Make scripts executable
chmod +x ~/start-neo4j.sh ~/stop-neo4j.sh ~/neo4j-status.sh ~/backup-neo4j.sh

echo "? Management scripts created in home directory"

# Create .env template for local machine
cat > ~/neo4j-env-config.txt << EOF
# Add these lines to your local .env file:
NEO4J_ENABLED=true
NEO4J_URI=bolt://$PUBLIC_IP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
EOF

echo ""
echo "=== Installation Complete! ==="
echo ""
echo "?? Next Steps:"
echo "1. Test web interface: http://$PUBLIC_IP:7474"
echo "2. Copy the configuration from ~/neo4j-env-config.txt to your local .env file"
echo "3. Update your security group to allow access only from your IP"
echo "4. Test connection from your RFP application"
echo ""
echo "???  Management Commands:"
echo "   Start:   ./start-neo4j.sh"
echo "   Stop:    ./stop-neo4j.sh" 
echo "   Status:  ./neo4j-status.sh"
echo "   Backup:  ./backup-neo4j.sh"
echo ""
echo "?? Security Recommendations:"
echo "1. Update EC2 Security Group to allow ports 7474,7687 only from your IP"
echo "2. Consider changing the default password"
echo "3. Enable HTTPS for production use"
echo ""
echo "?? Resource Usage:"
echo "   Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "   Disk: $(df -h /var/lib/neo4j | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"

# Final connection test
echo ""
echo "?? Final Connection Test:"
if curl -s http://localhost:7474/db/data/ | grep -q "neo4j"; then
    echo "? Neo4j API is responding correctly"
    echo "?? Installation successful! You can now connect from your local application."
else
    echo "??  Neo4j may still be starting up. Wait a few more seconds and test manually."
fi

echo ""
echo "Configuration file saved to: ~/neo4j-env-config.txt"
echo "View it with: cat ~/neo4j-env-config.txt"


############## Finally run this command

# On your EC2 instance, run:
sudo sed -i '/dbms.connectors.default_listen_address/d' /etc/neo4j/neo4j.conf
sudo systemctl restart neo4j
sudo systemctl status neo4j


