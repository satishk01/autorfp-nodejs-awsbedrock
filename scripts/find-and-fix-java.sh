#!/bin/bash

# Find and Fix Java on Amazon Linux 2023
# This script will locate Java wherever it is and set it up properly

echo "=== Java Detective - Finding and Fixing Java on Amazon Linux 2023 ==="
echo ""

# Check what we're working with
echo "🔍 System Information:"
cat /etc/os-release | grep PRETTY_NAME
echo "User: $(whoami)"
echo "Architecture: $(uname -m)"
echo ""

# Check if Java packages are installed
echo "📦 Checking installed Java packages..."
JAVA_PACKAGES=$(dnf list installed 2>/dev/null | grep -i openjdk || echo "none")
if [ "$JAVA_PACKAGES" = "none" ]; then
    echo "❌ No Java packages installed"
    NEED_INSTALL=true
else
    echo "✅ Found Java packages:"
    echo "$JAVA_PACKAGES"
    NEED_INSTALL=false
fi
echo ""

# Install Java if needed
if [ "$NEED_INSTALL" = true ]; then
    echo "📦 Installing Java 17..."
    sudo dnf update -y
    sudo dnf install -y java-17-openjdk java-17-openjdk-devel
    echo ""
fi

# Now let's find Java everywhere it might be
echo "🔍 Searching for Java installations system-wide..."

# Common locations where Java might be installed
SEARCH_PATHS=(
    "/usr/lib/jvm"
    "/usr/lib64/jvm"
    "/usr/java"
    "/opt/java"
    "/usr/local/java"
    "/usr/bin"
    "/usr/lib"
    "/usr/lib64"
    "/etc/alternatives"
)

JAVA_EXECUTABLES=()
JAVA_HOMES=()

# Search for java executables
echo "Looking for java executables..."
for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "  Searching in $path..."
        while IFS= read -r -d '' file; do
            if [ -x "$file" ] && [[ "$(basename "$file")" == "java" ]]; then
                echo "    ✅ Found: $file"
                JAVA_EXECUTABLES+=("$file")
                
                # Try to determine JAVA_HOME
                POTENTIAL_HOME=$(dirname $(dirname "$file"))
                if [ -d "$POTENTIAL_HOME" ] && [ -f "$POTENTIAL_HOME/bin/java" ]; then
                    JAVA_HOMES+=("$POTENTIAL_HOME")
                fi
            fi
        done < <(find "$path" -name "java" -type f -print0 2>/dev/null)
    fi
done

# Also search more broadly
echo "  Searching system-wide for java..."
SYSTEM_JAVA=$(find /usr -name "java" -type f -executable 2>/dev/null | head -10)
if [ -n "$SYSTEM_JAVA" ]; then
    echo "    System-wide java executables:"
    echo "$SYSTEM_JAVA" | while read line; do
        echo "      $line"
        JAVA_EXECUTABLES+=("$line")
    done
fi

echo ""

# Check alternatives system
echo "🔍 Checking alternatives system..."
if [ -x "/usr/sbin/alternatives" ] || [ -x "/usr/bin/alternatives" ]; then
    ALT_JAVA=$(alternatives --display java 2>/dev/null | grep "link currently points to" | awk '{print $NF}')
    if [ -n "$ALT_JAVA" ] && [ -x "$ALT_JAVA" ]; then
        echo "✅ Alternatives java: $ALT_JAVA"
        JAVA_EXECUTABLES+=("$ALT_JAVA")
        ALT_HOME=$(dirname $(dirname "$ALT_JAVA"))
        if [ -d "$ALT_HOME" ]; then
            JAVA_HOMES+=("$ALT_HOME")
        fi
    else
        echo "❌ No alternatives configured for java"
    fi
else
    echo "❌ Alternatives system not found"
fi

echo ""

# Remove duplicates and test each Java
echo "🧪 Testing found Java installations..."
WORKING_JAVA=""
WORKING_JAVA_HOME=""

# Test each unique Java executable
for java_exec in $(printf '%s\n' "${JAVA_EXECUTABLES[@]}" | sort -u); do
    echo "Testing: $java_exec"
    if [ -x "$java_exec" ]; then
        VERSION_OUTPUT=$($java_exec -version 2>&1)
        if [ $? -eq 0 ]; then
            echo "  ✅ Working! Version: $(echo "$VERSION_OUTPUT" | head -1)"
            WORKING_JAVA="$java_exec"
            
            # Determine JAVA_HOME
            JAVA_HOME_CANDIDATE=$(dirname $(dirname "$java_exec"))
            if [ -d "$JAVA_HOME_CANDIDATE" ] && [ -f "$JAVA_HOME_CANDIDATE/bin/java" ]; then
                WORKING_JAVA_HOME="$JAVA_HOME_CANDIDATE"
                echo "  ✅ JAVA_HOME: $WORKING_JAVA_HOME"
                break
            fi
        else
            echo "  ❌ Not working: $VERSION_OUTPUT"
        fi
    else
        echo "  ❌ Not executable"
    fi
done

echo ""

# If no working Java found, try package-specific locations
if [ -z "$WORKING_JAVA" ]; then
    echo "🔍 Trying package-specific locations..."
    
    # Amazon Linux specific paths
    AMAZON_PATHS=(
        "/usr/lib/jvm/java-17-amazon-corretto"
        "/usr/lib/jvm/java-17-openjdk"
        "/usr/lib/jvm/jre-17-openjdk"
        "/usr/lib/jvm/java-17"
        "/usr/lib/jvm/java-1.17.0-openjdk"
    )
    
    for path in "${AMAZON_PATHS[@]}"; do
        if [ -f "$path/bin/java" ] && [ -x "$path/bin/java" ]; then
            echo "✅ Found Amazon Linux Java: $path"
            WORKING_JAVA="$path/bin/java"
            WORKING_JAVA_HOME="$path"
            break
        fi
    done
