#!/usr/bin/env node

import { startMessageLoop, writeMessage } from './native-protocol.js';
import { callTool } from './mcp-bridge.js';

const log = (msg) => process.stderr.write(`[host] ${new Date().toISOString()} ${msg}\n`);

// Tool allowlist (second layer of defense; background.js also validates)
const ALLOW = {
  backlog: new Set(['get_issue', 'get_issue_comments']),
  docbase: new Set(['get_post'])
};

function reply(id, payload) {
  try {
    writeMessage(process.stdout, { id, ...payload });
  } catch (e) {
    // If response is too large, send a truncated error
    log(`reply error: ${e.message}`);
    const errorPayload = { id, ok: false, error: { message: e.message } };
    try {
      writeMessage(process.stdout, errorPayload);
    } catch (e2) {
      log(`fatal reply error: ${e2.message}`);
    }
  }
}

async function handle(msg) {
  const id = msg?.id ?? crypto.randomUUID();

  try {
    if (msg?.type === 'ping') {
      return reply(id, { ok: true, result: { pong: true } });
    }

    if (msg?.type === 'list_tools') {
      return reply(id, {
        ok: true,
        result: {
          servers: Object.fromEntries(
            Object.entries(ALLOW).map(([server, tools]) => [server, [...tools]])
          )
        }
      });
    }

    if (msg?.type !== 'call_tool') {
      throw new Error(`unknown type: ${msg?.type}`);
    }

    const { server, tool, arguments: args } = msg;

    if (!ALLOW[server]?.has(tool)) {
      throw new Error(`tool not allowed: ${server}.${tool}`);
    }

    log(`call_tool: ${server}.${tool}`);
    const result = await callTool(server, tool, args);
    return reply(id, { ok: true, result });
  } catch (e) {
    log(`error: ${e.message}`);
    reply(id, { ok: false, error: { message: e.message } });
  }
}

// Ensure stdin stays open
process.stdin.resume();

log('started');

startMessageLoop(
  process.stdin,
  (m) => { void handle(m); },
  (e) => log(`protocol error: ${e.message}`)
);
