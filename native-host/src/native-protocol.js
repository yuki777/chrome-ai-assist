import os from 'node:os';

const IS_LE = os.endianness() === 'LE';
export const MAX_INBOUND_BYTES = 64 * 1024 * 1024; // Chrome -> Host (64MB guard)
export const MAX_OUTBOUND_BYTES = 1024 * 1024 - 4;  // Host -> Chrome (1MB - 4byte header)

const readU32 = (b, o = 0) => (IS_LE ? b.readUInt32LE(o) : b.readUInt32BE(o));
const writeU32 = (b, v, o = 0) => (IS_LE ? b.writeUInt32LE(v, o) : b.writeUInt32BE(v, o));

/**
 * Native Messaging stdin message loop.
 * Accumulates buffer chunks and extracts complete frames (4-byte length prefix + JSON body).
 */
export function startMessageLoop(stdin, onMessage, onError) {
  let buf = Buffer.alloc(0);

  stdin.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    // Guard against buffer overflow
    if (buf.length > MAX_INBOUND_BYTES + 4) {
      onError?.(new Error('buffer overflow'));
      process.exit(1);
    }

    while (buf.length >= 4) {
      const len = readU32(buf, 0);
      if (len > MAX_INBOUND_BYTES) {
        onError?.(new Error(`message too large: ${len}`));
        process.exit(1);
      }
      if (buf.length < 4 + len) break; // Wait for more data

      const body = buf.subarray(4, 4 + len);
      buf = buf.subarray(4 + len);

      try {
        onMessage(JSON.parse(body.toString('utf8')));
      } catch (e) {
        onError?.(e);
      }
    }
  });
}

/**
 * Write a JSON message to stdout in Native Messaging format (4-byte LE length prefix + JSON body).
 */
export function writeMessage(stdout, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  if (body.length > MAX_OUTBOUND_BYTES) {
    throw new Error(`response too large: ${body.length} bytes (max ${MAX_OUTBOUND_BYTES})`);
  }
  const header = Buffer.alloc(4);
  writeU32(header, body.length, 0);
  stdout.write(header);
  stdout.write(body);
}
