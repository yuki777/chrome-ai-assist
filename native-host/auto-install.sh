#!/bin/bash

# Automatic installer that detects extension ID

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_NAME="com.chrome_ai_assist.mcp_bridge"
MANIFEST_FILE="$SCRIPT_DIR/$HOST_NAME.json"

# Chrome manifest locations
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_USER_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_USER_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    CHROME_USER_DIR="$LOCALAPPDATA/Google/Chrome/User Data/NativeMessagingHosts"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "🔧 Chrome AI Assist - Native Host Auto-Installer"
echo ""

# Create directory if it doesn't exist
mkdir -p "$CHROME_USER_DIR"

# Try to detect extension ID automatically
EXTENSION_NAME="Chrome AI Assist"
echo "🔍 Looking for Chrome AI Assist extension..."

# Check if user provided extension ID manually
if [ ! -z "$1" ]; then
    EXTENSION_ID=$1
    echo "✅ Using provided extension ID: $EXTENSION_ID"
else
    echo "❗ Extension ID not provided"
    echo ""
    echo "Please find your extension ID:"
    echo "1. Open chrome://extensions/"
    echo "2. Find 'Chrome AI Assist' extension"
    echo "3. Copy the ID (32 character string)"
    echo ""
    echo "Then run: ./auto-install.sh YOUR_EXTENSION_ID"
    exit 1
fi

# Validate extension ID format
if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
    echo "❌ Invalid extension ID format. Should be 32 lowercase letters (a-p)"
    exit 1
fi

# Create manifest with correct paths and extension ID
cat > "$CHROME_USER_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Chrome AI Assist MCP Bridge",
  "path": "$SCRIPT_DIR/host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✅ Native messaging host installed successfully!"
echo ""
echo "📍 Manifest location: $CHROME_USER_DIR/$HOST_NAME.json"
echo "🚀 Host executable: $SCRIPT_DIR/host.js"
echo ""
echo "⚠️  Next steps:"
echo "1. Ensure your extension has 'nativeMessaging' permission"
echo "2. Reload your Chrome extension"
echo "3. Test the MCP connection on a DocBase page"