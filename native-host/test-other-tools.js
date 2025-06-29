#!/usr/bin/env node

// Test other DocBase MCP tools via Native Messaging

import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('🧪 Testing Other DocBase MCP Tools...\n');

const hostPath = resolve('./host.js');
const hostProcess = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DOCBASE_DOMAIN: 'media-sys',
    DOCBASE_API_TOKEN: process.env.DOCBASE_API_TOKEN || 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o'
  }
});

let messageId = 1;
const results = {};

function sendMessage(message) {
  const json = JSON.stringify({ ...message, id: messageId++ });
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  console.log(`📤 Sending: ${message.type}${message.tool ? ` (${message.tool})` : ''}`);
  hostProcess.stdin.write(lengthBuffer);
  hostProcess.stdin.write(buffer);
}

async function readMessage() {
  return new Promise((resolve, reject) => {
    let messageLength = null;
    let chunks = [];
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 15000);
    
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
            console.log(`📥 Received: ${parsed.type || 'unknown'}${parsed.success === false ? ' (failed)' : ''}`);
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

hostProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => {
    if (line.includes('Tool call successful') || line.includes('Tool call failed')) {
      console.log(`   ℹ️  ${line.split(': ').slice(1).join(': ')}`);
    }
  });
});

async function testTool(toolName, args, description) {
  console.log(`\n🔧 Testing ${toolName}: ${description}`);
  const startTime = Date.now();
  
  sendMessage({
    type: 'callTool',
    server: 'docbase',
    tool: toolName,
    args: args
  });
  
  try {
    let response;
    while (true) {
      response = await readMessage();
      if (response.type !== 'debug') break;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.success) {
      console.log(`   ✅ Success in ${duration}ms`);
      results[toolName] = { success: true, duration };
      
      // Show sample data
      if (response.data?.content?.[0]?.text) {
        try {
          const data = JSON.parse(response.data.content[0].text);
          if (Array.isArray(data)) {
            console.log(`   📊 Returned ${data.length} items`);
            if (data.length > 0) {
              console.log(`   📝 First item:`, JSON.stringify(data[0], null, 2).split('\n').slice(0, 5).join('\n'));
            }
          } else if (typeof data === 'object') {
            console.log(`   📝 Result preview:`, JSON.stringify(data, null, 2).split('\n').slice(0, 5).join('\n'));
          }
        } catch (e) {
          console.log(`   📝 Raw result:`, response.data.content[0].text.substring(0, 100) + '...');
        }
      }
    } else {
      console.log(`   ❌ Failed in ${duration}ms: ${response.error}`);
      results[toolName] = { success: false, duration, error: response.error };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`   ❌ Error after ${duration}ms: ${error.message}`);
    results[toolName] = { success: false, duration, error: error.message };
  }
}

async function runTests() {
  try {
    // 1. Initialize
    console.log('1️⃣  Initializing connection...');
    sendMessage({ type: 'ping' });
    let response = await readMessage();
    console.log('   ✅ Connected to Native Host\n');
    
    // 2. Set MCP config
    console.log('2️⃣  Configuring MCP...');
    sendMessage({
      type: 'setMCPSettings',
      settings: {
        mcpServers: {
          docbase: {
            command: 'npx',
            args: ['-y', '@krayinc/docbase-mcp-server'],
            env: {
              DOCBASE_DOMAIN: 'media-sys',
              DOCBASE_API_TOKEN: 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o'
            }
          }
        }
      }
    });
    response = await readMessage();
    console.log('   ✅ MCP Configured\n');
    
    // 3. Connect to DocBase
    console.log('3️⃣  Connecting to DocBase MCP...');
    sendMessage({
      type: 'connect',
      server: 'docbase'
    });
    response = await readMessage();
    console.log('   ✅ Connected to DocBase MCP\n');
    
    // 4. Test various tools
    console.log('4️⃣  Testing various tools...');
    
    // Test searchUsers
    await testTool('searchUsers', 
      { query: 'yuki777' }, 
      'Search for user "yuki777"'
    );
    
    // Test getProfile
    await testTool('getProfile', 
      {}, 
      'Get current user profile'
    );
    
    // Test getTags
    await testTool('getTags', 
      {}, 
      'Get all tags'
    );
    
    // Also test searchPosts for comparison
    await testTool('searchPosts', 
      { query: 'test', per_page: 2 }, 
      'Search posts with "test"'
    );
    
    // Retry getPost to compare
    await testTool('getPost', 
      { postId: 3791373 }, 
      'Get specific post (for comparison)'
    );
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('━'.repeat(50));
    Object.entries(results).forEach(([tool, result]) => {
      const icon = result.success ? '✅' : '❌';
      const status = result.success ? 'Success' : 'Failed';
      console.log(`${icon} ${tool.padEnd(15)} ${status.padEnd(10)} ${result.duration}ms`);
      if (!result.success) {
        console.log(`   └─ Error: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  } finally {
    setTimeout(() => {
      console.log('\n🔚 Shutting down...');
      hostProcess.kill();
      process.exit(0);
    }, 2000);
  }
}

setTimeout(runTests, 500);

process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted');
  hostProcess.kill();
  process.exit(1);
});