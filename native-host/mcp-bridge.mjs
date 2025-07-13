#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

/**
 * Final MCP Bridge - 実用版
 */

console.error('[MCP Bridge] Starting final version...');

let buffer = Buffer.alloc(0);

function writeMessage(message) {
  try {
    const messageString = JSON.stringify(message);
    const messageBuffer = Buffer.from(messageString, 'utf8');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
    
    process.stdout.write(lengthBuffer);
    process.stdout.write(messageBuffer);
    console.error('[MCP Bridge] Sent response');
  } catch (error) {
    console.error('[MCP Bridge] Error writing message:', error);
  }
}

// MCPレスポンスのモック
const MCP_RESPONSES = {
  'tools/list': {
    tools: [
      {
        name: "get-current-time",
        description: "現在の時刻を取得します",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              description: "時刻のフォーマット（ISO、JST等）",
              enum: ["ISO", "JST"],
              default: "JST"
            }
          }
        }
      }
    ]
  },
  'tools/call': {
    content: [
      {
        type: "text",
        text: `現在時刻: ${new Date().toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit", 
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })}`
      }
    ]
  }
};

// リクエスト処理
async function handleMCPRequest(message) {
  console.error('[MCP Bridge] Handling MCP request:', JSON.stringify(message, null, 2));
  
  if (message.method && MCP_RESPONSES[message.method]) {
    return MCP_RESPONSES[message.method];
  }
  
  // デフォルトレスポンス
  return {
    result: "ok",
    method: message.method,
    timestamp: new Date().toISOString()
  };
}

// メインの入力処理
process.stdin.on('data', async (data) => {
  try {
    console.error('[MCP Bridge] Received data:', data.length, 'bytes');
    
    buffer = Buffer.concat([buffer, data]);
    
    while (buffer.length >= 4) {
      const messageLength = buffer.readUInt32LE(0);
      
      if (messageLength > 1024 * 1024) {
        console.error('[MCP Bridge] Message too large:', messageLength);
        writeMessage({ type: 'error', message: 'Message too large' });
        buffer = Buffer.alloc(0);
        return;
      }
      
      if (buffer.length >= 4 + messageLength) {
        const messageData = buffer.slice(4, 4 + messageLength);
        buffer = buffer.slice(4 + messageLength);
        
        try {
          const request = JSON.parse(messageData.toString('utf8'));
          console.error('[MCP Bridge] Parsed request');
          
          if (request.action === 'mcp_request') {
            try {
              const result = await handleMCPRequest(request.message);
              writeMessage({
                type: 'mcp_response',
                result: result
              });
            } catch (error) {
              writeMessage({
                type: 'error',
                message: error.message
              });
            }
          } else {
            writeMessage({
              type: 'error',
              message: `Unknown action: ${request.action}`
            });
          }
          
        } catch (error) {
          console.error('[MCP Bridge] JSON parse error:', error);
          writeMessage({
            type: 'error',
            message: `JSON parse error: ${error.message}`
          });
        }
      } else {
        break;
      }
    }
  } catch (error) {
    console.error('[MCP Bridge] Fatal error in data handler:', error);
    writeMessage({
      type: 'error',
      message: `Fatal error: ${error.message}`
    });
  }
});

process.stdin.on('end', () => {
  console.error('[MCP Bridge] stdin ended');
});

process.on('exit', (code) => {
  console.error('[MCP Bridge] Exiting with code:', code);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('[MCP Bridge] Uncaught exception:', error);
  writeMessage({
    type: 'error',
    message: `Uncaught exception: ${error.message}`
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MCP Bridge] Unhandled rejection:', reason);
});

console.error('[MCP Bridge] Ready to receive messages');