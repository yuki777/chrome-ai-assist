// MCP (Model Context Protocol) Client for Chrome Extension
// Manages communication with Native Messaging Host

const NATIVE_HOST_NAME = 'com.chrome_ai_assist.mcp_bridge';

// Utility function to get formatted timestamp
function getTimestamp() {
  return new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\//g, '-');
}

class MCPClient {
  constructor() {
    this.port = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.messageId = 0;
  }

  // Connect to the native messaging host
  async connect() {
    if (this.connected) {
      return true;
    }

    try {
      console.log(`${getTimestamp()} 🔌 Attempting to connect to native host:`, NATIVE_HOST_NAME);
      console.log(`${getTimestamp()} 🔌 Chrome version:`, navigator.userAgent);
      console.log(`${getTimestamp()} 🔌 Extension ID:`, chrome.runtime.id);
      
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      console.log(`${getTimestamp()} 🔌 Native port created successfully`);
      console.log(`${getTimestamp()} 🔌 Port object:`, this.port);
      
      this.port.onMessage.addListener((message) => {
        console.log(`${getTimestamp()} 📨 Message received from native host:`, message);
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.error(`${getTimestamp()} ❌ Native host disconnected:`, error?.message || 'Unknown reason');
        if (error) {
          console.error(`${getTimestamp()} 🔍 Chrome runtime error details:`, {
            message: error.message,
            error: error,
            toString: error.toString(),
            keys: Object.keys(error),
            json: JSON.stringify(error)
          });
          
          // Try to log all properties
          for (const key in error) {
            console.error(`${getTimestamp()} 🔍 Error property [${key}]:`, error[key]);
          }
        }
        this.connected = false;
        this.port = null;
        
        // Clear any pending message handlers
        for (const [id, handler] of this.messageHandlers) {
          clearTimeout(handler.timeout);
          handler.reject(new Error('Native host disconnected'));
        }
        this.messageHandlers.clear();
      });

      // Test connection with ping
      const pingResponse = await this.sendMessage({ type: 'ping' });
      if (pingResponse.data?.pong) {
        this.connected = true;
        console.log(`${getTimestamp()} Successfully connected to MCP bridge`);
        return true;
      }
      
      throw new Error('Ping failed');
    } catch (error) {
      console.error(`${getTimestamp()} Failed to connect to native host:`, error);
      this.connected = false;
      return false;
    }
  }

  // Send a message to the native host and wait for response
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Not connected to native host'));
        return;
      }

      const id = ++this.messageId;
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error('Message timeout'));
      }, 5000); // 5 second timeout

      this.messageHandlers.set(id, { resolve, reject, timeout });
      this.port.postMessage({ ...message, id });
    });
  }

  // Handle incoming messages from native host
  handleMessage(message) {
    console.log(`${getTimestamp()} Received message from native host:`, message);

    // Handle debug messages
    if (message.type === 'debug') {
      console.log(`${getTimestamp()} [Native Host Debug]`, message.message);
      return;
    }

    // Handle response messages
    if (message.type === 'response' && message.id) {
      const handler = this.messageHandlers.get(message.id);
      if (handler) {
        clearTimeout(handler.timeout);
        this.messageHandlers.delete(message.id);
        
        if (message.success) {
          handler.resolve(message);
        } else {
          handler.reject(new Error(message.error || 'Unknown error'));
        }
      }
    }
  }

  // Set MCP settings
  async setMCPSettings(settings) {
    await this.connect();
    const response = await this.sendMessage({
      type: 'setMCPSettings',
      settings: settings
    });
    return response.success;
  }

  // Connect to MCP server
  async connectToServer(serverName) {
    await this.connect();
    const response = await this.sendMessage({
      type: 'connect',
      server: serverName
    });
    return response.success;
  }

  // Disconnect from MCP server
  async disconnectFromServer(serverName) {
    const response = await this.sendMessage({
      type: 'disconnect',
      server: serverName
    });
    return response.success;
  }

  // List available tools from MCP server
  async listTools(serverName) {
    const response = await this.sendMessage({
      type: 'listTools',
      server: serverName
    });
    return response.data;
  }

  // Call a tool on MCP server
  async callTool(serverName, toolName, args) {
    const response = await this.sendMessage({
      type: 'callTool',
      server: serverName,
      tool: toolName,
      args: args
    });
    return response.data;
  }

  // Process webpage content with MCP server
  async processWebContent(serverName, content, options = {}) {
    // For DocBase, we might want to extract specific content
    if (serverName === 'docbase' && content.url?.includes('docbase.io')) {
      try {
        // Try to use MCP server's search or content processing capabilities
        const tools = await this.listTools(serverName);
        console.log(`${getTimestamp()} Available tools:`, tools);

        // Example: Use search tool if available
        if (tools.tools?.find(t => t.name === 'search')) {
          const searchResult = await this.callTool(serverName, 'search', {
            query: options.query || content.title || 'content'
          });
          return searchResult;
        }
      } catch (error) {
        console.error(`${getTimestamp()} Error processing with MCP:`, error);
      }
    }

    // Fallback to original content if MCP processing fails
    return content;
  }

  // Cleanup
  disconnect() {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
      this.connected = false;
    }
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();