#!/bin/bash

# One-click setup script inspired by major extensions

set -e

echo "🚀 Chrome AI Assist - One-Click Setup"
echo "======================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is currently macOS only"
    echo "For other platforms, please use ./auto-install.sh"
    exit 1
fi

# Check if Chrome is running
if pgrep -x "Google Chrome" > /dev/null; then
    echo "⚠️  Chrome is currently running"
    echo "Please quit Chrome completely (Chrome → Quit) and run this script again"
    exit 1
fi

echo "🔍 Step 1: Checking dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check npm dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔍 Step 2: Detecting Chrome AI Assist extension..."

# Function to find extension ID
find_extension_id() {
    local chrome_profile_dir="$HOME/Library/Application Support/Google/Chrome"
    local extension_name="Chrome AI Assist"
    
    # Search in preferences files for our extension
    if [ -d "$chrome_profile_dir" ]; then
        # This is a simplified approach - in practice, we'd parse Chrome's preferences
        echo "Please manually provide your extension ID for now"
        echo "We're working on automatic detection for future versions"
        return 1
    fi
    return 1
}

# Try to detect extension ID automatically
EXTENSION_ID=""
if find_extension_id; then
    echo "✅ Extension ID detected: $EXTENSION_ID"
else
    echo "📋 Please provide your Chrome AI Assist extension ID:"
    echo ""
    echo "   1. Open Chrome and go to: chrome://extensions/"
    echo "   2. Find 'Chrome AI Assist' extension"
    echo "   3. Copy the ID (32-character string like 'abcdef...123456')"
    echo ""
    read -p "Extension ID: " EXTENSION_ID
fi

# Validate extension ID
if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
    echo "❌ Invalid extension ID format"
    exit 1
fi

echo "🔍 Step 3: Setting up Native Messaging..."

# Create Chrome directory
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$CHROME_DIR"

# Get absolute path to host script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_PATH="$SCRIPT_DIR/host.js"

# Make sure host script is executable
chmod +x "$HOST_PATH"

# Create manifest
cat > "$CHROME_DIR/com.chrome_ai_assist.mcp_bridge.json" << EOF
{
  "name": "com.chrome_ai_assist.mcp_bridge",
  "description": "Chrome AI Assist MCP Bridge",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✅ Native Messaging Host installed"

echo ""
echo "🎉 Setup Complete!"
echo "==================="
echo ""
echo "Next steps:"
echo "1. Start Chrome"
echo "2. Go to a DocBase page"
echo "3. Click the Chrome AI Assist icon"
echo "4. Check the debug panel for MCP connection status"
echo ""
echo "If you encounter any issues:"
echo "- Make sure Chrome AI Assist extension is enabled"
echo "- Try reloading the extension in chrome://extensions/"
echo "- Check the console for error messages"
echo ""
echo "Enjoy using Chrome AI Assist with MCP! 🚀"