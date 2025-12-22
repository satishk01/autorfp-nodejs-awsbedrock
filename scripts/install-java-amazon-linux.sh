#!/bin/bash

# Java Installation Script for Amazon Linux 2023
# Run this first if you get "java: command not found"

set -e

echo "=== Java 17 Installation for Amazon Linux 2023 ==="
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

# Update system first
echo "📦 Updating system packages..."
sudo dnf update -y

# Install Java 17 OpenJDK
echo "☕ Installing Java 17 OpenJDK..."
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Set JAVA_HOME
echo "🔧 Setting up JAVA_HOME..."
JAVA_HOME_PATH="/usr/lib/jvm/java-17-openjdk"

# Add JAVA_HOME to profile
echo "export JAVA_HOME=$JAVA_HOME_PATH" | sudo tee -a /etc/profile
echo "export PATH=\$PATH:\$JAVA_HOME/bin" | sudo tee -a /etc/profile

# Add to current session
export JAVA_HOME=$JAVA_HOME_PATH
export PATH=$PATH:$JAVA_HOME/bin

# Add to user's bashrc
echo "export JAVA_HOME=$JAVA_HOME_PATH" >> ~/.bashrc
echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc

# Source the bashrc
source ~/.bashrc

# Verify installation
echo ""
echo "✅ Java installation completed!"
echo ""
echo "Java version:"
java -version
echo ""
echo "Java compiler version:"
javac -version
echo ""
echo "JAVA_HOME: $JAVA_HOME"

# Check if java command is available
if command -v java &> /dev/null; then
    echo "✅ Java command is available in PATH"
else
    echo "⚠️  Java command not found in PATH. You may need to restart your session."
    echo "Run: source ~/.bashrc"
fi

echo ""
echo "🎉 Java 17 is now ready for Neo4j installation!"
echo "You can now run the Neo4j installation script."