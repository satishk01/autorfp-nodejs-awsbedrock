# Neo4j Installation Guide for Windows

## Overview
This guide provides multiple methods to install Neo4j on Windows for the RFP Automation System's GraphRAG features.

## Method 1: Neo4j Desktop (Recommended for Development)

### Step 1: Download Neo4j Desktop
1. Go to https://neo4j.com/download/
2. Click "Download Neo4j Desktop"
3. Fill out the form (use your email)
4. Download the `.exe` file (approximately 150MB)

### Step 2: Install Neo4j Desktop
1. Run the downloaded `.exe` file as Administrator
2. Follow the installation wizard
3. Accept the license agreement
4. Choose installation directory (default is fine)
5. Complete the installation

### Step 3: Create a Project and Database
1. Launch Neo4j Desktop
2. Click "New Project" 
3. Name it "RFP GraphRAG"
4. Click "Add Database" → "Create a Local Database"
5. Configure database:
   - **Name**: `rfp-graphrag`
   - **Password**: `rfpgraph123` (or your preferred password)
   - **Version**: Latest (5.x recommended)
6. Click "Create"

### Step 4: Start the Database
1. Click the "Start" button on your database
2. Wait for the status to show "Active"
3. Note the connection details:
   - **Bolt URL**: `bolt://localhost:7687`
   - **HTTP URL**: `http://localhost:7474`

### Step 5: Verify Installation
1. Click "Open" → "Neo4j Browser"
2. This opens the web interface at http://localhost:7474
3. Login with:
   - **Username**: `neo4j`
   - **Password**: `rfpgraph123` (or your chosen password)
4. Run test query: `:play start`

## Method 2: Neo4j Community Server (Manual Installation)

### Step 1: Install Java (Required)
Neo4j requires Java 17 or later.

```powershell
# Check if Java is installed
java -version

# If not installed, download from:
# https://adoptium.net/temurin/releases/
# Choose Java 17 LTS for Windows x64
```

### Step 2: Download Neo4j Community Server
1. Go to https://neo4j.com/download-center/#community
2. Download "Neo4j Community Server" for Windows
3. Extract the ZIP file to `C:\neo4j` (or preferred location)

### Step 3: Configure Neo4j
Create a PowerShell script to configure Neo4j:

```powershell
# Save as: configure-neo4j.ps1
$NEO4J_HOME = "C:\neo4j"
$NEO4J_CONF = "$NEO4J_HOME\conf\neo4j.conf"

# Create configuration
@"
# Basic settings
server.default_listen_address=0.0.0.0
server.bolt.listen_address=:7687
server.http.listen_address=:7474

# Security settings
dbms.security.auth_enabled=true
server.bolt.tls_level=DISABLED

# Memory settings
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m

# Database location
server.directories.data=data
server.directories.logs=logs
"@ | Out-File -FilePath $NEO4J_CONF -Encoding UTF8

Write-Host "Neo4j configured successfully!"
Write-Host "Configuration file: $NEO4J_CONF"
```

### Step 4: Set Initial Password
```powershell
# Save as: set-neo4j-password.ps1
$NEO4J_HOME = "C:\neo4j"
$PASSWORD = "rfpgraph123"

# Set initial password
& "$NEO4J_HOME\bin\neo4j-admin.bat" dbms set-initial-password $PASSWORD

Write-Host "Password set to: $PASSWORD"
```

### Step 5: Start Neo4j Service
```powershell
# Save as: start-neo4j.ps1
$NEO4J_HOME = "C:\neo4j"

# Start Neo4j
& "$NEO4J_HOME\bin\neo4j.bat" start

Write-Host "Neo4j started!"
Write-Host "Web interface: http://localhost:7474"
Write-Host "Bolt connection: bolt://localhost:7687"
Write-Host "Username: neo4j"
Write-Host "Password: rfpgraph123"
```

### Step 6: Stop Neo4j Service
```powershell
# Save as: stop-neo4j.ps1
$NEO4J_HOME = "C:\neo4j"

# Stop Neo4j
& "$NEO4J_HOME\bin\neo4j.bat" stop

Write-Host "Neo4j stopped!"
```

## Method 3: Docker Installation (If Docker is Available)

### Prerequisites
- Docker Desktop for Windows installed and running

### Step 1: Pull and Run Neo4j Container
```powershell
# Save as: docker-neo4j.ps1

# Create data directories
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\neo4j\data"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\neo4j\logs"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\neo4j\import"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\neo4j\plugins"

# Run Neo4j container
docker run `
    --name neo4j-rfp `
    -p7474:7474 -p7687:7687 `
    -d `
    -v "$env:USERPROFILE\neo4j\data:/data" `
    -v "$env:USERPROFILE\neo4j\logs:/logs" `
    -v "$env:USERPROFILE\neo4j\import:/var/lib/neo4j/import" `
    -v "$env:USERPROFILE\neo4j\plugins:/plugins" `
    --env NEO4J_AUTH=neo4j/rfpgraph123 `
    neo4j:latest

