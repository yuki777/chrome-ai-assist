#!/bin/bash

# Native Messaging Host installer for Chrome AI Assist

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_NAME="com.chrome_ai_assist.mcp_bridge"
MANIFEST_FILE="$SCRIPT_DIR/$HOST_NAME.json"

# Chrome manifest locations on macOS
CHROME_USER_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
CHROME_SYSTEM_DIR="/Library/Google/Chrome/NativeMessagingHosts"

# Create directory if it doesn't exist
mkdir -p "$CHROME_USER_DIR"

# Get the Chrome extension ID from user or use placeholder
if [ -z "$1" ]; then
    echo "Usage: ./install.sh <extension-id>"
    echo "You can find your extension ID in chrome://extensions/"
    echo "Example: ./install.sh abcdefghijklmnopqrstuvwxyz123456"
    exit 1
fi

EXTENSION_ID=$1

# Create temporary manifest with correct extension ID
TEMP_MANIFEST="/tmp/$HOST_NAME.json"
sed "s/YOUR_EXTENSION_ID_HERE/$EXTENSION_ID/g" "$MANIFEST_FILE" > "$TEMP_MANIFEST"

# Copy manifest to Chrome directory
cp "$TEMP_MANIFEST" "$CHROME_USER_DIR/$HOST_NAME.json"
rm "$TEMP_MANIFEST"

echo "Native messaging host installed successfully!"
echo "Manifest location: $CHROME_USER_DIR/$HOST_NAME.json"
echo "Host executable: $SCRIPT_DIR/host.js"
echo ""
echo "Make sure to:"
echo "1. Add 'nativeMessaging' permission to your extension's manifest.json"
echo "2. Reload your Chrome extension"