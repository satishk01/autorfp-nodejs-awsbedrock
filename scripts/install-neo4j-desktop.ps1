# Neo4j Desktop Installation Script for Windows
# Run this script as Administrator

Write-Host "=== Neo4j Desktop Installation for RFP GraphRAG ===" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Function to download file
function Download-File {
    param (
        [string]$Url,
        [string]$OutputPath
    )
    
    try {
        Write-Host "Downloading from: $Url" -ForegroundColor Yellow
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        return $true
    } catch {
        Write-Host "❌ Download failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Create temp directory
$TempDir = "$env:TEMP\neo4j-install"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host "📁 Created temp directory: $TempDir" -ForegroundColor Blue

# Neo4j Desktop download URL (this may need to be updated)
$Neo4jDesktopUrl = "https://neo4j.com/artifact.php?name=neo4j-desktop-offline"
$InstallerPath = "$TempDir\neo4j-desktop-setup.exe"

Write-Host ""
Write-Host "🌐 Attempting to download Neo4j Desktop..." -ForegroundColor Yellow
Write-Host "Note: You may need to download manually from https://neo4j.com/download/" -ForegroundColor Cyan

# Try to download (may not work due to form requirements)
$downloadSuccess = Download-File -Url $Neo4jDesktopUrl -OutputPath $InstallerPath

if (-not $downloadSuccess) {
    Write-Host ""
    Write-Host "⚠️  Automatic download failed. Please follow these steps:" -ForegroundColor Yellow
    Write-Host "1. Open browser and go to: https://neo4j.com/download/" -ForegroundColor White
    Write-Host "2. Click 'Download Neo4j Desktop'" -ForegroundColor White
    Write-Host "3. Fill out the form and download the .exe file" -ForegroundColor White
    Write-Host "4. Save it as: $InstallerPath" -ForegroundColor White
    Write-Host ""
    
    do {
        $continue = Read-Host "Have you downloaded the installer? (y/n)"
    } while ($continue -notin @('y', 'Y', 'yes', 'Yes'))
    
    if (-not (Test-Path $InstallerPath)) {
        Write-Host "❌ Installer not found at: $InstallerPath" -ForegroundColor Red
        Write-Host "Please download and save the installer to the above path" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "✅ Installer ready" -ForegroundColor Green

# Install Neo4j Desktop
Write-Host ""
Write-Host "🚀 Installing Neo4j Desktop..." -ForegroundColor Yellow
Write-Host "Please follow the installation wizard that opens." -ForegroundColor Cyan

try {
    Start-Process -FilePath $InstallerPath -Wait
    Write-Host "✅ Neo4j Desktop installation completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait for user to set up database
Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Launch Neo4j Desktop from Start Menu" -ForegroundColor White
Write-Host "2. Create a new project called 'RFP GraphRAG'" -ForegroundColor White
Write-Host "3. Add a local database with these settings:" -ForegroundColor White
Write-Host "   - Name: rfp-graphrag" -ForegroundColor Cyan
Write-Host "   - Password: rfpgraph123" -ForegroundColor Cyan
Write-Host "4. Start the database" -ForegroundColor White
Write-Host "5. Verify it's running at http://localhost:7474" -ForegroundColor White
Write-Host ""

$setupNow = Read-Host "Would you like to continue with database setup now? (y/n)"

if ($setupNow -in @('y', 'Y', 'yes', 'Yes')) {
    Write-Host ""
    Write-Host "🔧 Please complete the database setup in Neo4j Desktop..." -ForegroundColor Yellow
    Write-Host "When done, press Enter to continue with configuration" -ForegroundColor Cyan
    Read-Host
    
    # Update .env file
    $EnvPath = ".\.env"
    if (Test-Path $EnvPath) {
        Write-Host "📝 Updating .env file..." -ForegroundColor Yellow
        
        $envContent = Get-Content $EnvPath
        $newEnvContent = @()
        $neo4jSectionFound = $false
        
        foreach ($line in $envContent) {
            if ($line -match "^NEO4J_") {
                if (-not $neo4jSectionFound) {
                    $newEnvContent += "# Neo4j Configuration (for GraphRAG)"
                    $newEnvContent += "NEO4J_ENABLED=true"
                    $newEnvContent += "NEO4J_URI=bolt://localhost:7687"
                    $newEnvContent += "NEO4J_USERNAME=neo4j"
                    $newEnvContent += "NEO4J_PASSWORD=rfpgraph123"
                    $newEnvContent += "NEO4J_DATABASE=neo4j"
                    $neo4jSectionFound = $true
                }
                # Skip existing NEO4J lines
            } else {
                $newEnvContent += $line
            }
        }
        
        if (-not $neo4jSectionFound) {
            $newEnvContent += ""
            $newEnvContent += "# Neo4j Configuration (for GraphRAG)"
            $newEnvContent += "NEO4J_ENABLED=true"
            $newEnvContent += "NEO4J_URI=bolt://localhost:7687"
            $newEnvContent += "NEO4J_USERNAME=neo4j"
            $newEnvContent += "NEO4J_PASSWORD=rfpgraph123"
            $newEnvContent += "NEO4J_DATABASE=neo4j"
        }
        
        $newEnvContent | Out-File -FilePath $EnvPath -Encoding UTF8
        Write-Host "✅ .env file updated" -ForegroundColor Green
    } else {
        Write-Host "⚠️  .env file not found. Please update it manually with:" -ForegroundColor Yellow
        Write-Host "NEO4J_ENABLED=true" -ForegroundColor Cyan
        Write-Host "NEO4J_URI=bolt://localhost:7687" -ForegroundColor Cyan
        Write-Host "NEO4J_USERNAME=neo4j" -ForegroundColor Cyan
        Write-Host "NEO4J_PASSWORD=rfpgraph123" -ForegroundColor Cyan
        Write-Host "NEO4J_DATABASE=neo4j" -ForegroundColor Cyan
    }
}

# Test connection
Write-Host ""
Write-Host "🧪 Testing Neo4j connection..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://localhost:7474" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ Neo4j is running! (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "🌐 Web interface: http://localhost:7474" -ForegroundColor Cyan
    Write-Host "🔌 Bolt connection: bolt://localhost:7687" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Neo4j not responding yet. This is normal if you haven't started the database." -ForegroundColor Yellow
    Write-Host "Make sure to start your database in Neo4j Desktop" -ForegroundColor Cyan
}

# Cleanup
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Installation Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Ensure your Neo4j database is running in Neo4j Desktop" -ForegroundColor White
Write-Host "2. Start your RFP application backend: node src/server.js" -ForegroundColor White
Write-Host "3. Look for 'GraphRAG service initialized successfully' in logs" -ForegroundColor White
Write-Host "4. Test the Knowledge Graph tab in your application" -ForegroundColor White
Write-Host ""
Write-Host "Troubleshooting:" -ForegroundColor Yellow
Write-Host "- If connection fails, check database is started in Neo4j Desktop" -ForegroundColor White
Write-Host "- Verify password matches what you set (default: rfpgraph123)" -ForegroundColor White
Write-Host "- Check Windows Firewall isn't blocking ports 7474/7687" -ForegroundColor White

Read-Host "Press Enter to exit"