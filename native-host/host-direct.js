#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

// Direct JSON-RPC implementation for MCP to bypass SDK issues

import { spawn } from 'child_process';
import fs from 'fs';

// Native Messaging protocol helper functions
function readNativeMessage() {
  return new Promise((resolve, reject) => {
    let messageLength = null;
    let chunks = [];
    
    const onData = (chunk) => {
      chunks.push(chunk);
      
      if (messageLength === null && chunks[0].length >= 4) {
        const buffer = Buffer.concat(chunks);
        messageLength = buffer.readUInt32LE(0);
        chunks = [buffer.slice(4)];
      }
      
      if (messageLength !== null) {
        const buffer = Buffer.concat(chunks);
        if (buffer.length >= messageLength) {
          const messageBuffer = buffer.slice(0, messageLength);
          const message = JSON.parse(messageBuffer.toString('utf8'));
          logDebug(`Parsed message: ${JSON.stringify(message)}`);
          
          process.stdin.removeListener('data', onData);
          process.stdin.removeListener('end', onEnd);
          process.stdin.removeListener('error', onError);
          
          resolve(message);
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
  const logMessage = `[DEBUG] ${new Date().toISOString()}: ${message}`;
  console.error(logMessage);
  
  try {
    fs.appendFileSync('/tmp/chrome-ai-assist-debug.log', logMessage + '\n');
  } catch (e) {
    console.error(`Failed to write log: ${e.message}`);
  }
}

// Direct MCP Client implementation
class DirectMCPClient {
  constructor() {
    this.servers = new Map();
    this.mcpConfig = null;
    this.messageId = 1;
  }

  setMCPSettings(config) {
    this.mcpConfig = config;
    logDebug(`MCP settings updated`);
  }

  async connectToServer(serverName) {
    if (this.servers.has(serverName)) {
      return this.servers.get(serverName);
    }

    const config = this.mcpConfig?.mcpServers?.[serverName];
    if (!config) {
      throw new Error(`No configuration found for server: ${serverName}`);
    }

    logDebug(`Spawning MCP server: ${config.command} ${config.args?.join(' ')}`);
    
    const mcpProcess = spawn(config.command, config.args || [], {
      env: { ...process.env, ...(config.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const server = {
      process: mcpProcess,
      pendingRequests: new Map(),
      buffer: ''
    };

    // Handle stdout (JSON-RPC responses)
    mcpProcess.stdout.on('data', (data) => {
      server.buffer += data.toString();
      const lines = server.buffer.split('\n');
      server.buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            logDebug(`MCP response: ${JSON.stringify(message)}`);
            
            if (message.id && server.pendingRequests.has(message.id)) {
              const { resolve } = server.pendingRequests.get(message.id);
              server.pendingRequests.delete(message.id);
              resolve(message);
            }
          } catch (e) {
            logDebug(`Failed to parse MCP response: ${line}`);
          }
        }
      }
    });

    // Handle stderr
    mcpProcess.stderr.on('data', (data) => {
      logDebug(`MCP server stderr: ${data.toString()}`);
    });

    // Initialize connection
    await this.sendRequest(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'chrome-ai-assist-direct',
        version: '1.0.0'
      }
    });

    this.servers.set(serverName, server);
    logDebug(`Successfully connected to ${serverName} server`);
    return server;
  }

  async sendRequest(server, method, params = {}) {
    const id = this.messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      server.pendingRequests.set(id, { resolve, reject });
      
      const json = JSON.stringify(request) + '\n';
      logDebug(`Sending MCP request: ${json.trim()}`);
      server.process.stdin.write(json);
      
      // Timeout
      setTimeout(() => {
        if (server.pendingRequests.has(id)) {
          server.pendingRequests.delete(id);
          reject(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 30000);
    });
  }

  async listTools(serverName) {
    const server = await this.connectToServer(serverName);
    const response = await this.sendRequest(server, 'tools/list');
    return response.result;
  }

  async callTool(serverName, toolName, args) {
    logDebug(`Direct callTool: ${toolName} on ${serverName} with args: ${JSON.stringify(args)}`);
    const server = await this.connectToServer(serverName);
    const response = await this.sendRequest(server, 'tools/call', {
      name: toolName,
      arguments: args
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'MCP error');
    }
    
    return response.result;
  }

  async cleanup() {
    for (const [name, server] of this.servers) {
      logDebug(`Closing connection to ${name}`);
      server.process.kill();
    }
    this.servers.clear();
  }
}

// Main message handler
async function main() {
  const manager = new DirectMCPClient();
  
  process.on('SIGTERM', async () => {
    await manager.cleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await manager.cleanup();
    process.exit(0);
  });

  logDebug('Native host (direct mode) started, waiting for messages...');

  while (true) {
    try {
      const message = await readNativeMessage();
      logDebug(`Received message: ${JSON.stringify(message)}`);

      switch (message.type) {
        case 'setMCPSettings':
          try {
            manager.setMCPSettings(message.settings);
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: { settingsUpdated: true }
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
      if (error.message === 'stdin ended unexpectedly') {
        logDebug('Chrome extension disconnected, exiting...');
        await manager.cleanup();
        process.exit(0);
      }
      logDebug(`Error in main loop: ${error.message}`);
    }
  }
}

main().catch((error) => {
  logDebug(`Fatal error: ${error.message}`);
  process.exit(1);
});