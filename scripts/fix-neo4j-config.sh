#!/bin/bash

# Fix Neo4j Configuration Issues
# This script fixes the configuration error you're seeing

echo "=== Neo4j Configuration Fix ==="
echo ""

# Stop Neo4j service first
echo "🛑 Stopping Neo4j service..."
sudo systemctl stop neo4j

# Backup current config
echo "💾 Backing up current configuration..."
sudo cp /etc/neo4j/neo4j.conf /etc/neo4j/neo4j.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create a clean, working configuration
echo "🔧 Creating corrected Neo4j configuration..."
sudo tee /etc/neo4j/neo4j.conf > /dev/null <<EOF
# Neo4j Configuration - Fixed Version
# Basic settings - Allow connections from anywhere
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474

# Security settings
dbms.security.auth_enabled=true
server.bolt.tls_level=DISABLED

# Memory settings (adjust based on your instance size)
server.memory.heap.initial_size=1G
server.memory.heap.max_size=2G
server.memory.pagecache.size=1G

# Database directories
server.directories.data=/var/lib/neo4j/data
server.directories.logs=/var/lib/neo4j/logs
server.directories.plugins=/var/lib/neo4j/plugins
server.directories.import=/var/lib/neo4j/import

# Network connectors
dbms.connector.bolt.enabled=true
dbms.connector.http.enabled=true

# Logging
dbms.logs.http.enabled=true
dbms.logs.http.rotation.keep_number=5
dbms.logs.http.rotation.size=20M

# Performance settings
dbms.tx_log.rotation.retention_policy=1G size
dbms.checkpoint.interval.time=15m

# Security
dbms.security.allow_csv_import_from_file_urls=true

# JVM settings
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:MaxGCPauseMillis=300
server.jvm.additional=-Djava.awt.headless=true
EOF

# Set proper ownership
sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf

# Validate the configuration
echo "✅ Validating configuration..."
sudo -u neo4j neo4j-admin server validate-config

if [ $? -eq 0 ]; then
    echo "✅ Configuration is valid!"
else
    echo "❌ Configuration still has issues. Let's try a minimal config..."
    
    # Create minimal configuration
    sudo tee /etc/neo4j/neo4j.conf > /dev/null <<EOF
# Minimal Neo4j Configuration
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474
dbms.security.auth_enabled=true
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m
EOF
    
    sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf
    echo "Created minimal configuration"
fi

# Start Neo4j service
echo "🚀 Starting Neo4j service..."
sudo systemctl start neo4j

# Wait a moment
sleep 10

# Check status
echo "📊 Checking service status..."
sudo systemctl status neo4j --no-pager

# Test connection
echo ""
echo "🧪 Testing connection..."
if curl -f http://localhost:7474 > /dev/null 2>&1; then
    echo "✅ Neo4j is running successfully!"
    echo "🌐 Web interface: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):7474"
    echo "👤 Username: neo4j"
    echo "🔑 Password: rfpgraph123"
else
    echo "❌ Neo4j still not responding. Checking logs..."
    sudo journalctl -u neo4j --no-pager -l | tail -10
fi

echo ""
echo "=== Configuration Fix Complete ==="