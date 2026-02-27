// Test script: sends a ping message to host.js via stdin pipe and reads the response
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hostPath = path.join(__dirname, 'src', 'host.js');

const child = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send ping message
const msg = JSON.stringify({ id: 'test-1', type: 'ping' });
const buf = Buffer.alloc(4 + msg.length);
buf.writeUInt32LE(msg.length, 0);
buf.write(msg, 4);
child.stdin.write(buf);
child.stdin.end();

// Read response
let responseBuf = Buffer.alloc(0);
child.stdout.on('data', (chunk) => {
  responseBuf = Buffer.concat([responseBuf, chunk]);
  if (responseBuf.length >= 4) {
    const len = responseBuf.readUInt32LE(0);
    if (responseBuf.length >= 4 + len) {
      const body = responseBuf.subarray(4, 4 + len);
      const result = JSON.parse(body.toString('utf8'));
      console.log('Response:', JSON.stringify(result, null, 2));
      child.kill();
    }
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

setTimeout(() => {
  console.error('Timeout');
  child.kill();
  process.exit(1);
}, 5000);
