import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const log = (msg) => process.stderr.write(`[mcp-bridge] ${msg}\n`);

const SERVERS = {
  backlog: {
    command: 'npx',
    args: ['-y', 'backlog-mcp-server', '--dynamic-toolsets'],
    env: ['BACKLOG_DOMAIN', 'BACKLOG_API_KEY'],
    toolsets: ['issue']
  },
  docbase: {
    command: 'npx',
    args: ['-y', 'github:shueisha-arts-and-digital/docbase-mcp-server'],
    env: ['DOCBASE_DOMAIN', 'DOCBASE_API_TOKEN']
  }
};

// Credential key → environment variable mapping
const CRED_TO_ENV = {
  backlogDomain: 'BACKLOG_DOMAIN',
  backlogApiKey: 'BACKLOG_API_KEY',
  docbaseDomain: 'DOCBASE_DOMAIN',
  docbaseApiToken: 'DOCBASE_API_TOKEN'
};

// Environment variable → server mapping
const ENV_TO_SERVER = {
  BACKLOG_DOMAIN: 'backlog',
  BACKLOG_API_KEY: 'backlog',
  DOCBASE_DOMAIN: 'docbase',
  DOCBASE_API_TOKEN: 'docbase'
};

/** Runtime env overrides from Chrome extension (takes precedence over process.env / .env) */
const runtimeEnv = {};

/** Via identifier (browser-extensionId) appended to MCP server args for process identification */
let viaTag = '';

export function setVia(tag) { viaTag = tag; }

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

    const env = buildServerEnv(server);

    const args = [...cfg.args];
    if (viaTag) args.push(`--via`, viaTag);

    log(`connecting to ${server}...`);
    const transport = new StdioClientTransport({
      command: cfg.command,
      args,
      env
    });
    const client = new Client({
      name: 'chrome-ai-assist-native-host',
      version: '0.1.0'
    });
    await client.connect(transport);
    log(`connected to ${server}`);

    // Activate dynamic toolsets if configured
    if (cfg.args.includes('--dynamic-toolsets') && cfg.toolsets) {
      for (const ts of cfg.toolsets) {
        log(`enabling toolset "${ts}" on ${server}...`);
        await client.callTool({ name: 'enable_toolset', arguments: { toolset: ts } });
        log(`toolset "${ts}" enabled on ${server}`);
      }
    }

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
 * Build environment for a server subprocess.
 * Credential keys must be set via runtimeEnv (Chrome extension options).
 */
function buildServerEnv(server) {
  const cfg = SERVERS[server];

  for (const k of cfg.env) {
    if (!runtimeEnv[k]) throw new Error(`missing env: ${k} (set in Chrome extension options)`);
  }
  const nodeDir = path.dirname(process.execPath);
  const env = { ...process.env, ...runtimeEnv };
  env.PATH = `${nodeDir}:${env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'}`;
  return env;
}

/**
 * Dispose (close) a running MCP client for the given server.
 */
async function disposeClient(server) {
  const client = clients.get(server);
  if (!client) return;
  clients.delete(server);
  try {
    await client.close();
    log(`disposed client for ${server}`);
  } catch (e) {
    log(`dispose error for ${server}: ${e.message}`);
  }
}

/**
 * Apply credentials from Chrome extension to runtimeEnv.
 * Disposes affected server clients so they reconnect with new env.
 * Returns list of server names that were affected.
 */
export async function configureCredentials(credentials) {
  const affected = new Set();

  for (const [credKey, envKey] of Object.entries(CRED_TO_ENV)) {
    const val = credentials?.[credKey];
    if (val && val !== runtimeEnv[envKey]) {
      runtimeEnv[envKey] = val;
      const srv = ENV_TO_SERVER[envKey];
      if (srv) affected.add(srv);
    }
  }

  // Dispose affected servers so next call reconnects with new env
  for (const srv of affected) {
    await disposeClient(srv);
  }

  log(`configured credentials, affected servers: [${[...affected].join(', ')}]`);
  return [...affected];
}

/**
 * Call a tool on the specified MCP server.
 */
export async function callTool(server, tool, args) {
  const client = await getClient(server);
  return client.callTool({ name: tool, arguments: args ?? {} });
}
