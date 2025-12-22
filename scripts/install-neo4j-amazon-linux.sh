#!/bin/bash

# Neo4j Installation Script for Amazon Linux 2023
# Run this on your Amazon Linux 2023 EC2 instance

set -e

echo "=== Neo4j Installation for Amazon Linux 2023 - RFP GraphRAG ==="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as ec2-user with sudo privileges."
    exit 1
fi

# Check if we're on Amazon Linux
if ! grep -q "Amazon Linux" /etc/os-release; then
    echo "⚠️  This script is designed for Amazon Linux 2023. Detected:"
    cat /etc/os-release | grep PRETTY_NAME
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
echo "📦 Updating system packages..."
sudo dnf update -y

# Install required packages
echo "📋 Installing required packages..."
sudo dnf install -y java-17-openjdk java-17-openjdk-devel curl wget gnupg2 tar gzip

# Verify Java installation
echo "☕ Java version:"
java -version
echo "✅ Java installed successfully"

# Get EC2 instance details
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "📍 Instance Details:"
echo "   Private IP: $PRIVATE_IP"
echo "   Public IP: $PUBLIC_IP"

# Create neo4j user
echo "👤 Creating neo4j user..."
sudo useradd -r -m -s /bin/bash neo4j || echo "User neo4j already exists"

# Download and install Neo4j Community Edition
echo "🚀 Downloading Neo4j Community Edition..."
NEO4J_VERSION="5.15.0"
NEO4J_TARBALL="neo4j-community-${NEO4J_VERSION}-unix.tar.gz"
NEO4J_URL="https://dist.neo4j.org/${NEO4J_TARBALL}"

cd /tmp
wget $NEO4J_URL

# Extract Neo4j
echo "📦 Extracting Neo4j..."
sudo tar -xzf $NEO4J_TARBALL -C /opt/
sudo mv /opt/neo4j-community-${NEO4J_VERSION} /opt/neo4j
sudo chown -R neo4j:neo4j /opt/neo4j

# Create directories
echo "📁 Creating Neo4j directories..."
sudo mkdir -p /var/lib/neo4j/{data,logs,plugins,import}
sudo mkdir -p /var/log/neo4j
sudo mkdir -p /etc/neo4j
sudo chown -R neo4j:neo4j /var/lib/neo4j
sudo chown -R neo4j:neo4j /var/log/neo4j
sudo chown -R neo4j:neo4j /etc/neo4j

# Create Neo4j configuration
echo "⚙️ Configuring Neo4j for remote access..."
sudo tee /etc/neo4j/neo4j.conf > /dev/null <<EOF
# Basic settings - Allow connections from anywhere
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474
server.https.listen_address=:7473

# Security settings
dbms.security.auth_enabled=true
server.bolt.tls_level=DISABLED

# Memory settings (optimized for t3.medium - 4GB RAM)
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

# JVM tuning for Amazon Linux
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:+UnlockExperimentalVMOptions
server.jvm.additional=-XX:MaxGCPauseMillis=300
server.jvm.additional=-XX:+DisableExplicitGC

# Amazon Linux specific optimizations
server.jvm.additional=-Djava.awt.headless=true
server.jvm.additional=-Dfile.encoding=UTF-8
EOF

# Set proper ownership
sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf

# Create environment file
sudo tee /etc/neo4j/neo4j-wrapper.conf > /dev/null <<EOF
# Neo4j service wrapper configuration
NEO4J_HOME=/opt/neo4j
NEO4J_CONF=/etc/neo4j
NEO4J_DATA=/var/lib/neo4j/data
NEO4J_LOGS=/var/lib/neo4j/logs
NEO4J_PLUGINS=/var/lib/neo4j/plugins
NEO4J_IMPORT=/var/lib/neo4j/import
JAVA_HOME=/usr/lib/jvm/java-17-openjdk
EOF

# Set initial password
echo "🔐 Setting initial password..."
sudo -u neo4j /opt/neo4j/bin/neo4j-admin dbms set-initial-password rfpgraph123

# Create systemd service file
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/neo4j.service > /dev/null <<EOF
[Unit]
Description=Neo4j Graph Database
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=neo4j
Group=neo4j
Environment=NEO4J_HOME=/opt/neo4j
Environment=NEO4J_CONF=/etc/neo4j
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ExecStart=/opt/neo4j/bin/neo4j start
ExecStop=/opt/neo4j/bin/neo4j stop
ExecReload=/opt/neo4j/bin/neo4j restart
TimeoutSec=120
Restart=on-failure
RestartSec=30

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/neo4j /var/log/neo4j /etc/neo4j

