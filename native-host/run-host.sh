#!/bin/bash
cd "$(dirname "$0")"

# Load .env file if it exists (Chrome doesn't inherit shell env vars)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

exec /usr/bin/env node src/host.js
