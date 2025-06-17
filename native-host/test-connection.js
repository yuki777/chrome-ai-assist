#!/usr/bin/env node

// Test script for Native Messaging Host connection

import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('Testing Native Messaging Host connection...\n');

// Test 1: Basic Node.js execution
console.log('1. Testing Node.js execution...');
const nodeProcess = spawn('node', ['--version']);
nodeProcess.stdout.on('data', (data) => {
  console.log(`   Node.js version: ${data.toString().trim()}`);
});
nodeProcess.on('error', (error) => {
  console.error(`   Error: ${error.message}`);
});

// Test 2: Host script existence
console.log('\n2. Checking host script...');
const hostPath = resolve('./host.js');
console.log(`   Host path: ${hostPath}`);

// Test 3: Test message exchange
console.log('\n3. Testing message exchange...');
const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageReceived = false;

// Send test message
function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  hostProcess.stdin.write(lengthBuffer);
  hostProcess.stdin.write(buffer);
}

// Read response
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let messageLength = null;
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 5000);
    
    hostProcess.stdout.on('readable', () => {
      while (true) {
        if (messageLength === null) {
          const lengthBuffer = hostProcess.stdout.read(4);
          if (!lengthBuffer) break;
          messageLength = lengthBuffer.readUInt32LE(0);
        }
        
        const chunk = hostProcess.stdout.read(messageLength);
        if (!chunk) break;
        
        chunks.push(chunk);
        const message = Buffer.concat(chunks).toString('utf8');
        messageLength = null;
        
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(message));
        } catch (e) {
          reject(e);
        }
        return;
      }
    });
  });
}

// Handle stderr
hostProcess.stderr.on('data', (data) => {
  console.log(`   Host stderr: ${data.toString()}`);
});

hostProcess.on('error', (error) => {
  console.error(`   Host error: ${error.message}`);
});

// Send ping message
setTimeout(async () => {
  console.log('\n   Sending ping message...');
  sendMessage({ type: 'ping', id: 1 });
  
  try {
    const response = await readMessage();
    console.log('   Response received:', JSON.stringify(response, null, 2));
    
    if (response.type === 'debug') {
      // Read actual response
      const actualResponse = await readMessage();
      console.log('   Actual response:', JSON.stringify(actualResponse, null, 2));
    }
    
    messageReceived = true;
  } catch (error) {
    console.error('   Error reading response:', error.message);
  } finally {
    hostProcess.kill();
    process.exit(messageReceived ? 0 : 1);
  }
}, 1000);

process.on('SIGINT', () => {
  hostProcess.kill();
  process.exit(1);
});