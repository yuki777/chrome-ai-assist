#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFEST_NAME = 'com.yuki777.chrome_ai_assist.mcp';
const TARGET_DIR = resolve(
  process.env.HOME,
  'Library/Application Support/Google/Chrome/NativeMessagingHosts'
);

function log(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

// 1. Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install --omit=dev', { cwd: ROOT, stdio: 'inherit' });
  log('Dependencies installed');
} catch {
  error('Failed to install dependencies');
}

// 2. Generate manifest JSON
const hostPath = resolve(ROOT, 'run-host.sh');
const templatePath = resolve(ROOT, 'manifests', `${MANIFEST_NAME}.json.template`);

let template;
try {
  template = readFileSync(templatePath, 'utf-8');
} catch {
  error(`Template not found: ${templatePath}`);
}

const manifest = template.replace(/__HOST_PATH__/g, hostPath);

// 3. Place manifest
mkdirSync(TARGET_DIR, { recursive: true });
const manifestDest = resolve(TARGET_DIR, `${MANIFEST_NAME}.json`);
writeFileSync(manifestDest, manifest);
log(`Manifest installed: ${manifestDest}`);

// 4. Make run-host.sh executable
chmodSync(hostPath, 0o755);
log(`Host script: ${hostPath}`);

// 5. Ping test
console.log('\n🔍 Running ping test...');
try {
  execSync('node test-ping.js', { cwd: ROOT, stdio: 'inherit' });
  log('Ping test passed');
} catch {
  console.warn('\x1b[33m⚠\x1b[0m Ping test failed (this is OK if Chrome is not running)');
}

console.log(`
\x1b[32m🎉 Setup complete!\x1b[0m

Next steps:
  1. Reload the extension in chrome://extensions
  2. Open the extension settings page
  3. Enter your Backlog / DocBase credentials
`);
