#!/bin/bash

# Fix Neo4j Password Authentication
echo "=== Neo4j Password Fix ==="
echo ""

# Check if Neo4j is running
echo "🔍 Checking Neo4j status..."
sudo systemctl status neo4j --no-pager -l

echo ""
echo "🔧 Resetting Neo4j password..."

# Stop Neo4j
sudo systemctl stop neo4j

# Reset the password using neo4j-admin
echo "Setting password to 'rfpgraph123'..."
sudo neo4j-admin dbms set-initial-password rfpgraph123

# Alternative method if the above doesn't work
if [ $? -ne 0 ]; then
    echo "First method failed, trying alternative approach..."
    
    # Remove auth database to reset
    sudo rm -rf /var/lib/neo4j/data/dbms/auth*
    
    # Set initial password
    sudo -u neo4j neo4j-admin dbms set-initial-password rfpgraph123
fi

# Start Neo4j
echo "🚀 Starting Neo4j..."
sudo systemctl start neo4j

# Wait for startup
echo "⏳ Waiting for Neo4j to start..."
sleep 15

# Check status
echo "📊 Checking Neo4j status..."
sudo systemctl status neo4j --no-pager

# Test connection
echo ""
echo "🧪 Testing connection..."
if curl -f http://localhost:7474 > /dev/null 2>&1; then
    echo "✅ Neo4j web interface is accessible!"
    echo ""
    echo "🌐 Access Neo4j Browser at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):7474"
    echo "👤 Username: neo4j"
    echo "🔑 Password: rfpgraph123"
    echo ""
    echo "🔗 Bolt connection: bolt://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):7687"
else
    echo "❌ Neo4j still not responding. Checking logs..."
    sudo journalctl -u neo4j --no-pager -l | tail -20
fi

echo ""
echo "=== Password Fix Complete ==="
echo ""
echo "Next steps:"
echo "1. Test the connection from your local machine"
echo "2. If it works, restart your RFP application backend"
echo "3. The hybrid GraphRAG should now work!"