[Install]
WantedBy=multi-user.target
EOF

# Configure firewall (firewalld on Amazon Linux 2023)
echo "🔥 Configuring firewall..."
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Allow Neo4j ports
sudo firewall-cmd --permanent --add-port=7474/tcp --zone=public
sudo firewall-cmd --permanent --add-port=7687/tcp --zone=public
sudo firewall-cmd --reload

# Show firewall status
sudo firewall-cmd --list-ports

# Enable and start Neo4j service
echo "🎯 Starting Neo4j service..."
sudo systemctl daemon-reload
sudo systemctl enable neo4j
sudo systemctl start neo4j

# Wait for service to start
echo "⏳ Waiting for Neo4j to start..."
sleep 20

# Check service status
echo "📊 Service Status:"
sudo systemctl status neo4j --no-pager -l

# Test connection
echo "🧪 Testing Neo4j connection..."
sleep 5

# Test HTTP endpoint
if curl -f http://localhost:7474 > /dev/null 2>&1; then
    echo "✅ Neo4j HTTP is running successfully!"
else
    echo "❌ Neo4j HTTP failed to start"
    echo "Checking logs..."
    sudo journalctl -u neo4j --no-pager -l | tail -20
fi

# Test Bolt endpoint
if nc -z localhost 7687 2>/dev/null; then
    echo "✅ Neo4j Bolt port is accessible!"
else
    echo "❌ Neo4j Bolt port is not accessible"
    # Install nc if not available
    sudo dnf install -y nmap-ncat
    if nc -z localhost 7687 2>/dev/null; then
        echo "✅ Neo4j Bolt port is accessible!"
    else
        echo "❌ Neo4j Bolt port is still not accessible"
    fi
fi

# Display connection information
echo ""
echo "=== Connection Information ==="
echo "🌐 Web Interface: http://$PUBLIC_IP:7474"
echo "🔌 Bolt Connection: bolt://$PUBLIC_IP:7687"
echo "👤 Username: neo4j"
echo "🔑 Password: rfpgraph123"
echo ""

# Create management scripts
echo "📝 Creating management scripts..."

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
sudo ss -tlnp | grep -E ':(7474|7687)'

echo ""
echo "=== Recent Logs ==="
sudo journalctl -u neo4j --since "10 minutes ago" --no-pager | tail -10

echo ""
echo "=== Neo4j Process ==="
ps aux | grep neo4j | grep -v grep
EOF

# Create backup script
cat > ~/backup-neo4j.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ec2-user/neo4j-backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Creating backup directory..."
mkdir -p $BACKUP_DIR

echo "Stopping Neo4j for backup..."
sudo systemctl stop neo4j

echo "Creating Neo4j backup..."
sudo -u neo4j /opt/neo4j/bin/neo4j-admin database dump --to-path=$BACKUP_DIR neo4j

if [ $? -eq 0 ]; then
    sudo chown ec2-user:ec2-user $BACKUP_DIR/neo4j.dump
    mv $BACKUP_DIR/neo4j.dump $BACKUP_DIR/neo4j-backup-$DATE.dump
    echo "✅ Backup completed: $BACKUP_DIR/neo4j-backup-$DATE.dump"
    echo "📊 Backup size: $(du -h $BACKUP_DIR/neo4j-backup-$DATE.dump | cut -f1)"
    
    # Keep only last 5 backups
    cd $BACKUP_DIR
    ls -t neo4j-backup-*.dump | tail -n +6 | xargs -r rm
    echo "🧹 Old backups cleaned up"
else
    echo "❌ Backup failed"
fi

echo "Starting Neo4j..."
sudo systemctl start neo4j
EOF

# Create log viewer script
cat > ~/view-neo4j-logs.sh << 'EOF'
#!/bin/bash
echo "=== Neo4j Service Logs ==="
sudo journalctl -u neo4j -f --no-pager
EOF

