#!/usr/bin/env bash
set -euo pipefail

MANIFEST_NAME="com.yuki777.chrome_ai_assist.mcp"
TARGET_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# Parse arguments
EXTENSION_ID=""
HOST_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --extension-id) EXTENSION_ID="$2"; shift 2 ;;
    --host-dir)     HOST_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Usage: $0 --extension-id <EXTENSION_ID> [--host-dir <path>]"
  echo ""
  echo "  --extension-id  Chrome拡張のID (chrome://extensions で確認)"
  echo "  --host-dir      native-host ディレクトリのパス (デフォルト: スクリプトの親ディレクトリ)"
  exit 1
fi

# Default host-dir to the native-host directory relative to this script
if [[ -z "$HOST_DIR" ]]; then
  HOST_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

HOST_PATH="${HOST_DIR}/run-host.sh"

# Verify host script exists
if [[ ! -f "$HOST_PATH" ]]; then
  echo "Error: Host script not found at ${HOST_PATH}"
  exit 1
fi

# Make run-host.sh executable
chmod +x "$HOST_PATH"

# Generate manifest from template
TEMPLATE="${HOST_DIR}/manifests/${MANIFEST_NAME}.json.template"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: Template not found at ${TEMPLATE}"
  exit 1
fi

MANIFEST_CONTENT=$(sed \
  -e "s|__HOST_PATH__|${HOST_PATH}|g" \
  -e "s|__EXTENSION_ID__|${EXTENSION_ID}|g" \
  "$TEMPLATE")

# Create target directory and write manifest
mkdir -p "$TARGET_DIR"
echo "$MANIFEST_CONTENT" > "${TARGET_DIR}/${MANIFEST_NAME}.json"

echo "Installed: ${TARGET_DIR}/${MANIFEST_NAME}.json"
echo "Host path: ${HOST_PATH}"
echo "Extension ID: ${EXTENSION_ID}"
echo ""
echo "Done. Reload the extension in chrome://extensions to pick up the new manifest."
