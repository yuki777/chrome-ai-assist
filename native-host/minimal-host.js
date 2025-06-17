#!/Users/adachi/.volta/tools/image/node/20.19.1/bin/node

// Minimal native host for debugging

console.error('[MINIMAL] Starting...');

// Prevent Node.js from exiting
process.stdin.resume();

// Keep the process alive
setInterval(() => {
  console.error('[MINIMAL] Heartbeat...');
}, 1000);

console.error('[MINIMAL] Setup complete, staying alive...');