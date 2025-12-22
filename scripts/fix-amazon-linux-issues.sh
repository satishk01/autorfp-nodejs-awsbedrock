#!/bin/bash

# Amazon Linux 2023 Troubleshooting Script
# Fixes common issues when installing Neo4j

set -e

echo "=== Amazon Linux 2023 - Neo4j Installation Troubleshooting ==="
echo ""

# Function to check and fix Java installation
fix_java() {
    echo "🔍 Checking Java installation..."
    
    if command -v java &> /dev/null; then
        echo "✅ Java is installed:"
        java -version
        return 0
    else
        echo "❌ Java not found. Installing Java 17..."
        
        # Update system
        sudo dnf update -y
        
        # Install Java 17
        sudo dnf install -y java-17-openjdk java-17-openjdk-devel
        
        # Set JAVA_HOME
        JAVA_HOME_PATH="/usr/lib/jvm/java-17-openjdk"
        export JAVA_HOME=$JAVA_HOME_PATH
        export PATH=$PATH:$JAVA_HOME/bin
        
        # Add to bashrc
        echo "export JAVA_HOME=$JAVA_HOME_PATH" >> ~/.bashrc
        echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc
        
        # Verify
        if command -v java &> /dev/null; then
            echo "✅ Java installed successfully:"
            java -version
        else
            echo "❌ Java installation failed"
            return 1
        fi
    fi
}

# Function to check and install required packages
fix_packages() {
    echo "🔍 Checking required packages..."
    
    REQUIRED_PACKAGES="curl wget tar gzip nc"
    MISSING_PACKAGES=""
    
    for package in $REQUIRED_PACKAGES; do
        if ! command -v $package &> /dev/null; then
            MISSING_PACKAGES="$MISSING_PACKAGES $package"
        fi
    done
    
    if [ -n "$MISSING_PACKAGES" ]; then
        echo "📦 Installing missing packages:$MISSING_PACKAGES"
        
        # Map package names for dnf
        DNF_PACKAGES=""
        for package in $MISSING_PACKAGES; do
            case $package in
                "nc") DNF_PACKAGES="$DNF_PACKAGES nmap-ncat" ;;
                *) DNF_PACKAGES="$DNF_PACKAGES $package" ;;
            esac
        done
        
        sudo dnf install -y $DNF_PACKAGES
        echo "✅ Packages installed successfully"
    else
        echo "✅ All required packages are installed"
    fi
}

# Function to check firewall
fix_firewall() {
    echo "🔍 Checking firewall configuration..."
    
    if systemctl is-active --quiet firewalld; then
        echo "✅ Firewalld is active"
        
        # Check if Neo4j ports are open
        if ! sudo firewall-cmd --list-ports | grep -q "7474/tcp"; then
            echo "🔧 Opening Neo4j HTTP port (7474)..."
            sudo firewall-cmd --permanent --add-port=7474/tcp
        fi
        
        if ! sudo firewall-cmd --list-ports | grep -q "7687/tcp"; then
            echo "🔧 Opening Neo4j Bolt port (7687)..."
            sudo firewall-cmd --permanent --add-port=7687/tcp
        fi
        
        sudo firewall-cmd --reload
        echo "✅ Firewall configured for Neo4j"
        
    else
        echo "🔧 Starting firewalld..."
        sudo systemctl enable firewalld
        sudo systemctl start firewalld
        
        # Add Neo4j ports
        sudo firewall-cmd --permanent --add-port=7474/tcp
        sudo firewall-cmd --permanent --add-port=7687/tcp
        sudo firewall-cmd --reload
        
        echo "✅ Firewall started and configured"
    fi
    
    echo "Current open ports:"
    sudo firewall-cmd --list-ports
}

