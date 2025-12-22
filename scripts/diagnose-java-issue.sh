#!/bin/bash

# Java Diagnostic and Fix Script for Amazon Linux 2023
# This script will diagnose and fix Java PATH issues

echo "=== Java Diagnostic and Fix Tool ==="
echo ""

# Check current user
echo "🔍 Current user: $(whoami)"
echo "🔍 Current shell: $SHELL"
echo ""

# Check if Java packages are installed
echo "📦 Checking installed Java packages..."
dnf list installed | grep -i openjdk || echo "❌ No OpenJDK packages found"
echo ""

# Try to find Java installations
echo "🔍 Searching for Java installations..."
JAVA_LOCATIONS=(
    "/usr/lib/jvm/java-17-openjdk"
    "/usr/lib/jvm/java-17-openjdk-17*"
    "/usr/lib/jvm/jre-17-openjdk"
    "/usr/lib/jvm/java-17"
    "/usr/bin/java"
    "/etc/alternatives/java"
)

FOUND_JAVA=""
for location in "${JAVA_LOCATIONS[@]}"; do
    if ls $location 2>/dev/null; then
        echo "✅ Found Java at: $location"
        if [ -x "$location/bin/java" ]; then
            FOUND_JAVA="$location"
            echo "   ✅ Executable java found at: $location/bin/java"
            $location/bin/java -version
        elif [ -x "$location" ] && [[ "$location" == *"/java" ]]; then
            echo "   ✅ Direct java executable: $location"
            $location -version
        fi
        echo ""
    fi
done

if [ -z "$FOUND_JAVA" ]; then
    echo "❌ No working Java installation found. Installing now..."
    
    # Install Java
    echo "📦 Installing Java 17..."
    sudo dnf update -y
    sudo dnf install -y java-17-openjdk java-17-openjdk-devel
    
    # Find the installation again
    for location in "${JAVA_LOCATIONS[@]}"; do
        if ls $location 2>/dev/null && [ -x "$location/bin/java" ]; then
            FOUND_JAVA="$location"
            break
        fi
    done
fi

if [ -n "$FOUND_JAVA" ]; then
    echo "✅ Using Java installation at: $FOUND_JAVA"
    JAVA_HOME="$FOUND_JAVA"
    JAVA_BIN="$FOUND_JAVA/bin"
else
    # Try alternatives system
    echo "🔍 Checking alternatives system..."
    if [ -x "/etc/alternatives/java" ]; then
        JAVA_ALT_PATH=$(readlink -f /etc/alternatives/java)
        JAVA_HOME=$(dirname $(dirname $JAVA_ALT_PATH))
        JAVA_BIN="$JAVA_HOME/bin"
        echo "✅ Found Java via alternatives: $JAVA_HOME"
    else
        echo "❌ Could not locate Java installation"
        exit 1
    fi
fi

# Check current PATH
echo "🔍 Current PATH:"
echo "$PATH" | tr ':' '\n' | nl
echo ""

# Check if Java is in PATH
if command -v java &> /dev/null; then
    echo "✅ Java is in PATH: $(which java)"
    java -version
else
    echo "❌ Java is NOT in PATH"
    
    # Add Java to PATH for current session
    echo "🔧 Adding Java to PATH for current session..."
    export JAVA_HOME="$JAVA_HOME"
    export PATH="$JAVA_BIN:$PATH"
    
    echo "Testing java command..."
    if command -v java &> /dev/null; then
        echo "✅ Java now works in current session:"
        java -version
    else
        echo "❌ Still can't find java command"
    fi
fi

echo ""

# Fix PATH permanently
echo "🔧 Making PATH changes permanent..."

# Remove any existing JAVA_HOME entries from bashrc
sed -i '/JAVA_HOME/d' ~/.bashrc
sed -i '/java.*bin/d' ~/.bashrc

# Add new JAVA_HOME and PATH
echo "" >> ~/.bashrc
echo "# Java Environment (added by Neo4j setup)" >> ~/.bashrc
echo "export JAVA_HOME=\"$JAVA_HOME\"" >> ~/.bashrc
echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\"" >> ~/.bashrc

# Also add to profile for system-wide access
sudo tee -a /etc/profile.d/java.sh > /dev/null <<EOF
# Java Environment
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

sudo chmod +x /etc/profile.d/java.sh

echo "✅ Added Java environment to ~/.bashrc and /etc/profile.d/java.sh"

# Test in a new shell
echo ""
echo "🧪 Testing in a new shell session..."
bash -c 'source ~/.bashrc && java -version' && echo "✅ Java works in new shell" || echo "❌ Java still not working in new shell"

echo ""
echo "=== Summary ==="
echo "JAVA_HOME: $JAVA_HOME"
echo "Java binary: $JAVA_BIN/java"
echo ""

# Create a test script
cat > ~/test-java.sh << EOF
#!/bin/bash
echo "=== Java Test ==="
echo "JAVA_HOME: \$JAVA_HOME"
echo "PATH: \$PATH"
echo "Which java: \$(which java 2>/dev/null || echo 'not found')"
echo "Java version:"
java -version 2>&1 || echo "Java command failed"
EOF

chmod +x ~/test-java.sh

echo "📝 Created ~/test-java.sh for testing"
echo ""
echo "=== Next Steps ==="
echo "1. Run: source ~/.bashrc"
echo "2. Test: java -version"
echo "3. If still not working, run: ~/test-java.sh"
echo "4. If working, proceed with Neo4j installation"
echo ""

# Final test
echo "🔍 Final test (current session):"
if command -v java &> /dev/null; then
    echo "✅ Java command available"
    java -version
    echo ""
    echo "🎉 Java is ready! You can now install Neo4j."
else
    echo "❌ Java command still not available"
    echo ""
    echo "🔧 Manual fix required:"
    echo "1. Run: source ~/.bashrc"
    echo "2. Or logout and login again"
    echo "3. Or run: export PATH=\"$JAVA_BIN:\$PATH\""
fi