#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

// Simple test native host without MCP dependencies

// Set binary mode for stdin/stdout
process.stdin.setEncoding(null);
process.stdout.setEncoding(null);

console.error(`[SIMPLE] ${new Date().toISOString()}: Simple host started`);

function readMessage() {
  return new Promise((resolve, reject) => {
    let messageLength = null;
    let messageBuffer = Buffer.alloc(0);
    
    const onData = (data) => {
      messageBuffer = Buffer.concat([messageBuffer, data]);
      
      while (messageBuffer.length >= 4) {
        if (messageLength === null) {
          messageLength = messageBuffer.readUInt32LE(0);
          messageBuffer = messageBuffer.subarray(4);
          console.error(`[SIMPLE] Expected message length: ${messageLength}`);
        }
        
        if (messageBuffer.length >= messageLength) {
          const messageData = messageBuffer.subarray(0, messageLength);
          messageBuffer = messageBuffer.subarray(messageLength);
          
          try {
            const message = JSON.parse(messageData.toString('utf8'));
            console.error(`[SIMPLE] Received: ${JSON.stringify(message)}`);
            
            process.stdin.removeListener('data', onData);
            resolve(message);
            return;
          } catch (error) {
            console.error(`[SIMPLE] Parse error: ${error.message}`);
            process.stdin.removeListener('data', onData);
            reject(error);
            return;
          }
        } else {
          break;
        }
      }
    };
    
    process.stdin.on('data', onData);
  });
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  process.stdout.write(lengthBuffer);
  process.stdout.write(buffer);
  console.error(`[SIMPLE] Sent: ${json}`);
}

async function main() {
  try {
    console.error(`[SIMPLE] Waiting for messages...`);
    
    // Add process event handlers
    process.on('SIGTERM', () => {
      console.error(`[SIMPLE] Received SIGTERM`);
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.error(`[SIMPLE] Received SIGINT`);
      process.exit(0);
    });
    
    process.on('uncaughtException', (error) => {
      console.error(`[SIMPLE] Uncaught exception: ${error.message}`);
      console.error(`[SIMPLE] Stack: ${error.stack}`);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error(`[SIMPLE] Unhandled rejection: ${reason}`);
      process.exit(1);
    });
    
    while (true) {
      try {
        const message = await readMessage();
        
        // Simple echo response
        const response = {
          id: message.id,
          type: 'response',
          success: true,
          data: { 
            echo: message,
            timestamp: new Date().toISOString(),
            simple: true
          }
        };
        
        sendMessage(response);
        
      } catch (error) {
        console.error(`[SIMPLE] Message error: ${error.message}`);
        console.error(`[SIMPLE] Stack: ${error.stack}`);
        break;
      }
    }
  } catch (error) {
    console.error(`[SIMPLE] Main error: ${error.message}`);
    console.error(`[SIMPLE] Stack: ${error.stack}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`[SIMPLE] Fatal error: ${error.message}`);
  console.error(`[SIMPLE] Stack: ${error.stack}`);
  process.exit(1);
});