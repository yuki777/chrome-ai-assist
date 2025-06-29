#!/usr/bin/env node

// Test Native Messaging with DocBase MCP Server

import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('🧪 Testing Native Messaging + DocBase MCP Server...\n');

const hostPath = resolve('./host.js');
const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DOCBASE_DOMAIN: 'media-sys',
    DOCBASE_API_TOKEN: process.env.DOCBASE_API_TOKEN || 'docbase_MtV-jFC7ksQ38Fj6yTEkByBMrLcd_BBqg-sJX1eoTN9RC5vZ4sp6ap3p6o1gbzdo'
  }
});

const messages = [];
let messageId = 1;

// Send message to native host
function sendMessage(message) {
  const json = JSON.stringify({ ...message, id: messageId++ });
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  console.log(`📤 Sending: ${message.type}`);
  hostProcess.stdin.write(lengthBuffer);
  hostProcess.stdin.write(buffer);
}

// Read message from native host
async function readMessage() {
  return new Promise((resolve, reject) => {
    let messageLength = null;
    let chunks = [];
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 30000);
    
    const readHandler = () => {
      while (true) {
        if (messageLength === null) {
          const lengthBuffer = hostProcess.stdout.read(4);
          if (!lengthBuffer) break;
          messageLength = lengthBuffer.readUInt32LE(0);
        }
        
        const chunk = hostProcess.stdout.read(messageLength);
        if (!chunk) break;
        
        chunks.push(chunk);
        if (chunks.reduce((sum, c) => sum + c.length, 0) >= messageLength) {
          const message = Buffer.concat(chunks).toString('utf8');
          messageLength = null;
          chunks = [];
          
          clearTimeout(timeout);
          hostProcess.stdout.removeListener('readable', readHandler);
          
          try {
            const parsed = JSON.parse(message);
            messages.push(parsed);
            console.log(`📥 Received: ${parsed.type || 'unknown'}`);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
          return;
        }
      }
    };
    
    hostProcess.stdout.on('readable', readHandler);
  });
}

// Handle stderr
hostProcess.stderr.on('data', (data) => {
  console.log(`⚠️  Stderr: ${data.toString()}`);
});

hostProcess.on('error', (error) => {
  console.error(`❌ Host error: ${error.message}`);
  process.exit(1);
});

// Test sequence
async function runTest() {
  try {
    console.log('1️⃣  Testing connection...');
    sendMessage({ type: 'ping' });
    
    // Read multiple messages (debug + response)
    let response;
    while (true) {
      response = await readMessage();
      if (response.type !== 'debug') break;
    }
    
    if (response.type === 'response' && response.success && response.data?.pong) {
      console.log('✅ Connection established\n');
    } else {
      throw new Error('Unexpected response to ping');
    }
    
    console.log('2️⃣  Setting MCP configuration...');
    sendMessage({
      type: 'setMCPSettings',
      settings: {
        mcpServers: {
          docbase: {
            command: 'npx',
            args: ['-y', '@krayinc/docbase-mcp-server'],
            env: {
              DOCBASE_DOMAIN: 'media-sys',
              DOCBASE_API_TOKEN: process.env.DOCBASE_API_TOKEN || 'docbase_MtV-jFC7ksQ38Fj6yTEkByBMrLcd_BBqg-sJX1eoTN9RC5vZ4sp6ap3p6o1gbzdo'
            }
          }
        }
      }
    });
    
    // Wait for settings response
    while (true) {
      response = await readMessage();
      if (response.type === 'response' || response.type === 'error') break;
    }
    
    if (!response.success) {
      throw new Error(`Failed to set MCP settings: ${response.error}`);
    }
    
    console.log('✅ MCP settings configured\n');
    
    console.log('3️⃣  Connecting to DocBase MCP...');
    sendMessage({
      type: 'connect',
      server: 'docbase',
      config: {
        domain: 'media-sys'
      }
    });
    
    // Wait for connection response
    while (true) {
      response = await readMessage();
      if (response.type === 'response' || response.type === 'error') break;
    }
    
    if (!response.success) {
      throw new Error(`MCP connection failed: ${response.error}`);
    }
    
    console.log('✅ MCP connected\n');
    
    console.log('4️⃣  Listing available tools...');
    sendMessage({
      type: 'listTools',
      server: 'docbase'
    });
    
    // Wait for tools response
    while (true) {
      response = await readMessage();
      if (response.type === 'response' || response.type === 'error') break;
    }
    
    if (!response.success) {
      throw new Error(`Failed to list tools: ${response.error}`);
    }
    
    console.log('📋 Available tools:', response.data.tools.map(t => t.name).join(', '));
    console.log('');
    
    console.log('5️⃣  Getting post 3791373...');
    const startTime = Date.now();
    
    sendMessage({
      type: 'callTool',
      server: 'docbase',
      tool: 'getPost',
      args: {
        postId: 3791373
      }
    });
    
    // Wait for tool response
    while (true) {
      response = await readMessage();
      if (response.type === 'response' || response.type === 'error') break;
    }
    
    const endTime = Date.now();
    
    if (!response.success) {
      throw new Error(`Tool call failed: ${response.error}`);
    }
    
    console.log(`✅ Got post in ${endTime - startTime}ms`);
    console.log('\n📄 Post details:');
    
    const result = response.data;
    if (result && result.content && result.content[0]) {
      const data = result.content[0].text;
      const post = typeof data === 'string' ? JSON.parse(data) : data;
      
      console.log(`   Title: ${post.title}`);
      console.log(`   Author: ${post.author}`);
      console.log(`   Created: ${post.created_at}`);
      console.log(`   Tags: ${post.tags?.join(', ') || 'none'}`);
      console.log(`   URL: ${post.url}`);
      
      if (post.body) {
        console.log(`   Body preview: ${post.body.substring(0, 100)}...`);
      }
    }
    
    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean shutdown
    sendMessage({ type: 'disconnect', server: 'docbase' });
    
    setTimeout(() => {
      hostProcess.kill();
      process.exit(0);
    }, 1000);
  }
}

// Start test after setup
setTimeout(runTest, 500);

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted');
  hostProcess.kill();
  process.exit(1);
});