Write-Host "Neo4j container started!"
Write-Host "Web interface: http://localhost:7474"
Write-Host "Username: neo4j"
Write-Host "Password: rfpgraph123"
```

### Step 2: Docker Management Scripts
```powershell
# Save as: docker-neo4j-stop.ps1
docker stop neo4j-rfp
Write-Host "Neo4j container stopped!"

# Save as: docker-neo4j-start.ps1
docker start neo4j-rfp
Write-Host "Neo4j container started!"

# Save as: docker-neo4j-remove.ps1
docker stop neo4j-rfp
docker rm neo4j-rfp
Write-Host "Neo4j container removed!"
```

## Configuration for RFP System

### Step 1: Update .env File
After installing Neo4j, update your `.env` file:

```env
# Neo4j Configuration (for GraphRAG)
NEO4J_ENABLED=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
```

### Step 2: Test Connection Script
Create a test script to verify the connection:

```powershell
# Save as: test-neo4j-connection.ps1

# Test HTTP connection
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7474" -UseBasicParsing
    Write-Host "✅ HTTP connection successful (Status: $($response.StatusCode))"
} catch {
    Write-Host "❌ HTTP connection failed: $($_.Exception.Message)"
}

# Test if Neo4j is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7474/db/data/" -UseBasicParsing
    Write-Host "✅ Neo4j API responding"
} catch {
    Write-Host "❌ Neo4j API not responding: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Connection Details:"
Write-Host "Web Interface: http://localhost:7474"
Write-Host "Bolt Connection: bolt://localhost:7687"
Write-Host "Username: neo4j"
Write-Host "Password: rfpgraph123"
```

## Verification Steps

### Step 1: Access Neo4j Browser
1. Open browser and go to http://localhost:7474
2. Login with username `neo4j` and password `rfpgraph123`
3. You should see the Neo4j Browser interface

### Step 2: Run Test Queries
In the Neo4j Browser, run these test queries:

```cypher
// Check Neo4j version
CALL dbms.components() YIELD name, versions, edition
RETURN name, versions, edition;

// Create a test node
CREATE (test:TestNode {name: 'RFP GraphRAG Test', created: datetime()})
RETURN test;

// Verify the node was created
MATCH (test:TestNode) RETURN test;

// Clean up test node
MATCH (test:TestNode) DELETE test;
```

### Step 3: Test from RFP Application
1. Start your RFP application backend
2. Check the logs for Neo4j connection messages
3. Look for: "GraphRAG service initialized successfully"

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```powershell
# Check what's using ports 7474 and 7687
netstat -ano | findstr :7474
netstat -ano | findstr :7687

# Kill processes if needed
taskkill /PID <PID> /F
```

#### 2. Java Not Found (Manual Installation)
```powershell
# Check Java installation
java -version

# If not found, add to PATH or install Java 17+
# Download from: https://adoptium.net/temurin/releases/
```

#### 3. Permission Issues
- Run PowerShell as Administrator
- Ensure Neo4j directory has write permissions
- Check Windows Firewall settings

#### 4. Memory Issues
Reduce memory settings in neo4j.conf:
```
server.memory.heap.initial_size=256m
server.memory.heap.max_size=512m
server.memory.pagecache.size=256m
```

### Performance Optimization

#### For Development
```
# In neo4j.conf
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m
```

#### For Production
```
# In neo4j.conf
server.memory.heap.initial_size=2G
server.memory.heap.max_size=4G
server.memory.pagecache.size=2G
```

## Maintenance Scripts

### Backup Database
```powershell
# Save as: backup-neo4j.ps1
$NEO4J_HOME = "C:\neo4j"
$BACKUP_DIR = "$env:USERPROFILE\neo4j-backups"
$DATE = Get-Date -Format "yyyy-MM-dd-HHmm"

New-Item -ItemType Directory -Force -Path $BACKUP_DIR

& "$NEO4J_HOME\bin\neo4j-admin.bat" database dump --to-path="$BACKUP_DIR" neo4j

Write-Host "Backup completed: $BACKUP_DIR\neo4j-$DATE.dump"
```

### Clear All Data
```powershell
# Save as: clear-neo4j-data.ps1
# WARNING: This will delete all data!

$NEO4J_HOME = "C:\neo4j"

# Stop Neo4j
& "$NEO4J_HOME\bin\neo4j.bat" stop

# Clear data directory
Remove-Item -Recurse -Force "$NEO4J_HOME\data\databases\*"
Remove-Item -Recurse -Force "$NEO4J_HOME\data\transactions\*"

# Restart Neo4j
& "$NEO4J_HOME\bin\neo4j.bat" start

Write-Host "All Neo4j data cleared!"
```

## Next Steps

After successful installation:

1. **Update RFP Application**: Ensure `.env` file has correct Neo4j settings
2. **Start RFP Backend**: The system will automatically connect to Neo4j
3. **Test GraphRAG**: Upload documents and check the Knowledge Graph tab
4. **Monitor Performance**: Watch logs for any connection issues

## Recommended Installation

For development and testing, I recommend **Method 1 (Neo4j Desktop)** because:
- Easy installation and management
- Built-in monitoring and tools
- Automatic updates
- User-friendly interface
- No manual configuration required

The Neo4j Desktop approach is the most straightforward and provides the best development experience.