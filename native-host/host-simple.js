#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

/**
 * SIMPLE VERSION - Minimal MCP integration for debugging
 */

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

// Debug logging
function logDebug(message) {
  console.error(`[DEBUG] ${new Date().toISOString()}: ${message}`);
}

// Simple MCP Client manager (without SDK)
class SimpleMCPClientManager {
  constructor() {
    this.clients = new Map();
  }

  async connectToServer(serverName) {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName);
    }

    logDebug(`Simple connection to ${serverName} server...`);
    
    // For simplicity, just test if we can spawn the process
    try {
      const testProcess = spawn('/Users/adachi/.volta/tools/image/node/20.19.1/bin/node', 
        ['/Users/adachi/git/chrome-ai-assist/native-host/node_modules/.bin/docbase-mcp-server'], {
        env: {
          ...process.env,
          DOCBASE_DOMAIN: 'media-sys',
          DOCBASE_API_TOKEN: 'docbase_****************************************************************'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      logDebug(`Test process spawned with PID: ${testProcess.pid}`);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!testProcess.killed && testProcess.exitCode === null) {
        logDebug(`Process is running, terminating test...`);
        testProcess.kill();
        
        // Return mock data for now
        const mockClient = {
          listTools: async () => ({
            tools: [
              { name: 'search', description: 'Search DocBase content (real server available)' },
              { name: 'get_document', description: 'Get DocBase document (real server available)' }
            ]
          }),
          callTool: async (toolName, args) => ({
            content: `Real MCP server available - would call ${toolName} with ${JSON.stringify(args)}`
          })
        };
        
        this.clients.set(serverName, { client: mockClient, process: null });
        logDebug(`Successfully verified ${serverName} server can start`);
        
        return { client: mockClient, process: null };
      } else {
        throw new Error(`Test process failed to start properly`);
      }
    } catch (error) {
      logDebug(`Failed to connect to ${serverName}: ${error.message}`);
      throw error;
    }
  }

  async disconnectFromServer(serverName) {
    this.clients.delete(serverName);
  }

  async callTool(serverName, toolName, args) {
    const connection = await this.connectToServer(serverName);
    return await connection.client.callTool(toolName, args);
  }

  async listTools(serverName) {
    const connection = await this.connectToServer(serverName);
    return await connection.client.listTools();
  }

  async cleanup() {
    this.clients.clear();
  }
}

// Main message handler
async function main() {
  const manager = new SimpleMCPClientManager();
  
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

  logDebug('Simple native host started, waiting for messages...');

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
