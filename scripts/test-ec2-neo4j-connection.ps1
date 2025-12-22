# Test EC2 Neo4j Connection Script
# Tests connectivity to Neo4j running on EC2 instance

Write-Host "=== EC2 Neo4j Connection Test ===" -ForegroundColor Green
Write-Host ""

# Get EC2 details from user
$ec2IP = Read-Host "Enter your EC2 instance public IP address"
if ([string]::IsNullOrEmpty($ec2IP)) {
    Write-Host "❌ EC2 IP address is required!" -ForegroundColor Red
    exit 1
}

$neo4jPassword = Read-Host "Enter Neo4j password (default: rfpgraph123)"
if ([string]::IsNullOrEmpty($neo4jPassword)) {
    $neo4jPassword = "rfpgraph123"
}

Write-Host ""
Write-Host "Testing connection to: $ec2IP" -ForegroundColor Cyan
Write-Host ""

# Test HTTP connection (Neo4j Browser)
Write-Host "🌐 Testing HTTP connection (port 7474)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$ec2IP:7474" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ HTTP connection successful (Status: $($response.StatusCode))" -ForegroundColor Green
    
    # Check if it's actually Neo4j
    if ($response.Content -match "neo4j" -or $response.Headers.'Server' -match "neo4j") {
        Write-Host "✅ Neo4j server detected" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Server responding but may not be Neo4j" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ HTTP connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Possible causes:" -ForegroundColor Yellow
    Write-Host "   - Neo4j not running on EC2 instance" -ForegroundColor White
    Write-Host "   - Security group not allowing port 7474 from your IP" -ForegroundColor White
    Write-Host "   - EC2 instance firewall blocking the port" -ForegroundColor White
}

Write-Host ""

# Test Neo4j API endpoint
Write-Host "🔌 Testing Neo4j API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$ec2IP:7474/db/data/" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ Neo4j API responding" -ForegroundColor Green
} catch {
    Write-Host "❌ Neo4j API not responding: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test Bolt port (7687)
Write-Host "⚡ Testing Bolt port (7687)..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.ReceiveTimeout = 5000
    $tcpClient.SendTimeout = 5000
    $tcpClient.Connect($ec2IP, 7687)
    $tcpClient.Close()
    Write-Host "✅ Bolt port 7687 is accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Bolt port 7687 not accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This is the port used by the RFP application to connect to Neo4j" -ForegroundColor Yellow
}

Write-Host ""

