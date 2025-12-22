# Neo4j GraphRAG Implementation Guide

## Overview
This guide extends the RFP Automation System to include GraphRAG capabilities using Neo4j alongside the existing FAISS vector storage. This hybrid approach provides both semantic similarity search and graph-based relationship discovery.

## Neo4j Installation

### Option 1: Neo4j Desktop (Recommended for Development)
1. Download Neo4j Desktop from: https://neo4j.com/download/
2. Install and create a new project
3. Create a new database with:
   - Name: `rfp-graphrag`
   - Password: `your_password`
   - Version: 5.x (latest)

### Option 2: Neo4j Community Server (Docker)
```bash
# Pull and run Neo4j container
docker run \
    --name neo4j-rfp \
    -p7474:7474 -p7687:7687 \
    -d \
    -v $HOME/neo4j/data:/data \
    -v $HOME/neo4j/logs:/logs \
    -v $HOME/neo4j/import:/var/lib/neo4j/import \
    -v $HOME/neo4j/plugins:/plugins \
    --env NEO4J_AUTH=neo4j/your_password \
    neo4j:latest
```

### Option 3: Local Installation
1. Download from: https://neo4j.com/deployment-center/
2. Extract and configure
3. Set password: `bin/neo4j-admin dbms set-initial-password your_password`
4. Start: `bin/neo4j start`

## Access Neo4j
- **Browser Interface**: http://localhost:7474
- **Bolt Protocol**: bolt://localhost:7687
- **Username**: neo4j
- **Password**: your_password

## Required Dependencies
```bash
npm install neo4j-driver
npm install @neo4j/graphql
npm install uuid
```