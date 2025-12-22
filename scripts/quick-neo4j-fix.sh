#!/bin/bash

# Quick Neo4j Configuration Fix
echo "🔧 Quick Neo4j Fix..."

# Stop service
sudo systemctl stop neo4j

# Create working config
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

# Set ownership
sudo chown neo4j:neo4j /etc/neo4j/neo4j.conf

# Start service
sudo systemctl start neo4j

# Wait and test
sleep 10
curl -f http://localhost:7474 && echo "✅ Neo4j is working!" || echo "❌ Still issues"