# Test with authentication
Write-Host "🔐 Testing Neo4j authentication..." -ForegroundColor Yellow
try {
    # Create basic auth header
    $credentials = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("neo4j:$neo4jPassword"))
    $headers = @{
        "Authorization" = "Basic $credentials"
        "Content-Type" = "application/json"
    }
    
    # Test authentication with a simple query
    $body = @{
        "statements" = @(
            @{
                "statement" = "RETURN 'Hello from EC2!' as message"
            }
        )
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "http://$ec2IP:7474/db/data/transaction/commit" -Method Post -Headers $headers -Body $body -TimeoutSec 10
    
    if ($response.results -and $response.results[0].data) {
        $message = $response.results[0].data[0].row[0]
        Write-Host "✅ Authentication successful! Response: $message" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Authentication response unclear" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Check if the password is correct: $neo4jPassword" -ForegroundColor Yellow
}

Write-Host ""

# Check local .env configuration
Write-Host "📝 Checking local .env configuration..." -ForegroundColor Yellow
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
        
        # Validate configuration against EC2 instance
        if ($neo4jConfig["URI"] -eq "bolt://$ec2IP:7687") {
            Write-Host "✅ URI matches EC2 instance" -ForegroundColor Green
        } else {
            Write-Host "⚠️  URI mismatch. Expected: bolt://$ec2IP:7687, Found: $($neo4jConfig['URI'])" -ForegroundColor Yellow
        }
        
        if ($neo4jConfig["ENABLED"] -eq "true") {
            Write-Host "✅ GraphRAG is enabled" -ForegroundColor Green
        } else {
            Write-Host "⚠️  GraphRAG is disabled (NEO4J_ENABLED=false)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ No Neo4j configuration found in .env" -ForegroundColor Red
        Write-Host "   Add these lines to your .env file:" -ForegroundColor Yellow
        Write-Host "   NEO4J_ENABLED=true" -ForegroundColor Cyan
        Write-Host "   NEO4J_URI=bolt://$ec2IP:7687" -ForegroundColor Cyan
        Write-Host "   NEO4J_USERNAME=neo4j" -ForegroundColor Cyan
        Write-Host "   NEO4J_PASSWORD=$neo4jPassword" -ForegroundColor Cyan
        Write-Host "   NEO4J_DATABASE=neo4j" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the project root directory" -ForegroundColor Yellow
}

Write-Host ""

# Test with Node.js Neo4j driver if available
Write-Host "🟢 Testing Node.js Neo4j driver..." -ForegroundColor Yellow

$testScript = @"
const neo4j = require('neo4j-driver');

async function testConnection() {
    const driver = neo4j.driver(
        'bolt://$ec2IP:7687',
        neo4j.auth.basic('neo4j', '$neo4jPassword')
    );
    
    try {
        await driver.verifyConnectivity();
        console.log('✅ Neo4j driver connection successful');
        
        const session = driver.session();
        const result = await session.run('RETURN "Hello from EC2 GraphRAG!" as message, datetime() as timestamp');
        const record = result.records[0];
        console.log('✅ Query test successful:', record.get('message'));
        console.log('🕒 Server time:', record.get('timestamp').toString());
        await session.close();
    } catch (error) {
        console.log('❌ Neo4j driver connection failed:', error.message);
        if (error.code === 'ServiceUnavailable') {
            console.log('   - Check if Neo4j is running on the EC2 instance');
            console.log('   - Verify security group allows port 7687');
        } else if (error.code === 'Neo.ClientError.Security.Unauthorized') {
            console.log('   - Check username/password combination');
        }
    } finally {
        await driver.close();
    }
}

testConnection();
"@

$testScriptPath = "$env:TEMP\test-ec2-neo4j-driver.js"
$testScript | Out-File -FilePath $testScriptPath -Encoding UTF8

try {
    $nodeOutput = node $testScriptPath 2>&1
    Write-Host $nodeOutput -ForegroundColor White
} catch {
    Write-Host "⚠️  Node.js test skipped (Node.js or neo4j-driver not available)" -ForegroundColor Yellow
    Write-Host "   This is normal if you haven't installed dependencies yet" -ForegroundColor Cyan
    Write-Host "   Install with: npm install neo4j-driver" -ForegroundColor White
}

# Cleanup
Remove-Item $testScriptPath -ErrorAction SilentlyContinue

Write-Host ""

# Network diagnostics
Write-Host "🔍 Network Diagnostics..." -ForegroundColor Yellow

# Test ping
try {
    $pingResult = Test-Connection -ComputerName $ec2IP -Count 2 -Quiet
    if ($pingResult) {
        Write-Host "✅ EC2 instance is reachable (ping successful)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  EC2 instance ping failed (may be normal if ICMP is blocked)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Ping test inconclusive" -ForegroundColor Yellow
}

# Test specific ports
$ports = @(22, 7474, 7687)
foreach ($port in $ports) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 3000
        $tcpClient.SendTimeout = 3000
        $tcpClient.Connect($ec2IP, $port)
        $tcpClient.Close()
        
        $service = switch ($port) {
            22 { "SSH" }
            7474 { "Neo4j HTTP" }
            7687 { "Neo4j Bolt" }
        }
        Write-Host "✅ Port $port ($service) is open" -ForegroundColor Green
    } catch {
        $service = switch ($port) {
            22 { "SSH" }
            7474 { "Neo4j HTTP" }
            7687 { "Neo4j Bolt" }
        }
        Write-Host "❌ Port $port ($service) is not accessible" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Connection Summary ===" -ForegroundColor Green

# Overall status
$httpOk = $false
$boltOk = $false
$authOk = $false
$configOk = $false

try {
    Invoke-WebRequest -Uri "http://$ec2IP:7474" -UseBasicParsing -TimeoutSec 5 | Out-Null
    $httpOk = $true
} catch { }

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($ec2IP, 7687)
    $tcpClient.Close()
    $boltOk = $true
} catch { }

# Check auth by trying a simple request
try {
    $credentials = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("neo4j:$neo4jPassword"))
    $headers = @{ "Authorization" = "Basic $credentials" }
    Invoke-RestMethod -Uri "http://$ec2IP:7474/db/data/" -Headers $headers -TimeoutSec 5 | Out-Null
    $authOk = $true
} catch { }

