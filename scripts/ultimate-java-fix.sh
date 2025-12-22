#!/bin/bash

# Ultimate Java Fix for Amazon Linux 2023
# This script will definitely get Java working

echo "🚀 Ultimate Java Fix for Amazon Linux 2023"
echo "This will install Java and fix PATH issues"
echo ""

# Install Java if not present
echo "📦 Installing/Updating Java..."
sudo dnf update -y
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Find the actual Java installation
echo "🔍 Finding Java installation..."
JAVA_PATHS=(
    "/usr/lib/jvm/java-17-openjdk"
    "/usr/lib/jvm/java-17-openjdk-17"*
    "/usr/lib/jvm/jre-17-openjdk"
)

JAVA_HOME=""
for path in "${JAVA_PATHS[@]}"; do
    if [ -d "$path" ] && [ -x "$path/bin/java" ]; then
        JAVA_HOME="$path"
        break
    fi
done

# If not found, search more broadly
if [ -z "$JAVA_HOME" ]; then
    echo "🔍 Searching more broadly..."
    JAVA_HOME=$(find /usr/lib/jvm -name "java-17-openjdk*" -type d | head -1)
fi

# If still not found, use alternatives
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "🔍 Using alternatives system..."
    if [ -x "/etc/alternatives/java" ]; then
        ALT_JAVA=$(readlink -f /etc/alternatives/java)
        JAVA_HOME=$(dirname $(dirname $ALT_JAVA))
    fi
fi

if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "❌ Could not find Java installation"
    echo "Installed packages:"
    dnf list installed | grep openjdk
    echo ""
    echo "Available Java files:"
    find /usr -name "java" -type f 2>/dev/null | head -10
    exit 1
fi

echo "✅ Found Java at: $JAVA_HOME"

# Test the Java installation
echo "🧪 Testing Java installation..."
$JAVA_HOME/bin/java -version

# Set environment variables for current session
export JAVA_HOME="$JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo ""
echo "🔧 Setting up environment..."

# Clean up existing Java entries in bashrc
if [ -f ~/.bashrc ]; then
    # Create backup
    cp ~/.bashrc ~/.bashrc.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remove old Java entries
    sed -i '/JAVA_HOME/d' ~/.bashrc
    sed -i '/java.*bin/d' ~/.bashrc
    sed -i '/# Java Environment/d' ~/.bashrc
fi

# Add new Java environment to bashrc
cat >> ~/.bashrc << EOF

# Java Environment (added by ultimate-java-fix)
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

# Also add to system-wide profile
sudo tee /etc/profile.d/java.sh > /dev/null << EOF
# Java Environment
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

sudo chmod +x /etc/profile.d/java.sh

# Set up alternatives (this ensures java command is available system-wide)
echo "🔧 Setting up alternatives..."
sudo alternatives --install /usr/bin/java java $JAVA_HOME/bin/java 1
sudo alternatives --install /usr/bin/javac javac $JAVA_HOME/bin/javac 1

# Set as default
sudo alternatives --set java $JAVA_HOME/bin/java
sudo alternatives --set javac $JAVA_HOME/bin/javac

echo ""
echo "✅ Environment setup complete!"

# Test in current session
echo "🧪 Testing in current session..."
if command -v java &> /dev/null; then
    echo "✅ Java command available:"
    java -version
else
    echo "⚠️  Java not in PATH yet, but will be after reload"
fi

# Test in new shell
echo ""
echo "🧪 Testing in new shell..."
bash -c 'source ~/.bashrc && java -version' 2>/dev/null && echo "✅ Java works in new shell" || echo "⚠️  May need to restart session"

echo ""
echo "=== SETUP COMPLETE ==="
echo "JAVA_HOME: $JAVA_HOME"
echo "Java binary: $JAVA_HOME/bin/java"
echo ""
echo "🎯 Next steps:"
echo "1. Run: source ~/.bashrc"
echo "2. Test: java -version"
echo "3. If working, proceed with: ./install-neo4j-amazon-linux.sh"
echo ""

# Create a verification script
cat > ~/verify-java.sh << EOF
#!/bin/bash
echo "=== Java Verification ==="
echo "Date: \$(date)"
echo "User: \$(whoami)"
echo "Shell: \$SHELL"
echo ""
echo "Environment:"
echo "JAVA_HOME: \$JAVA_HOME"
echo "PATH: \$PATH"
echo ""
echo "Commands:"
echo "which java: \$(which java 2>/dev/null || echo 'NOT FOUND')"
echo "which javac: \$(which javac 2>/dev/null || echo 'NOT FOUND')"
echo ""
echo "Java version:"
java -version 2>&1 || echo "JAVA COMMAND FAILED"
echo ""
echo "Alternatives:"
alternatives --display java 2>/dev/null | head -5 || echo "No alternatives configured"
EOF

chmod +x ~/verify-java.sh

echo "📝 Created ~/verify-java.sh for verification"
echo ""
echo "🔄 Reloading environment..."
source ~/.bashrc

echo ""
echo "🎉 FINAL TEST:"
if java -version 2>/dev/null; then
    echo "✅ SUCCESS! Java is working!"
    echo "You can now install Neo4j with: ./install-neo4j-amazon-linux.sh"
else
    echo "⚠️  Java command not available yet."
    echo "Please run: source ~/.bashrc"
    echo "Or logout and login again"
    echo "Then test with: java -version"
fi