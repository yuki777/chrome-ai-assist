import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const log = (msg) => process.stderr.write(`[mcp-bridge] ${msg}\n`);

const SERVERS = {
  backlog: {
    command: 'npx',
    args: ['-y', 'github:shueisha-arts-and-digital/backlog-mcp-server'],
    env: ['BACKLOG_DOMAIN', 'BACKLOG_API_KEY']
  },
  docbase: {
    command: 'npx',
    args: ['-y', 'github:shueisha-arts-and-digital/docbase-mcp-server'],
    env: ['DOCBASE_DOMAIN', 'DOCBASE_API_TOKEN']
  }
};

/** @type {Map<string, Client>} */
const clients = new Map();

/** @type {Map<string, Promise<Client>>} */
const connecting = new Map();

/**
 * Get or create a singleton MCP client for the given server.
 * Uses a connecting promise lock to prevent concurrent connection attempts.
 */
async function getClient(server) {
  if (clients.has(server)) return clients.get(server);
  if (connecting.has(server)) return connecting.get(server);

  const p = (async () => {
    const cfg = SERVERS[server];
    if (!cfg) throw new Error(`unsupported server: ${server}`);

    // Check required environment variables
    for (const k of cfg.env) {
      if (!process.env[k]) throw new Error(`missing env: ${k}`);
    }

    log(`connecting to ${server}...`);
    const transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      env: process.env
    });
    const client = new Client({
      name: 'chrome-ai-assist-native-host',
      version: '0.1.0'
    });
    await client.connect(transport);
    log(`connected to ${server}`);
    clients.set(server, client);
    return client;
  })();

  connecting.set(server, p);
  try {
    return await p;
  } finally {
    connecting.delete(server);
  }
}

/**
 * Call a tool on the specified MCP server.
 */
export async function callTool(server, tool, args) {
  const client = await getClient(server);
  return client.callTool({ name: tool, arguments: args ?? {} });
}