if (Test-Path $EnvPath) {
    $envContent = Get-Content $EnvPath
    if ($envContent -match "NEO4J_ENABLED=true" -and $envContent -match "NEO4J_URI=bolt://$ec2IP:7687") {
        $configOk = $true
    }
}

Write-Host "📊 Test Results:" -ForegroundColor Cyan
Write-Host "   HTTP Connection: $(if($httpOk){'✅ OK'}else{'❌ Failed'})" -ForegroundColor $(if($httpOk){'Green'}else{'Red'})
Write-Host "   Bolt Connection: $(if($boltOk){'✅ OK'}else{'❌ Failed'})" -ForegroundColor $(if($boltOk){'Green'}else{'Red'})
Write-Host "   Authentication: $(if($authOk){'✅ OK'}else{'❌ Failed'})" -ForegroundColor $(if($authOk){'Green'}else{'Red'})
Write-Host "   Local Config: $(if($configOk){'✅ OK'}else{'❌ Needs Update'})" -ForegroundColor $(if($configOk){'Green'}else{'Red'})

if ($httpOk -and $boltOk -and $authOk -and $configOk) {
    Write-Host ""
    Write-Host "🎉 All tests passed! Your EC2 Neo4j is ready for GraphRAG!" -ForegroundColor Green
} elseif ($httpOk -and $boltOk -and $authOk) {
    Write-Host ""
    Write-Host "⚠️  Neo4j is working but local configuration needs attention." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Issues detected. Please check the troubleshooting steps below." -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Troubleshooting Steps ===" -ForegroundColor Yellow
Write-Host "1. SSH to EC2 and check Neo4j status:" -ForegroundColor White
Write-Host "   ssh -i your-key.pem ubuntu@$ec2IP" -ForegroundColor Cyan
Write-Host "   sudo systemctl status neo4j" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Check EC2 Security Group allows your IP:" -ForegroundColor White
Write-Host "   - Ports 7474, 7687 from your current IP" -ForegroundColor Cyan
Write-Host "   - Your current IP may have changed" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Verify Neo4j is configured for remote access:" -ForegroundColor White
Write-Host "   sudo cat /etc/neo4j/neo4j.conf | grep listen_address" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Check Neo4j logs for errors:" -ForegroundColor White
Write-Host "   sudo journalctl -u neo4j -f" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Connection Information ===" -ForegroundColor Green
Write-Host "Web Interface: http://$ec2IP:7474" -ForegroundColor Cyan
Write-Host "Bolt Connection: bolt://$ec2IP:7687" -ForegroundColor Cyan
Write-Host "Username: neo4j" -ForegroundColor Cyan
Write-Host "Password: $neo4jPassword" -ForegroundColor Cyan

$openBrowser = Read-Host "Would you like to open Neo4j Browser? (y/n)"
if ($openBrowser -in @('y', 'Y', 'yes', 'Yes')) {
    Start-Process "http://$ec2IP:7474"
}

Read-Host "Press Enter to exit"