fi

# If still no Java, install Amazon Corretto as alternative
if [ -z "$WORKING_JAVA" ]; then
    echo "❌ No working Java found. Installing Amazon Corretto..."
    
    # Install Amazon Corretto
    sudo dnf install -y java-17-amazon-corretto java-17-amazon-corretto-devel
    
    # Find Corretto installation
    CORRETTO_PATH=$(find /usr/lib/jvm -name "*corretto*" -type d 2>/dev/null | head -1)
    if [ -n "$CORRETTO_PATH" ] && [ -f "$CORRETTO_PATH/bin/java" ]; then
        WORKING_JAVA="$CORRETTO_PATH/bin/java"
        WORKING_JAVA_HOME="$CORRETTO_PATH"
        echo "✅ Installed Amazon Corretto at: $CORRETTO_PATH"
    fi
fi

# Final check
if [ -z "$WORKING_JAVA" ] || [ -z "$WORKING_JAVA_HOME" ]; then
    echo "❌ Could not find or install a working Java"
    echo ""
    echo "🔍 Debug information:"
    echo "Installed packages:"
    dnf list installed | grep -i java || echo "No Java packages found"
    echo ""
    echo "Directory contents:"
    ls -la /usr/lib/ | grep -i jvm || echo "No JVM directory in /usr/lib"
    ls -la /usr/lib64/ | grep -i jvm || echo "No JVM directory in /usr/lib64"
    echo ""
    echo "Manual installation required. Try:"
    echo "sudo dnf install -y java-17-amazon-corretto"
    exit 1
fi

echo "🎉 Found working Java!"
echo "Java executable: $WORKING_JAVA"
echo "JAVA_HOME: $WORKING_JAVA_HOME"
echo ""

# Test the working Java
echo "🧪 Testing working Java:"
$WORKING_JAVA -version
echo ""

# Set up environment
echo "🔧 Setting up environment..."

# Set for current session
export JAVA_HOME="$WORKING_JAVA_HOME"
export PATH="$WORKING_JAVA_HOME/bin:$PATH"

# Clean up bashrc
if [ -f ~/.bashrc ]; then
    cp ~/.bashrc ~/.bashrc.backup.$(date +%Y%m%d_%H%M%S)
    sed -i '/JAVA_HOME/d' ~/.bashrc
    sed -i '/java.*bin/d' ~/.bashrc
    sed -i '/# Java Environment/d' ~/.bashrc
fi

# Add to bashrc
cat >> ~/.bashrc << EOF

# Java Environment (auto-detected)
export JAVA_HOME="$WORKING_JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

# Add to system profile
sudo tee /etc/profile.d/java.sh > /dev/null << EOF
# Java Environment (auto-detected)
export JAVA_HOME="$WORKING_JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF

sudo chmod +x /etc/profile.d/java.sh

# Set up alternatives
echo "🔧 Setting up alternatives..."
sudo alternatives --install /usr/bin/java java "$WORKING_JAVA" 1
if [ -f "$WORKING_JAVA_HOME/bin/javac" ]; then
    sudo alternatives --install /usr/bin/javac javac "$WORKING_JAVA_HOME/bin/javac" 1
fi

# Create symlinks as backup
sudo ln -sf "$WORKING_JAVA" /usr/local/bin/java 2>/dev/null || true

echo "✅ Environment setup complete!"
echo ""

# Test current session
echo "🧪 Testing current session:"
if command -v java &> /dev/null; then
    echo "✅ java command available:"
    java -version
else
    echo "⚠️  java not in PATH yet, testing direct path:"
    $WORKING_JAVA -version
fi

echo ""

# Test new shell
echo "🧪 Testing new shell session:"
bash -c 'source ~/.bashrc && java -version' 2>/dev/null && echo "✅ Works in new shell" || echo "⚠️  May need session restart"

echo ""
echo "=== SETUP COMPLETE ==="
echo "JAVA_HOME: $WORKING_JAVA_HOME"
echo "Java executable: $WORKING_JAVA"
echo ""

# Create verification script
cat > ~/java-verification.sh << EOF
#!/bin/bash
echo "=== Java Verification Report ==="
echo "Date: \$(date)"
echo "User: \$(whoami)"
echo ""
echo "Environment Variables:"
echo "JAVA_HOME: \$JAVA_HOME"
echo "PATH: \$PATH"
echo ""
echo "Command Locations:"
echo "which java: \$(which java 2>/dev/null || echo 'NOT FOUND')"
echo "which javac: \$(which javac 2>/dev/null || echo 'NOT FOUND')"
echo ""
echo "Direct Path Test:"
echo "$WORKING_JAVA -version:"
$WORKING_JAVA -version 2>&1 || echo "FAILED"
echo ""
echo "Command Test:"
echo "java -version:"
java -version 2>&1 || echo "FAILED"
echo ""
echo "Alternatives:"
alternatives --display java 2>/dev/null | head -3 || echo "No alternatives"
EOF

chmod +x ~/java-verification.sh

echo "📝 Created ~/java-verification.sh for testing"
echo ""
echo "🎯 Next Steps:"
echo "1. Run: source ~/.bashrc"
echo "2. Test: java -version"
echo "3. If working: ./install-neo4j-amazon-linux.sh"
echo "4. If not working: ./java-verification.sh"
echo ""

# Final test
source ~/.bashrc 2>/dev/null || true
if java -version 2>/dev/null; then
    echo "🎉 SUCCESS! Java is now working!"
    echo "Ready to install Neo4j!"
else
    echo "⚠️  Java setup complete but may need session restart"
    echo "Try: source ~/.bashrc"
    echo "Or logout and login again"
fi