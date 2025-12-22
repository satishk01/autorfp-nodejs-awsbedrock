#!/bin/bash

# Neo4j Installation Script for Amazon Linux 2023 (Fixed Version)
# Handles firewall and Java path issues properly

set -e

echo "=== Neo4j Installation for Amazon Linux 2023 (Fixed) - RFP GraphRAG ==="
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
sudo dnf install -y java-17-openjdk java-17-openjdk-devel curl wget tar gzip nc

# Find Java installation
echo "🔍 Finding Java installation..."
JAVA_HOME=""

# Try common locations
JAVA_LOCATIONS=(
    "/usr/lib/jvm/java-17-openjdk"
    "/usr/lib/jvm/jre-17-openjdk"
    "/usr/lib/jvm/java-17"
)

for location in "${JAVA_LOCATIONS[@]}"; do
    if [ -d "$location" ] && [ -x "$location/bin/java" ]; then
        JAVA_HOME="$location"
        break
    fi
done

# If not found, use rpm to find it
if [ -z "$JAVA_HOME" ]; then
    echo "🔍 Using rpm to locate Java..."
    JAVA_BIN=$(rpm -ql java-17-openjdk | grep "bin/java$" | head -1)
    if [ -n "$JAVA_BIN" ] && [ -x "$JAVA_BIN" ]; then
        JAVA_HOME=$(dirname $(dirname "$JAVA_BIN"))
    fi
fi

# If still not found, search broadly
if [ -z "$JAVA_HOME" ]; then
    echo "🔍 Searching system-wide for Java..."
    JAVA_BIN=$(find /usr -name "java" -type f -executable 2>/dev/null | grep -E "(openjdk|java-17)" | head -1)
    if [ -n "$JAVA_BIN" ] && [ -x "$JAVA_BIN" ]; then
        JAVA_HOME=$(dirname $(dirname "$JAVA_BIN"))
    fi
fi

if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "❌ Could not find Java installation"
    echo "Installed Java packages:"
    dnf list installed | grep -i openjdk
    echo "Searching for java executables:"
    find /usr -name "java" -type f 2>/dev/null | head -5
    exit 1
fi

echo "✅ Found Java at: $JAVA_HOME"

# Set Java environment for this session
export JAVA_HOME="$JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

# Verify Java installation
echo "☕ Java version:"
java -version
echo "✅ Java is working"

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
Environment=JAVA_HOME=$JAVA_HOME
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

# Configure firewall - Handle different firewall systems
echo "🔥 Configuring firewall..."

# Check what firewall system is available
if command -v firewall-cmd &> /dev/null; then
    echo "Using firewalld..."
    sudo systemctl enable firewalld
    sudo systemctl start firewalld
    sudo firewall-cmd --permanent --add-port=7474/tcp --zone=public
    sudo firewall-cmd --permanent --add-port=7687/tcp --zone=public
    sudo firewall-cmd --reload
    sudo firewall-cmd --list-ports
elif command -v iptables &> /dev/null; then
    echo "Using iptables..."
    # Allow Neo4j ports
    sudo iptables -I INPUT -p tcp --dport 7474 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 7687 -j ACCEPT
    
    # Save iptables rules (method varies by system)
    if [ -f /etc/sysconfig/iptables ]; then
        sudo service iptables save
    elif command -v iptables-save &> /dev/null; then
        sudo iptables-save > /tmp/iptables.rules
        sudo cp /tmp/iptables.rules /etc/iptables/rules.v4 2>/dev/null || true
    fi
    
    echo "iptables rules added for ports 7474 and 7687"
else
    echo "⚠️  No firewall system detected. Ports should be open by default."
    echo "   Make sure your EC2 Security Group allows ports 7474 and 7687"
fi

# Set up Java environment permanently
echo "🔧 Setting up Java environment..."

# Clean up existing Java entries
sed -i '/JAVA_HOME/d' ~/.bashrc
sed -i '/java.*bin/d' ~/.bashrc

# Add Java environment
cat >> ~/.bashrc << EOF

# Java Environment (Neo4j setup)
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

# System-wide Java setup
sudo tee /etc/profile.d/java.sh > /dev/null <<EOF
# Java Environment
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

sudo chmod +x /etc/profile.d/java.sh

# Set up alternatives
sudo alternatives --install /usr/bin/java java $JAVA_HOME/bin/java 1
if [ -f "$JAVA_HOME/bin/javac" ]; then
    sudo alternatives --install /usr/bin/javac javac $JAVA_HOME/bin/javac 1
fi

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
MAX_RETRIES=6
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:7474 > /dev/null 2>&1; then
        echo "✅ Neo4j HTTP is running successfully!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Waiting for Neo4j to start... (attempt $RETRY_COUNT/$MAX_RETRIES)"
            sleep 10
        else
            echo "❌ Neo4j HTTP failed to start after $MAX_RETRIES attempts"
            echo "Checking logs..."
            sudo journalctl -u neo4j --no-pager -l | tail -20
        fi
    fi
done

# Test Bolt endpoint
if nc -z localhost 7687 2>/dev/null; then
    echo "✅ Neo4j Bolt port is accessible!"
else
    echo "❌ Neo4j Bolt port is not accessible"
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
sleep 5
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

# Create troubleshooting script
cat > ~/troubleshoot-neo4j.sh << 'EOF'
#!/bin/bash
echo "=== Neo4j Troubleshooting ==="
echo ""

echo "1. Service Status:"
sudo systemctl status neo4j --no-pager
echo ""

echo "2. Java Status:"
java -version 2>&1 || echo "Java not found"
echo "JAVA_HOME: $JAVA_HOME"
echo ""

echo "3. Port Status:"
sudo ss -tlnp | grep -E ':(7474|7687)' || echo "Neo4j ports not listening"
echo ""

echo "4. Process Status:"
ps aux | grep neo4j | grep -v grep || echo "No Neo4j processes"
echo ""

echo "5. Recent Logs:"
sudo journalctl -u neo4j --since "30 minutes ago" --no-pager | tail -20
echo ""

echo "6. Configuration Check:"
sudo -u neo4j /opt/neo4j/bin/neo4j-admin server console --dry-run 2>&1 | head -10
echo ""

echo "7. Disk Space:"
df -h /var/lib/neo4j
echo ""

echo "8. Memory:"
free -h
EOF

# Make scripts executable
chmod +x ~/start-neo4j.sh ~/stop-neo4j.sh ~/neo4j-status.sh ~/backup-neo4j.sh ~/troubleshoot-neo4j.sh

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
echo "   Start:        ./start-neo4j.sh"
echo "   Stop:         ./stop-neo4j.sh" 
echo "   Status:       ./neo4j-status.sh"
echo "   Backup:       ./backup-neo4j.sh"
echo "   Troubleshoot: ./troubleshoot-neo4j.sh"
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
    echo "Check status with: ./neo4j-status.sh"
    echo "Check logs with: sudo journalctl -u neo4j -f"
fi

echo ""
echo "Configuration file saved to: ~/neo4j-env-config.txt"
echo "View it with: cat ~/neo4j-env-config.txt"

# Show service status one more time
echo ""
echo "=== Final Service Status ==="
sudo systemctl status neo4j --no-pager