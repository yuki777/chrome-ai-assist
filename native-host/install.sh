#!/bin/bash

# Chrome AI Assist Native Messaging Host Installer for macOS

set -e

MANIFEST_FILE="com.chrome-ai-assist.mcp-bridge.json"
NATIVE_HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

echo "Installing Chrome AI Assist Native Messaging Host..."

# ディレクトリを作成
mkdir -p "$NATIVE_HOST_DIR"

# 拡張機能IDの確認を求める
echo ""
echo "拡張機能IDを確認してください:"
echo "1. Chromeで chrome://extensions/ を開く"
echo "2. デベロッパーモードを有効にする"
echo "3. Chrome AI Assistの拡張機能IDをコピーする"
echo ""
read -p "拡張機能ID (例: abcdefghijklmnopqrstuvwxyzabcdef): " EXTENSION_ID

if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
    echo "エラー: 無効な拡張機能IDです。32文字の小文字英字（a-p）である必要があります。"
    exit 1
fi

# マニフェストファイルを更新
cat > "$MANIFEST_FILE" << EOF
{
  "name": "com.chrome-ai-assist.mcp-bridge",
  "description": "Chrome AI Assist MCP Bridge",
  "path": "$(pwd)/mcp-bridge.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
EOF

# マニフェストファイルをコピー
cp "$MANIFEST_FILE" "$NATIVE_HOST_DIR/"

echo "インストール完了!"
echo "マニフェストファイル: $NATIVE_HOST_DIR/$MANIFEST_FILE"
echo ""
echo "次の手順:"
echo "1. Chromeを再起動してください"
echo "2. Chrome AI Assistを有効化してください"
echo "3. MCPサーバとの接続をテストしてください"