#!/usr/bin/env node

// Simple test for DocBase MCP via Native Messaging

import { spawn } from 'child_process';
import { resolve } from 'path';

const hostPath = resolve('./host.js');
const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;

function sendMessage(message) {
  const json = JSON.stringify({ ...message, id: messageId++ });
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  console.log(`\n📤 Sending ${message.type}:`, JSON.stringify(message, null, 2));
  hostProcess.stdin.write(lengthBuffer);
  hostProcess.stdin.write(buffer);
}

hostProcess.stdout.on('data', (data) => {
  console.log(`📥 stdout:`, data);
});

hostProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => console.log(`⚠️  ${line}`));
});

// Test sequence
setTimeout(() => {
  // 1. Ping
  sendMessage({ type: 'ping' });
  
  // 2. Set MCP config after 1 second
  setTimeout(() => {
    sendMessage({
      type: 'setMCPSettings',
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
    
    // 3. Connect after another second
    setTimeout(() => {
      sendMessage({
        type: 'connect',
        server: 'docbase'
      });
      
      // 4. List tools after 2 seconds
      setTimeout(() => {
        sendMessage({
          type: 'listTools',
          server: 'docbase'
        });
        
        // 5. Test search instead of getPost
        setTimeout(() => {
          console.log('\n🔍 Testing searchPosts instead of getPost...');
          sendMessage({
            type: 'callTool',
            server: 'docbase',
            tool: 'searchPosts',
            args: {
              q: 'test',
              per_page: 1
            }
          });
          
          // End after 10 seconds
          setTimeout(() => {
            console.log('\n✅ Test complete, shutting down...');
            hostProcess.kill();
            process.exit(0);
          }, 10000);
        }, 2000);
      }, 2000);
    }, 1000);
  }, 1000);
}, 500);

// Handle exit
process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted');
  hostProcess.kill();
  process.exit(1);
});