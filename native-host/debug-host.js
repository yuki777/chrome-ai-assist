#!/usr/bin/env node

// Debug script to check native host startup issues

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

console.log('🔍 Native Host Debug Check\n');

// 1. Check Node.js version
console.log('1. Node.js version:', process.version);

// 2. Check if host script exists and is readable
const hostPath = resolve('./host.js');
console.log('2. Host script path:', hostPath);
console.log('   Exists:', existsSync(hostPath));

if (existsSync(hostPath)) {
  try {
    const stats = readFileSync(hostPath, 'utf8');
    console.log('   Readable: Yes');
    console.log('   Size:', stats.length, 'bytes');
  } catch (error) {
    console.log('   Readable: No -', error.message);
  }
}

// 3. Check package.json and dependencies
const packagePath = resolve('./package.json');
if (existsSync(packagePath)) {
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    console.log('3. Package info:');
    console.log('   Name:', pkg.name);
    console.log('   Version:', pkg.version);
    console.log('   Dependencies:', Object.keys(pkg.dependencies || {}));
  } catch (error) {
    console.log('3. Package.json error:', error.message);
  }
}

// 4. Check MCP SDK import
console.log('4. Testing MCP SDK import...');
try {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  console.log('   MCP Client: ✅ Import successful');
} catch (error) {
  console.log('   MCP Client: ❌ Import failed -', error.message);
}

try {
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  console.log('   MCP StdioTransport: ✅ Import successful');
} catch (error) {
  console.log('   MCP StdioTransport: ❌ Import failed -', error.message);
}

// 5. Check Chrome manifest
const manifestPath = resolve('../manifest.json');
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    console.log('5. Chrome manifest:');
    console.log('   Has nativeMessaging permission:', 
      manifest.permissions?.includes('nativeMessaging') ? '✅' : '❌');
    console.log('   Background type:', manifest.background?.type || 'not specified');
  } catch (error) {
    console.log('5. Manifest error:', error.message);
  }
}

console.log('\n✅ Debug check completed');