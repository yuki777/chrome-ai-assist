#!/usr/bin/env node

// Debug MCP server behavior in detail

import { spawn } from 'child_process';

console.log('🔍 Debugging DocBase MCP Server...\n');

const mcpProcess = spawn('/Users/adachi/.volta/bin/npx', ['-y', '@krayinc/docbase-mcp-server'], {
  env: {
    ...process.env,
    DOCBASE_DOMAIN: 'media-sys',
    DOCBASE_API_TOKEN: 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('📤 MCP Server spawned, sending initialization...');

// MCP initialization message
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'debug-client',
      version: '1.0.0'
    }
  }
};

function sendMCPMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json + '\n', 'utf8');
  console.log(`📤 Sending: ${json}`);
  mcpProcess.stdin.write(buffer);
}

let responseCount = 0;

mcpProcess.stdout.on('data', (data) => {
  responseCount++;
  console.log(`📥 Response ${responseCount}:`, data.toString());
});

mcpProcess.stderr.on('data', (data) => {
  console.log(`⚠️  stderr:`, data.toString());
});

mcpProcess.on('error', (error) => {
  console.error(`❌ Process error:`, error.message);
});

mcpProcess.on('exit', (code, signal) => {
  console.log(`🔚 Process exited with code ${code}, signal ${signal}`);
});

// Send initialization
setTimeout(() => {
  sendMCPMessage(initMessage);
  
  // Send tools/list after 2 seconds
  setTimeout(() => {
    sendMCPMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    
    // Send tools/call after 4 seconds
    setTimeout(() => {
      console.log('\n🎯 Attempting getPost call...');
      sendMCPMessage({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'getPost',
          arguments: {
            postId: 3791373
          }
        }
      });
      
      // Force exit after 15 seconds if no response
      setTimeout(() => {
        console.log('\n⏰ Forcing exit after 15 seconds...');
        mcpProcess.kill('SIGTERM');
        
        setTimeout(() => {
          console.log('🔚 Test completed');
          process.exit(0);
        }, 1000);
      }, 15000);
      
    }, 4000);
  }, 2000);
}, 1000);

process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted, killing MCP process...');
  mcpProcess.kill();
  process.exit(1);
});