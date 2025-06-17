#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

// Working native host that properly handles Chrome Native Messaging

console.error('[WORKING] Starting native messaging host...');

// Set up stdio
process.stdin.resume();
process.stdin.setEncoding(null);

let messageBuffer = Buffer.alloc(0);
let expectedLength = null;

// Handle incoming data from Chrome
process.stdin.on('data', (data) => {
  console.error(`[WORKING] Received ${data.length} bytes`);
  messageBuffer = Buffer.concat([messageBuffer, data]);
  
  while (processMessage()) {
    // Continue processing messages
  }
});

function processMessage() {
  if (expectedLength === null && messageBuffer.length >= 4) {
    expectedLength = messageBuffer.readUInt32LE(0);
    messageBuffer = messageBuffer.subarray(4);
    console.error(`[WORKING] Expected message length: ${expectedLength}`);
  }
  
  if (expectedLength !== null && messageBuffer.length >= expectedLength) {
    const messageData = messageBuffer.subarray(0, expectedLength);
    messageBuffer = messageBuffer.subarray(expectedLength);
    
    try {
      const message = JSON.parse(messageData.toString('utf8'));
      console.error(`[WORKING] Received message:`, JSON.stringify(message));
      
      // Send response
      const response = {
        id: message.id,
        type: 'response',
        success: true,
        data: {
          echo: message,
          timestamp: new Date().toISOString(),
          working: true
        }
      };
      
      sendMessage(response);
      expectedLength = null;
      return true;
    } catch (error) {
      console.error(`[WORKING] JSON parse error:`, error.message);
      expectedLength = null;
    }
  }
  
  return false;
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  
  process.stdout.write(lengthBuffer);
  process.stdout.write(buffer);
  console.error(`[WORKING] Sent response:`, json);
}

// Handle process termination
process.on('SIGTERM', () => {
  console.error('[WORKING] Received SIGTERM, exiting...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[WORKING] Received SIGINT, exiting...');
  process.exit(0);
});

process.stdin.on('end', () => {
  console.error('[WORKING] stdin ended');
  process.exit(0);
});

process.stdin.on('error', (error) => {
  console.error('[WORKING] stdin error:', error.message);
  process.exit(1);
});

console.error('[WORKING] Ready for messages');