# Function to check system resources
check_resources() {
    echo "🔍 Checking system resources..."
    
    # Check memory
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    echo "Total Memory: ${TOTAL_MEM}MB"
    
    if [ $TOTAL_MEM -lt 2048 ]; then
        echo "⚠️  Warning: Less than 2GB RAM detected. Neo4j may run slowly."
        echo "   Recommended: t3.medium (4GB) or larger instance"
    else
        echo "✅ Sufficient memory for Neo4j"
    fi
    
    # Check disk space
    DISK_AVAIL=$(df -m / | awk 'NR==2{printf "%.0f", $4}')
    echo "Available Disk Space: ${DISK_AVAIL}MB"
    
    if [ $DISK_AVAIL -lt 5120 ]; then
        echo "⚠️  Warning: Less than 5GB disk space available"
        echo "   Neo4j needs space for data, logs, and temporary files"
    else
        echo "✅ Sufficient disk space for Neo4j"
    fi
}

# Function to fix permissions
fix_permissions() {
    echo "🔍 Checking and fixing permissions..."
    
    # Create neo4j user if it doesn't exist
    if ! id "neo4j" &>/dev/null; then
        echo "👤 Creating neo4j user..."
        sudo useradd -r -m -s /bin/bash neo4j
    else
        echo "✅ Neo4j user exists"
    fi
    
    # Create required directories
    DIRECTORIES="/var/lib/neo4j /var/log/neo4j /etc/neo4j"
    for dir in $DIRECTORIES; do
        if [ ! -d "$dir" ]; then
            echo "📁 Creating directory: $dir"
            sudo mkdir -p $dir
        fi
        sudo chown -R neo4j:neo4j $dir
    done
    
    echo "✅ Permissions configured"
}

# Function to test network connectivity
test_network() {
    echo "🔍 Testing network connectivity..."
    
    # Test internet connectivity
    if curl -s --connect-timeout 5 https://www.google.com > /dev/null; then
        echo "✅ Internet connectivity working"
    else
        echo "❌ No internet connectivity - check security groups and routing"
        return 1
    fi
    
    # Test Neo4j download URL
    if curl -s --head --connect-timeout 10 https://dist.neo4j.org/ | head -n 1 | grep -q "200 OK"; then
        echo "✅ Neo4j download site accessible"
    else
        echo "⚠️  Neo4j download site may be unreachable"
    fi
}

# Function to clean up previous installations
cleanup_previous() {
    echo "🔍 Checking for previous Neo4j installations..."
    
    # Stop service if running
    if systemctl is-active --quiet neo4j 2>/dev/null; then
        echo "🛑 Stopping existing Neo4j service..."
        sudo systemctl stop neo4j
    fi
    
    # Check for existing installations
    if [ -d "/opt/neo4j" ]; then
        echo "⚠️  Found existing Neo4j installation at /opt/neo4j"
        read -p "Remove existing installation? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf /opt/neo4j
            echo "✅ Removed existing installation"
        fi
    fi
    
    # Clean up systemd service
    if [ -f "/etc/systemd/system/neo4j.service" ]; then
        echo "🔧 Removing existing systemd service..."
        sudo systemctl disable neo4j 2>/dev/null || true
        sudo rm -f /etc/systemd/system/neo4j.service
        sudo systemctl daemon-reload
    fi
}

# Main execution
echo "Starting troubleshooting checks..."
echo ""

# Run all checks and fixes
fix_java
echo ""

fix_packages
echo ""

check_resources
echo ""

fix_firewall
echo ""

fix_permissions
echo ""

test_network
echo ""

cleanup_previous
echo ""

echo "=== Troubleshooting Complete ==="
echo ""
echo "✅ System is ready for Neo4j installation"
echo ""
echo "Next steps:"
echo "1. Run the Neo4j installation script:"
echo "   ./install-neo4j-amazon-linux.sh"
echo ""
echo "2. If you still encounter issues, check:"
echo "   - EC2 Security Group allows ports 7474, 7687"
echo "   - Instance has sufficient resources (t3.medium recommended)"
echo "   - Your IP address hasn't changed"
echo ""

# Final verification
echo "=== System Summary ==="
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Java: $(java -version 2>&1 | head -n1 | cut -d'"' -f2)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4}') available"
echo "Firewall: $(systemctl is-active firewalld)"
echo ""
echo "🎉 Ready to install Neo4j!"