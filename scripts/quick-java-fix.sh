#!/bin/bash

# Quick Java Fix for Amazon Linux 2023
# One-liner to install Java and set environment

echo "🚀 Quick Java 17 installation for Amazon Linux 2023..."

# Install Java
sudo dnf update -y && sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Set environment variables
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$PATH:$JAVA_HOME/bin

# Add to bashrc for persistence
echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk" >> ~/.bashrc
echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc

# Verify
echo "✅ Java installed:"
java -version

echo ""
echo "🎉 Java is ready! You can now run the Neo4j installation script."
echo "If java command still not found, run: source ~/.bashrc"