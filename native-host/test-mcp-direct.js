#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testDocBaseMCP() {
  console.log('🧪 Testing DocBase MCP Server directly...');
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@krayinc/docbase-mcp-server'],
    env: {
      ...process.env,
      DOCBASE_DOMAIN: 'media-sys',
      DOCBASE_API_TOKEN: 'docbase_YMFu3GP9x7tZYJozemFWTMeyC9ZriUVd5tdnRaFQsNjv7keZPxsFiNPH7jUkhr8o'
    }
  });

  try {
    console.log('🔌 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully');

    console.log('📋 Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools.map(t => t.name));

    console.log('📤 Testing getPost tool...');
    const startTime = Date.now();
    
    try {
      const result = await client.callTool('getPost', { postId: 3791373 });
      const endTime = Date.now();
      console.log(`✅ getPost succeeded in ${endTime - startTime}ms`);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      const endTime = Date.now();
      console.log(`❌ getPost failed after ${endTime - startTime}ms:`, error.message);
    }

  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    try {
      await client.close();
    } catch (e) {
      // ignore close errors
    }
    process.exit(0);
  }
}

testDocBaseMCP().catch(console.error);