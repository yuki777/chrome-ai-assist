// Background Service Worker for Chrome AI Assist

// === Native Messaging (MCP Bridge) ===
const MCP_HOST_NAME = 'com.yuki777.chrome_ai_assist.mcp';
const MCP_TIMEOUT_MS = 30_000;
let nativePort = null;
const mcpPending = new Map();
let mcpConfigured = false;
let mcpConfigDigest = '';

// Allowlist: server -> Set of allowed tools (first layer of defense)
const MCP_ALLOW = {
  backlog: new Set(['get_issue', 'get_issue_comments', 'get_issues']),
  docbase: new Set(['get_post'])
};

function ensureNativePort() {
  if (nativePort) return nativePort;

  nativePort = chrome.runtime.connectNative(MCP_HOST_NAME);

  nativePort.onMessage.addListener((msg) => {
    const req = mcpPending.get(msg.id);
    if (!req) return; // Orphan response — discard
    clearTimeout(req.timer);
    mcpPending.delete(msg.id);
    if (msg.ok) {
      req.resolve(msg.result);
    } else {
      req.reject(new Error(msg.error?.message || 'native host error'));
    }
  });

  nativePort.onDisconnect.addListener(() => {
    const err = new Error(
      chrome.runtime.lastError?.message || 'native host disconnected'
    );
    for (const [, req] of mcpPending) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    mcpPending.clear();
    nativePort = null;
    mcpConfigured = false;
  });

  return nativePort;
}

function callNativeHost(message) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      mcpPending.delete(id);
      reject(new Error('native host timeout'));
    }, MCP_TIMEOUT_MS);

    mcpPending.set(id, { resolve, reject, timer });

    try {
      const port = ensureNativePort();
      port.postMessage({ id, ...message });
    } catch (e) {
      clearTimeout(timer);
      mcpPending.delete(id);
      reject(e);
    }
  });
}

async function ensureMcpConfigured() {
  const { mcpCredentials } = await chrome.storage.local.get('mcpCredentials');
  const digest = JSON.stringify(mcpCredentials || {});
  if (mcpConfigured && digest === mcpConfigDigest) return;

  // Only send configure if there are any non-empty values
  const hasValues = mcpCredentials && Object.values(mcpCredentials).some(v => v);
  if (hasValues) {
    await callNativeHost({ type: 'configure', credentials: mcpCredentials });
  }
  mcpConfigDigest = digest;
  mcpConfigured = true;
}

// Message listener for communication between content script and extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // === MCP handlers ===
  if (request.action === 'callMcpTool') {
    const { server, tool, arguments: args } = request.payload || {};

    // Allowlist validation (background-side, first layer)
    if (!MCP_ALLOW[server]?.has(tool)) {
      sendResponse({ error: `Tool not allowed: ${server}.${tool}` });
      return true;
    }

    ensureMcpConfigured()
      .then(() => callNativeHost({ type: 'call_tool', server, tool, arguments: args }))
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (request.action === 'fetchModels') {
    handleFetchModels(request, sendResponse);
    return true; // async response
  }

  if (request.action === 'mcpPing') {
    callNativeHost({ type: 'ping' })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  // === Existing handlers ===
  if (request.action === 'getPageContent') {
    // Forward the request to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractContent' }, (response) => {
        sendResponse(response);
      });
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'callAI') {
    handleAIRequest(request.data, sendResponse);
    return true; // Will respond asynchronously
  }
});

