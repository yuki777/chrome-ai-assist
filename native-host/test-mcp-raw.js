#!/usr/bin/env node

// Test MCP server directly with raw JSON-RPC messages

import { spawn } from 'child_process';

console.log('🔍 Testing DocBase MCP Server with raw JSON-RPC...\n');

const mcpProcess = spawn('npx', ['-y', '@krayinc/docbase-mcp-server'], {
  env: {
    ...process.env,
    DOCBASE_DOMAIN: 'media-sys',
    DOCBASE_API_TOKEN: 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;
const pendingRequests = new Map();

// Parse JSON-RPC messages from stdout
let buffer = '';
mcpProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log(`📥 Response:`, JSON.stringify(message, null, 2));
        
        if (message.id && pendingRequests.has(message.id)) {
          const { resolve } = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          resolve(message);
        }
      } catch (e) {
        console.log(`📥 Raw output: ${line}`);
      }
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  console.log(`⚠️  stderr:`, data.toString());
});

mcpProcess.on('error', (error) => {
  console.error(`❌ Process error:`, error.message);
});

// Send JSON-RPC message
function sendMessage(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    pendingRequests.set(id, { resolve, reject });
    
    const json = JSON.stringify(message);
    console.log(`\n📤 Request: ${method}`);
    console.log(`   Payload: ${json}`);
    
    // Write with newline
    mcpProcess.stdin.write(json + '\n');
    
    // Force flush
    if (mcpProcess.stdin.write('')) {
      console.log(`   ✅ Write buffer clear`);
    } else {
      console.log(`   ⚠️  Write buffer full, waiting for drain...`);
      mcpProcess.stdin.once('drain', () => {
        console.log(`   ✅ Write buffer drained`);
      });
    }
    
    // Timeout
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }
    }, 15000);
  });
}

// Test sequence
async function runTest() {
  try {
    // 1. Initialize
    console.log('1️⃣  Initializing MCP connection...');
    const initResponse = await sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    console.log('✅ Initialized');
    
    // 2. List tools
    console.log('\n2️⃣  Listing tools...');
    const toolsResponse = await sendMessage('tools/list');
    console.log(`✅ Got ${toolsResponse.result?.tools?.length || 0} tools`);
    
    // 3. Call getPost
    console.log('\n3️⃣  Calling getPost...');
    console.log('   Post ID: 3791373');
    
    try {
      const getPostResponse = await sendMessage('tools/call', {
        name: 'getPost',
        arguments: {
          postId: 3791373
        }
      });
      
      console.log('✅ getPost succeeded!');
      if (getPostResponse.result?.content?.[0]?.text) {
        const post = JSON.parse(getPostResponse.result.content[0].text);
        console.log(`   Title: ${post.title}`);
        console.log(`   Author: ${post.user?.name}`);
        console.log(`   URL: ${post.url}`);
      }
    } catch (error) {
      console.log(`❌ getPost failed: ${error.message}`);
    }
    
    // 4. Try searchPosts as alternative
    console.log('\n4️⃣  Trying searchPosts...');
    try {
      const searchResponse = await sendMessage('tools/call', {
        name: 'searchPosts',
        arguments: {
          q: 'test',
          per_page: 1
        }
      });
      
      console.log('✅ searchPosts succeeded!');
    } catch (error) {
      console.log(`❌ searchPosts failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
  } finally {
    setTimeout(() => {
      console.log('\n🔚 Shutting down...');
      mcpProcess.kill();
      process.exit(0);
    }, 2000);
  }
}

// Start test after process is ready
setTimeout(runTest, 1000);

process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted');
  mcpProcess.kill();
  process.exit(1);
});