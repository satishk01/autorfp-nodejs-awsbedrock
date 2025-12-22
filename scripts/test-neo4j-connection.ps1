# Neo4j Connection Test Script
# Tests Neo4j connectivity for RFP GraphRAG system

Write-Host "=== Neo4j Connection Test ===" -ForegroundColor Green
Write-Host ""

# Test HTTP connection
Write-Host "🌐 Testing HTTP connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7474" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ HTTP connection successful (Status: $($response.StatusCode))" -ForegroundColor Green
    
    # Check if it's actually Neo4j
    if ($response.Content -match "neo4j" -or $response.Headers.'Server' -match "neo4j") {
        Write-Host "✅ Neo4j server detected" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Server responding but may not be Neo4j" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ HTTP connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure Neo4j is running and accessible on port 7474" -ForegroundColor Yellow
}

Write-Host ""

# Test Neo4j API endpoint
Write-Host "🔌 Testing Neo4j API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7474/db/data/" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ Neo4j API responding" -ForegroundColor Green
} catch {
    Write-Host "❌ Neo4j API not responding: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test Bolt port
Write-Host "⚡ Testing Bolt port (7687)..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 7687)
    $tcpClient.Close()
    Write-Host "✅ Bolt port 7687 is open" -ForegroundColor Green
} catch {
    Write-Host "❌ Bolt port 7687 not accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This is the port used by the RFP application to connect to Neo4j" -ForegroundColor Yellow
}

Write-Host ""

# Check if Neo4j Desktop is running
Write-Host "🖥️  Checking Neo4j Desktop..." -ForegroundColor Yellow
$neo4jProcesses = Get-Process | Where-Object { $_.ProcessName -like "*neo4j*" -or $_.ProcessName -like "*Neo4j*" }

if ($neo4jProcesses) {
    Write-Host "✅ Neo4j processes found:" -ForegroundColor Green
    foreach ($process in $neo4jProcesses) {
        Write-Host "   - $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  No Neo4j processes found" -ForegroundColor Yellow
    Write-Host "   Make sure Neo4j Desktop is running and database is started" -ForegroundColor Yellow
}

Write-Host ""

# Display connection information
Write-Host "=== Connection Information ===" -ForegroundColor Green
Write-Host "Web Interface: http://localhost:7474" -ForegroundColor Cyan
Write-Host "Bolt Connection: bolt://localhost:7687" -ForegroundColor Cyan
Write-Host "Default Username: neo4j" -ForegroundColor Cyan
Write-Host "Default Password: rfpgraph123 (or your custom password)" -ForegroundColor Cyan

Write-Host ""

# Check .env configuration
Write-Host "📝 Checking .env configuration..." -ForegroundColor Yellow
$EnvPath = ".\.env"

if (Test-Path $EnvPath) {
    $envContent = Get-Content $EnvPath
    $neo4jConfig = @{}
    
    foreach ($line in $envContent) {
        if ($line -match "^NEO4J_(.+)=(.+)$") {
            $neo4jConfig[$matches[1]] = $matches[2]
        }
    }
    
    if ($neo4jConfig.Count -gt 0) {
        Write-Host "✅ Neo4j configuration found in .env:" -ForegroundColor Green
        foreach ($key in $neo4jConfig.Keys) {
            $value = $neo4jConfig[$key]
            if ($key -eq "PASSWORD") {
                $value = "***hidden***"
            }
            Write-Host "   NEO4J_$key = $value" -ForegroundColor Cyan
        }
        
        # Validate configuration
        if ($neo4jConfig["ENABLED"] -eq "true") {
            Write-Host "✅ GraphRAG is enabled" -ForegroundColor Green
        } else {
            Write-Host "⚠️  GraphRAG is disabled (NEO4J_ENABLED=false)" -ForegroundColor Yellow
        }
        
        if ($neo4jConfig["URI"] -ne "bolt://localhost:7687") {
            Write-Host "⚠️  Non-standard URI: $($neo4jConfig['URI'])" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ No Neo4j configuration found in .env" -ForegroundColor Red
        Write-Host "   Add these lines to your .env file:" -ForegroundColor Yellow
        Write-Host "   NEO4J_ENABLED=true" -ForegroundColor Cyan
        Write-Host "   NEO4J_URI=bolt://localhost:7687" -ForegroundColor Cyan
        Write-Host "   NEO4J_USERNAME=neo4j" -ForegroundColor Cyan
        Write-Host "   NEO4J_PASSWORD=rfpgraph123" -ForegroundColor Cyan
        Write-Host "   NEO4J_DATABASE=neo4j" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the project root directory" -ForegroundColor Yellow
}

Write-Host ""

# Test with Node.js if available
Write-Host "🟢 Testing Node.js Neo4j driver..." -ForegroundColor Yellow

$testScript = @"
const neo4j = require('neo4j-driver');

async function testConnection() {
    const driver = neo4j.driver(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', 'rfpgraph123')
    );
    
    try {
        await driver.verifyConnectivity();
        console.log('✅ Neo4j driver connection successful');
        
        const session = driver.session();
        const result = await session.run('RETURN "Hello GraphRAG!" as message');
        console.log('✅ Query test successful:', result.records[0].get('message'));
        await session.close();
    } catch (error) {
        console.log('❌ Neo4j driver connection failed:', error.message);
    } finally {
        await driver.close();
    }
}

testConnection();
"@

$testScriptPath = "$env:TEMP\test-neo4j-driver.js"
$testScript | Out-File -FilePath $testScriptPath -Encoding UTF8

try {
    $nodeOutput = node $testScriptPath 2>&1
    Write-Host $nodeOutput -ForegroundColor White
} catch {
    Write-Host "⚠️  Node.js test skipped (Node.js or neo4j-driver not available)" -ForegroundColor Yellow
    Write-Host "   This is normal if you haven't installed dependencies yet" -ForegroundColor Cyan
}

# Cleanup
Remove-Item $testScriptPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Green

# Overall status
$httpOk = $false
$boltOk = $false
$configOk = $false

try {
    Invoke-WebRequest -Uri "http://localhost:7474" -UseBasicParsing -TimeoutSec 5 | Out-Null
    $httpOk = $true
} catch { }

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 7687)
    $tcpClient.Close()
    $boltOk = $true
} catch { }

if (Test-Path $EnvPath) {
    $envContent = Get-Content $EnvPath
    if ($envContent -match "NEO4J_ENABLED=true") {
        $configOk = $true
    }
}

if ($httpOk -and $boltOk -and $configOk) {
    Write-Host "🎉 All tests passed! GraphRAG should work correctly." -ForegroundColor Green
} elseif ($httpOk -and $boltOk) {
    Write-Host "⚠️  Neo4j is running but configuration may need attention." -ForegroundColor Yellow
} else {
    Write-Host "❌ Issues detected. Please check Neo4j installation and startup." -ForegroundColor Red
}

Write-Host ""
Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
Write-Host "1. Make sure Neo4j Desktop is installed and running" -ForegroundColor White
Write-Host "2. Create and start a database in Neo4j Desktop" -ForegroundColor White
Write-Host "3. Check that ports 7474 and 7687 are not blocked by firewall" -ForegroundColor White
Write-Host "4. Verify the password matches your Neo4j database password" -ForegroundColor White
Write-Host "5. Try accessing http://localhost:7474 in your browser" -ForegroundColor White

Read-Host "Press Enter to exit"