#!/usr/bin/env node

// Test callTool message handling specifically

import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('🧪 Testing callTool message handling...\n');

const hostPath = resolve('./host.js');
const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Track all messages
const messages = [];

// Send test message
function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  hostProcess.stdin.write(lengthBuffer);
  hostProcess.stdin.write(buffer);
}

// Read response with proper buffering
let messageLength = null;
let messageBuffer = Buffer.alloc(0);

hostProcess.stdout.on('data', (data) => {
  messageBuffer = Buffer.concat([messageBuffer, data]);
  
  while (messageBuffer.length >= 4) {
    if (messageLength === null) {
      messageLength = messageBuffer.readUInt32LE(0);
      messageBuffer = messageBuffer.subarray(4);
      console.log(`📏 Expected message length: ${messageLength}`);
    }
    
    if (messageBuffer.length >= messageLength) {
      const messageData = messageBuffer.subarray(0, messageLength);
      messageBuffer = messageBuffer.subarray(messageLength);
      messageLength = null;
      
      try {
        const message = JSON.parse(messageData.toString('utf8'));
        console.log(`📥 Received message:`, JSON.stringify(message, null, 2));
        messages.push(message);
        
        // Check if this is the response we're waiting for
        if (message.id === 2 && message.type === 'response') {
          console.log('\n✅ Got callTool response!');
          console.log(`Success: ${message.success}`);
          console.log(`Error: ${message.error || 'none'}`);
          
          // Exit successfully
          setTimeout(() => {
            hostProcess.kill();
            process.exit(0);
          }, 1000);
        }
      } catch (error) {
        console.error(`❌ JSON parse error: ${error.message}`);
      }
    } else {
      // Need more data
      break;
    }
  }
});

// Handle stderr
hostProcess.stderr.on('data', (data) => {
  console.log(`📝 Host stderr: ${data.toString().trim()}`);
});

hostProcess.on('error', (error) => {
  console.error(`❌ Host error: ${error.message}`);
});

hostProcess.on('exit', (code, signal) => {
  console.log(`\n⏹️ Host exited with code: ${code}, signal: ${signal}`);
  console.log(`Total messages received: ${messages.length}`);
  process.exit(1);
});

// Test sequence
setTimeout(async () => {
  console.log('1️⃣ Sending setMCPSettings...');
  sendMessage({
    type: 'setMCPSettings',
    id: 1,
    settings: {
      mcpServers: {
        docbase: {
          command: 'npx',
          args: ['-y', '@krayinc/docbase-mcp-server'],
          env: {
            DOCBASE_DOMAIN: 'media-sys',
            DOCBASE_API_TOKEN: 'docbase_MtV-jFC7ksQ38Fj6yTEkByBMrLcd_BBqg-sJX1eoTN9RC5vZ4sp6ap3p6o1gbzdo'
          }
        }
      }
    }
  });
  
  // Wait a bit for settings to be processed
  setTimeout(() => {
    console.log('\n2️⃣ Sending callTool request...');
    sendMessage({
      type: 'callTool',
      id: 2,
      server: 'docbase',
      tool: 'searchPosts',
      args: { q: 'test', per_page: 1 }
    });
    
    // Set a timeout for the test
    setTimeout(() => {
      console.log('\n⏱️ Test timeout - no response received');
      hostProcess.kill();
      process.exit(1);
    }, 70000); // 70 seconds to account for MCP timeout
  }, 2000);
}, 1000);

process.on('SIGINT', () => {
  hostProcess.kill();
  process.exit(1);
});