# Create performance monitoring script
cat > ~/monitor-neo4j.sh << 'EOF'
#!/bin/bash
echo "=== Neo4j Performance Monitor ==="
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    clear
    echo "=== $(date) ==="
    echo ""
    
    echo "Service Status:"
    sudo systemctl is-active neo4j
    echo ""
    
    echo "Memory Usage:"
    free -h | grep -E "(Mem|Swap)"
    echo ""
    
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//'
    echo ""
    
    echo "Disk Usage:"
    df -h /var/lib/neo4j | tail -1 | awk '{print "Used: " $3 "/" $2 " (" $5 ")"}'
    echo ""
    
    echo "Network Connections:"
    sudo ss -tlnp | grep -E ':(7474|7687)' | wc -l | awk '{print $1 " active connections"}'
    echo ""
    
    echo "Neo4j Process:"
    ps aux | grep neo4j | grep -v grep | awk '{print "PID: " $2 ", CPU: " $3 "%, MEM: " $4 "%"}'
    
    sleep 5
done
EOF

# Make scripts executable
chmod +x ~/start-neo4j.sh ~/stop-neo4j.sh ~/neo4j-status.sh ~/backup-neo4j.sh ~/view-neo4j-logs.sh ~/monitor-neo4j.sh

echo "✅ Management scripts created in home directory"

# Create .env template for local machine
cat > ~/neo4j-env-config.txt << EOF
# Add these lines to your local .env file:
NEO4J_ENABLED=true
NEO4J_URI=bolt://$PUBLIC_IP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
EOF

# Create performance tuning script
cat > ~/tune-neo4j-performance.sh << 'EOF'
#!/bin/bash
echo "=== Neo4j Performance Tuning for Amazon Linux 2023 ==="

# Get system memory
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
echo "Total system memory: ${TOTAL_MEM}MB"

# Calculate optimal settings
HEAP_SIZE=$((TOTAL_MEM / 2))
PAGECACHE_SIZE=$((TOTAL_MEM / 4))

if [ $HEAP_SIZE -gt 2048 ]; then
    HEAP_SIZE=2048
fi

if [ $PAGECACHE_SIZE -gt 1024 ]; then
    PAGECACHE_SIZE=1024
fi

echo "Recommended settings:"
echo "  Heap size: ${HEAP_SIZE}m"
echo "  Page cache: ${PAGECACHE_SIZE}m"

read -p "Apply these settings? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo sed -i "s/server.memory.heap.max_size=.*/server.memory.heap.max_size=${HEAP_SIZE}m/" /etc/neo4j/neo4j.conf
    sudo sed -i "s/server.memory.pagecache.size=.*/server.memory.pagecache.size=${PAGECACHE_SIZE}m/" /etc/neo4j/neo4j.conf
    
    echo "Settings applied. Restarting Neo4j..."
    sudo systemctl restart neo4j
    echo "✅ Performance tuning complete"
else
    echo "Settings not applied"
fi
EOF

chmod +x ~/tune-neo4j-performance.sh

echo ""
echo "=== Installation Complete! ==="
echo ""
echo "📋 Next Steps:"
echo "1. Test web interface: http://$PUBLIC_IP:7474"
echo "2. Copy the configuration from ~/neo4j-env-config.txt to your local .env file"
echo "3. Update your security group to allow access only from your IP"
echo "4. Test connection from your RFP application"
echo ""
echo "🛠️  Management Commands:"
echo "   Start:     ./start-neo4j.sh"
echo "   Stop:      ./stop-neo4j.sh" 
echo "   Status:    ./neo4j-status.sh"
echo "   Backup:    ./backup-neo4j.sh"
echo "   Logs:      ./view-neo4j-logs.sh"
echo "   Monitor:   ./monitor-neo4j.sh"
echo "   Tune:      ./tune-neo4j-performance.sh"
echo ""
echo "🔒 Security Recommendations:"
echo "1. Update EC2 Security Group to allow ports 7474,7687 only from your IP"
echo "2. Consider changing the default password"
echo "3. Enable HTTPS for production use"
echo ""
echo "📊 Resource Usage:"
echo "   Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "   Disk: $(df -h /var/lib/neo4j | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"

# Final connection test
echo ""
echo "🔍 Final Connection Test:"
if curl -s http://localhost:7474/db/data/ | grep -q "neo4j"; then
    echo "✅ Neo4j API is responding correctly"
    echo "🎉 Installation successful! You can now connect from your local application."
else
    echo "⚠️  Neo4j may still be starting up. Wait a few more seconds and test manually."
    echo "Check logs with: sudo journalctl -u neo4j -f"
fi

echo ""
echo "Configuration file saved to: ~/neo4j-env-config.txt"
echo "View it with: cat ~/neo4j-env-config.txt"

# Show service status one more time
echo ""
echo "=== Final Service Status ==="
sudo systemctl status neo4j --no-pager