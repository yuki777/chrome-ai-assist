#!/bin/bash
cd "$(dirname "$0")"
exec /usr/bin/env node src/host.js
