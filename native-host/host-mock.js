#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

/**
 * MOCK VERSION of Chrome AI Assist Native Messaging Host
 * 
 * This version uses mock MCP servers for testing the basic architecture
 * without requiring actual MCP server connections.
 * 
 * To use this mock version:
 * 1. Update Chrome manifest to point to host-mock.js
 * 2. Reload Chrome extension
 * 3. Test basic MCP functionality
 * 
 * Features:
 * - Mock DocBase server with sample tools
 * - All connection flows work
 * - Useful for debugging Chrome extension issues
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Native Messaging protocol helper functions
function readNativeMessage() {
  return new Promise((resolve, reject) => {
    let messageLength = null;
    let messageBuffer = Buffer.alloc(0);
    
    const onData = (data) => {
      messageBuffer = Buffer.concat([messageBuffer, data]);
      
      while (messageBuffer.length >= 4) {
        if (messageLength === null) {
          messageLength = messageBuffer.readUInt32LE(0);
          messageBuffer = messageBuffer.subarray(4);
          logDebug(`Expected message length: ${messageLength}`);
        }
        
        if (messageBuffer.length >= messageLength) {
          const messageData = messageBuffer.subarray(0, messageLength);
          messageBuffer = messageBuffer.subarray(messageLength);
          
          try {
            const message = JSON.parse(messageData.toString('utf8'));
            logDebug(`Parsed message: ${JSON.stringify(message)}`);
            
            // Remove listener and resolve
            process.stdin.removeListener('data', onData);
            process.stdin.removeListener('end', onEnd);
            process.stdin.removeListener('error', onError);
            
            resolve(message);
            return;
          } catch (error) {
            logDebug(`JSON parse error: ${error.message}`);
            process.stdin.removeListener('data', onData);
            process.stdin.removeListener('end', onEnd);
            process.stdin.removeListener('error', onError);
            reject(error);
            return;
          }
        } else {
          // Need more data
          break;
        }
      }
    };
    
    const onEnd = () => {
      logDebug('stdin ended unexpectedly');
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
      reject(new Error('stdin ended unexpectedly'));
    };
    
    const onError = (error) => {
      logDebug(`stdin error: ${error.message}`);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
      reject(error);
    };
    
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}

function sendNativeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  process.stdout.write(lengthBuffer);
  process.stdout.write(buffer);
}

// MCP Client manager
class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.serverConfigs = {
      docbase: {
        command: '/Users/adachi/.volta/tools/image/npm/10.9.2/bin/npx',
        args: ['-y', '@krayinc/docbase-mcp-server@latest'],
        env: {
          DOCBASE_DOMAIN: 'media-sys',
          DOCBASE_API_TOKEN: 'docbase_****************************************************************'
        }
      }
    };
  }

  async connectToServer(serverName) {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName);
    }

    const config = this.serverConfigs[serverName];
    if (!config) {
      throw new Error(`Unknown server: ${serverName}`);
    }

    logDebug(`Attempting to connect to MCP server: ${serverName}`);
    
    try {
      // For now, simulate a successful connection without actually starting the MCP server
      // This helps us isolate the issue
      logDebug(`Simulating connection to ${serverName} server...`);
      
      // Return a mock client for testing
      const mockClient = {
        listTools: async () => {
          return {
            tools: [
              { name: 'search', description: 'Search DocBase content' },
              { name: 'get_document', description: 'Get DocBase document' }
            ]
          };
        },
        callTool: async (toolName, args) => {
          return {
            content: `Mock result for ${toolName} with args: ${JSON.stringify(args)}`
          };
        }
      };
      
      this.clients.set(serverName, { client: mockClient, process: null });
      logDebug(`Successfully connected to mock ${serverName} server`);
      
      return { client: mockClient, process: null };
    } catch (error) {
      logDebug(`Failed to connect to ${serverName}: ${error.message}`);
      throw error;
    }
  }

  async disconnectFromServer(serverName) {
    const connection = this.clients.get(serverName);
    if (connection) {
      await connection.client.close();
      connection.process.kill();
      this.clients.delete(serverName);
    }
  }

  async callTool(serverName, toolName, args) {
    const connection = await this.connectToServer(serverName);
    const result = await connection.client.callTool(toolName, args);
    return result;
  }

  async listTools(serverName) {
    const connection = await this.connectToServer(serverName);
    const result = await connection.client.listTools();
    return result;
  }

  async cleanup() {
    for (const [serverName, connection] of this.clients) {
      await connection.client.close();
      connection.process.kill();
    }
    this.clients.clear();
  }
}

// Debug logging
function logDebug(message) {
  // Log to stderr instead of stdout to avoid interfering with native messages
  console.error(`[DEBUG] ${new Date().toISOString()}: ${message}`);
}

// Main message handler
async function main() {
  const manager = new MCPClientManager();
  
  // Enhanced error handling
  process.on('SIGTERM', async () => {
    logDebug('Received SIGTERM, cleaning up...');
    await manager.cleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logDebug('Received SIGINT, cleaning up...');
    await manager.cleanup();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logDebug(`Uncaught exception: ${error.message}`);
    logDebug(`Stack: ${error.stack}`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logDebug(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
  });

  logDebug('Native host started, waiting for messages...');

  while (true) {
    try {
      const message = await readNativeMessage();
      logDebug(`Received message: ${JSON.stringify(message)}`);

      switch (message.type) {
        case 'connect':
          try {
            await manager.connectToServer(message.server);
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: { connected: true }
            });
          } catch (error) {
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: false,
              error: error.message
            });
          }
          break;

        case 'disconnect':
          try {
            await manager.disconnectFromServer(message.server);
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: { disconnected: true }
            });
          } catch (error) {
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: false,
              error: error.message
            });
          }
          break;

        case 'listTools':
          try {
            const tools = await manager.listTools(message.server);
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: tools
            });
          } catch (error) {
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: false,
              error: error.message
            });
          }
          break;

        case 'callTool':
          try {
            const result = await manager.callTool(
              message.server,
              message.tool,
              message.args
            );
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: result
            });
          } catch (error) {
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: false,
              error: error.message
            });
          }
          break;

        case 'ping':
          sendNativeMessage({
            id: message.id,
            type: 'response',
            success: true,
            data: { pong: true }
          });
          break;

        default:
          sendNativeMessage({
            id: message.id,
            type: 'response',
            success: false,
            error: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      logDebug(`Error in main loop: ${error.message}`);
      // Continue the loop even on error
    }
  }
}

// Start the native messaging host
main().catch((error) => {
  logDebug(`Fatal error: ${error.message}`);
  process.exit(1);
});
