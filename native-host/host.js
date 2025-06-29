#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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
    this.mcpConfig = null;
  }

  setMCPSettings(config) {
    this.mcpConfig = config;
    // Sanitize config for logging (hide sensitive tokens)
    const sanitizedConfig = this.sanitizeConfigForLogging(config);
    logDebug(`MCP settings updated: ${JSON.stringify(sanitizedConfig)}`);
    
    // Disconnect existing clients when config changes
    for (const [serverName, client] of this.clients) {
      logDebug(`Disconnecting client: ${serverName} due to config change`);
      this.disconnectFromServer(serverName);
    }
  }

  sanitizeConfigForLogging(config) {
    if (!config || !config.mcpServers) return config;
    
    const sanitized = { mcpServers: {} };
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      sanitized.mcpServers[serverName] = {
        ...serverConfig,
        env: serverConfig.env ? Object.keys(serverConfig.env).reduce((acc, key) => {
          acc[key] = key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? '***' : serverConfig.env[key];
          return acc;
        }, {}) : {}
      };
    }
    return sanitized;
  }

  async connectToServer(serverName) {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName);
    }

    if (!this.mcpConfig || !this.mcpConfig.mcpServers) {
      throw new Error(`No MCP servers configured`);
    }

    // Try exact match first
    let config = this.mcpConfig.mcpServers[serverName];
    
    // If not found, try case-insensitive match
    if (!config) {
      const serverKeys = Object.keys(this.mcpConfig.mcpServers);
      const matchedKey = serverKeys.find(key => key.toLowerCase() === serverName.toLowerCase());
      if (matchedKey) {
        config = this.mcpConfig.mcpServers[matchedKey];
        serverName = matchedKey; // Use the actual key name
      }
    }
    
    if (!config) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    logDebug(`Connecting to MCP server: ${serverName}`);
    logDebug(`Command: ${config.command}`);
    logDebug(`Args: ${JSON.stringify(config.args || [])}`);
    
    // Sanitize env for logging
    const sanitizedEnv = config.env ? Object.keys(config.env).reduce((acc, key) => {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
        acc[key] = config.env[key] ? '***SET***' : '***NOT_SET***';
      } else {
        acc[key] = config.env[key];
      }
      return acc;
    }, {}) : {};
    logDebug(`Env: ${JSON.stringify(sanitizedEnv)}`);
    
    // Log actual token status for debugging
    const tokenSet = config.env && config.env.DOCBASE_API_TOKEN;
    logDebug(`DOCBASE_API_TOKEN is ${tokenSet ? 'SET' : 'NOT SET'} (length: ${tokenSet ? config.env.DOCBASE_API_TOKEN.length : 0})`);

    const client = new Client({
      name: 'chrome-ai-assist-native-host',
      version: '1.0.0'
    }, {
      capabilities: {},
      protocolVersion: '2025-06-18'
    });

    logDebug(`Creating StdioClientTransport with proper parameters...`);
    
    // StdioClientTransport manages the process itself
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...(config.env || {}) },
      stderr: 'pipe',  // Pipe stderr so we can monitor it
      // Fix for stdio buffering issues
      spawnOptions: {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      }
    });

    logDebug(`StdioClientTransport created successfully`);

    // Set up stderr monitoring if available
    const stderrStream = transport.stderr;
    if (stderrStream) {
      stderrStream.on('data', (data) => {
        const message = data.toString().trim();
        logDebug(`Server ${serverName} stderr: ${message}`);
        // Also send to chrome extension for visibility
        sendNativeMessage({
          type: 'debug',
          source: 'mcp-server',
          server: serverName,
          message: message
        });
      });
    } else {
      logDebug(`No stderr stream available for ${serverName}`);
    }

    // Set up transport event handlers
    transport.onclose = () => {
      logDebug(`Transport closed for ${serverName}`);
      this.clients.delete(serverName);
    };

    transport.onerror = (error) => {
      logDebug(`Transport error for ${serverName}: ${error.message}`);
    };

    logDebug(`Connecting client to transport...`);
    await client.connect(transport);
    
    // Test the connection immediately
    logDebug(`Testing connection with listTools...`);
    try {
      const testTools = await client.listTools();
      logDebug(`Connection test successful, got ${testTools.tools?.length || 0} tools`);
    } catch (testError) {
      logDebug(`Connection test failed: ${testError.message}`);
    }
    
    this.clients.set(serverName, { client, transport });
    logDebug(`Successfully connected to ${serverName} server`);
    
    return { client, transport };
  }

  async disconnectFromServer(serverName) {
    // Try exact match first
    let connection = this.clients.get(serverName);
    let actualServerName = serverName;
    
    // If not found, try case-insensitive match
    if (!connection) {
      for (const [key, value] of this.clients) {
        if (key.toLowerCase() === serverName.toLowerCase()) {
          connection = value;
          actualServerName = key;
          break;
        }
      }
    }
    
    if (connection) {
      await connection.client.close();
      if (connection.transport && connection.transport.close) {
        await connection.transport.close();
      }
      this.clients.delete(actualServerName);
    }
  }

  async callTool(serverName, toolName, args) {
    logDebug(`Calling tool ${toolName} on server ${serverName} with args: ${JSON.stringify(args)}`);
    const connection = await this.connectToServer(serverName);
    logDebug(`Connection established, calling tool...`);
    
    try {
      logDebug(`About to call connection.client.callTool...`);
      logDebug(`Client state: connected=${connection.client.isConnected?.()}, transport=${!!connection.transport}`);
      const startTime = Date.now();
      
      
      logDebug(`Calling client.callTool('${toolName}', ${JSON.stringify(args)})`);
      
      // Monitor the transport
      if (connection.transport && connection.transport.process) {
        logDebug(`Transport process PID: ${connection.transport.process.pid}`);
        logDebug(`Transport process connected: ${connection.transport.process.connected}`);
      }
      
      // Try with a shorter timeout first (10 seconds)
      const shortTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool call timeout after 10 seconds')), 10000);
      });
      
      // Log before calling
      logDebug(`About to invoke callTool method...`);
      
      // Try to manually send the request if needed
      let callPromise;
      try {
        // First try the normal way
        callPromise = connection.client.callTool(toolName, args);
        logDebug(`callTool promise created successfully`);
      } catch (immediateError) {
        logDebug(`Immediate error in callTool: ${immediateError.message}`);
        throw immediateError;
      }
      
      logDebug(`Racing callTool promise with timeout...`);
      
      // Add a progress checker
      let progressTimeout = setTimeout(() => {
        logDebug(`Warning: No response after 5 seconds, transport may be stuck`);
      }, 5000);
      
      try {
        const result = await Promise.race([
          callPromise,
          shortTimeoutPromise
        ]);
        
        clearTimeout(progressTimeout);
        const endTime = Date.now();
        logDebug(`Tool call successful in ${endTime - startTime}ms, result: ${JSON.stringify(result, null, 2)}`);
        return result;
      } catch (error) {
        clearTimeout(progressTimeout);
        throw error;
      }
    } catch (error) {
      logDebug(`Tool call failed: ${error.message}`);
      logDebug(`Tool call error stack: ${error.stack}`);
      throw error;
    }
  }

  async listTools(serverName) {
    const connection = await this.connectToServer(serverName);
    const result = await connection.client.listTools();
    return result;
  }

  async cleanup() {
    for (const [, connection] of this.clients) {
      await connection.client.close();
      if (connection.transport && connection.transport.close) {
        await connection.transport.close();
      }
    }
    this.clients.clear();
  }
}

import fs from 'fs';

// Debug logging
function logDebug(message) {
  // Log to stderr instead of stdout to avoid interfering with native messages
  const logMessage = `[DEBUG] ${new Date().toISOString()}: ${message}`;
  console.error(logMessage);
  
  // Also try to write to a log file
  try {
    fs.appendFileSync('/tmp/chrome-ai-assist-debug.log', logMessage + '\n');
  } catch (e) {
    console.error(`Failed to write log: ${e.message}`);
  }
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
            logDebug(`Received callTool request: server=${message.server}, tool=${message.tool}, args=${JSON.stringify(message.args)}`);
            const result = await manager.callTool(
              message.server,
              message.tool,
              message.args
            );
            logDebug(`Tool call successful`);
            sendNativeMessage({
              id: message.id,
              type: 'response',
              success: true,
              data: result
            });
          } catch (error) {
            logDebug(`Tool call failed: ${error.message}`);
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
