#!/usr/bin/env node

// Direct test of native host without Chrome extension

import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('🧪 Testing Native Host directly...\n');

const hostPath = resolve('./host.js');
console.log('Host path:', hostPath);

const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Monitor stderr for debug logs
hostProcess.stderr.on('data', (data) => {
  console.log(`📝 Host stderr: ${data.toString()}`);
});

// Monitor stdout
hostProcess.stdout.on('data', (data) => {
  console.log(`📤 Host stdout: ${data.toString()}`);
});

// Monitor exit
hostProcess.on('exit', (code, signal) => {
  console.log(`❌ Host exited with code: ${code}, signal: ${signal}`);
});

// Monitor error
hostProcess.on('error', (error) => {
  console.log(`💥 Host spawn error: ${error.message}`);
});

console.log('⏳ Host process started, waiting for 3 seconds...');

// Let it run for a few seconds to see if it stays alive
setTimeout(() => {
  console.log('⏹️ Terminating host process...');
  hostProcess.kill();
  process.exit(0);
}, 3000);