/**
 * Listen for browser action (拡張アイコン)クリック
 * content scriptが注入されていない場合は、scripting.executeScriptで注入してからtoggleSidebarを送る
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🟢 [Background] Browser action icon clicked');
  try {
    // content scriptが既に注入されているか確認
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window.toggleSidebar
    });
    if (!result.result) {
      // content scriptを注入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content.js']
      });
      console.log('🟢 [Background] Content script injected');
    }
    // サイドバーを開く
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
  } catch (e) {
    console.error('🔴 [Background] Failed to inject content script or send message:', e);
  }
});


// 既存のメッセージリスナーは削除（重複防止のため）

// Handle AI API requests
async function handleAIRequest(data, sendResponse) {
  try {
    // Get API configuration from storage
    const config = await chrome.storage.local.get(['apiProvider', 'apiKeys', 'selectedModel']);

    if (!config.apiProvider || !config.apiKeys) {
      sendResponse({ error: 'API not configured. Please configure API settings first.' });
      return;
    }

    let response;
    switch (config.apiProvider) {
      case 'openai':
        response = await callOpenAIAPI(data, config);
        break;
      case 'anthropic':
        response = await callAnthropicAPI(data, config);
        break;
      default:
        throw new Error('Unsupported API provider');
    }

    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error('AI API Error:', error);
    sendResponse({ error: error.message });
  }
}

// OpenAI Responses API call
async function callOpenAIAPI(data, config) {
  const { openaiApiKey } = config.apiKeys;
  const model = config.selectedModel || 'gpt-4.1';

  const input = [];
  if (data.systemPrompt) {
    input.push({ role: 'developer', content: data.systemPrompt });
  }
  for (const m of data.messages) {
    input.push({
      role: m.role === 'system' ? 'developer' : m.role,
      content: m.content
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({ model, input })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error (model: ${model}): ${response.status}\n${errorText}`);
  }

  const result = await response.json();
  const msg = result.output?.find(o => o.type === 'message');
  const text = msg?.content?.find(c => c.type === 'output_text');
  if (text) return text.text;
  throw new Error(`OpenAI API: 応答テキストが見つかりません (model: ${model})`);
}

// Anthropic API call (placeholder)
async function callAnthropicAPI(data, config) {
  const { anthropicApiKey } = config.apiKeys;
  const model = config.selectedModel || 'claude-sonnet-4-6';

  // Anthropic APIではsystemプロンプトは別パラメータ
  const requestBody = {
    model: model,
    max_tokens: 32000,
    messages: data.messages
  };

  if (data.systemPrompt) {
    requestBody.system = data.systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      // Anthropicの警告ヘッダーを追加
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (e) {
      errorText = '(詳細取得失敗)';
    }
    throw new Error(`Anthropic API error: ${response.status}\n${errorText}`);
  }

  const result = await response.json();
  return result.content[0].text;
}

// Extension installation handler
chrome.runtime.onInstalled.addListener(() => {
  console.log('Chrome AI Assist installed');
});

// Debug function to check current settings
async function checkCurrentSettings() {
  try {
    const settings = await chrome.storage.local.get(['apiProvider', 'selectedModel', 'apiKeys']);
    console.log('Current settings:', settings);
    return settings;
  } catch (error) {
    console.error('Failed to get settings:', error);
  }
}

// Expose functions globally for console access
globalThis.checkCurrentSettings = checkCurrentSettings;

// === Fetch Models API ===

async function handleFetchModels(request, sendResponse) {
  const { provider, apiKeys } = request;
  try {
    let models;
    switch (provider) {
      case 'openai':
        models = await listOpenAIModels(apiKeys);
        break;
      case 'anthropic':
        models = await listAnthropicModels(apiKeys);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    sendResponse({ success: true, models });
  } catch (error) {
    console.error('fetchModels error:', error);
    sendResponse({ error: error.message });
  }
}

async function listOpenAIModels(apiKeys) {
  const { openaiApiKey } = apiKeys;
  if (!openaiApiKey) {
    throw new Error('OpenAI APIキーを入力してください');
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  // テキスト生成モデルのみ（embedding/audio/image系を除外）
  const textGenPattern = /^(gpt-|o[1-9]|chatgpt-)/;
  return (result.data || [])
    .filter(m => textGenPattern.test(m.id))
    .map(m => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listAnthropicModels(apiKeys) {
  const { anthropicApiKey } = apiKeys;
  if (!anthropicApiKey) {
    throw new Error('Anthropic APIキーを入力してください');
  }

  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return (result.data || [])
    .map(m => ({ id: m.id, name: m.display_name || m.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
