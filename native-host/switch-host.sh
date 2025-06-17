#!/bin/bash

# Script to switch between mock and real MCP host versions

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MANIFEST_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chrome_ai_assist.mcp_bridge.json"

case "$1" in
    "mock")
        echo "🎭 Switching to MOCK version..."
        HOST_PATH="$SCRIPT_DIR/host-mock.js"
        ;;
    "real")
        echo "🚀 Switching to REAL version..."
        HOST_PATH="$SCRIPT_DIR/host.js"
        ;;
    "simple")
        echo "🔧 Switching to SIMPLE version..."
        HOST_PATH="$SCRIPT_DIR/host-simple.js"
        ;;
    *)
        echo "Usage: $0 {mock|real|simple}"
        echo ""
        echo "mock   - Use mock MCP servers for testing"
        echo "real   - Use actual MCP servers (with full SDK)"
        echo "simple - Use simple MCP connection test"
        exit 1
        ;;
esac

# Update manifest file
sed -i '' "s|\"path\": \".*\"|\"path\": \"$HOST_PATH\"|" "$MANIFEST_PATH"

echo "✅ Updated manifest to use: $HOST_PATH"
echo ""
echo "Next steps:"
echo "1. Reload Chrome extension at chrome://extensions/"
echo "2. Test MCP functionality"
echo ""
echo "Current manifest:"
cat "$MANIFEST_PATH"