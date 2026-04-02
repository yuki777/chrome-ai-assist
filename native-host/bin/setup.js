#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFEST_NAME = 'com.yuki777.chrome_ai_assist.mcp';

// Chromium-based browsers and their data directories (macOS)
const BROWSERS = [
  { name: 'Google Chrome', dir: 'Google/Chrome' },
  { name: 'Comet', dir: 'Comet' },
  { name: 'Microsoft Edge', dir: 'Microsoft Edge' },
];

function log(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function warn(msg) {
  console.warn(`\x1b[33m⚠\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

// Detect if running as postinstall (skip npm install to avoid infinite loop)
const isPostinstall = process.env.npm_lifecycle_event === 'postinstall';

// 1. Install dependencies (only when run directly, not from postinstall)
if (!isPostinstall) {
  console.log('\n📦 Installing dependencies...');
  try {
    execSync('npm install --omit=dev', { cwd: ROOT, stdio: 'inherit' });
    log('Dependencies installed');
  } catch {
    error('Failed to install dependencies');
  }
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

// 3. Generate run-host.sh with absolute node path (Chrome GUI apps have minimal PATH)
const nodePath = process.execPath;
const runHostScript = `#!/bin/bash\ncd "$(dirname "$0")"\nexec "${nodePath}" src/host.js\n`;
writeFileSync(hostPath, runHostScript);
chmodSync(hostPath, 0o755);

// 4. Detect installed browsers and place manifest
const appSupport = resolve(process.env.HOME, 'Library/Application Support');
let installed = 0;

if (!isPostinstall) {
  log(`Host script: ${hostPath}`);
  console.log('\n🌐 Detecting browsers...');
}

for (const browser of BROWSERS) {
  const browserDir = resolve(appSupport, browser.dir);
  if (!existsSync(browserDir)) continue;

  const targetDir = resolve(browserDir, 'NativeMessagingHosts');
  mkdirSync(targetDir, { recursive: true });
  const manifestDest = resolve(targetDir, `${MANIFEST_NAME}.json`);
  writeFileSync(manifestDest, manifest);
  if (!isPostinstall) log(`${browser.name}: ${manifestDest}`);
  installed++;
}

if (installed === 0) {
  error('No supported browsers found');
}

if (isPostinstall) {
  log(`Native Host manifest installed (${installed} browser${installed > 1 ? 's' : ''})`);
} else {
  console.log('\n🔍 Running ping test...');
  try {
    execSync('node test-ping.js', { cwd: ROOT, stdio: 'inherit' });
    log('Ping test passed');
  } catch {
    warn('Ping test failed (this is OK if the browser is not running)');
  }

  console.log(`
\x1b[32m🎉 Setup complete!\x1b[0m (${installed} browser${installed > 1 ? 's' : ''})

Next steps:
  1. Reload the extension in chrome://extensions
  2. Open the extension settings page
  3. Enter your Backlog / DocBase credentials
`);
}
