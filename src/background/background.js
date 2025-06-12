// Background Service Worker for Chrome AI Assist

// Message listener for communication between content script and extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      case 'bedrock':
        response = await callBedrockAPI(data, config);
        break;
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

// AWS Bedrock API call
async function callBedrockAPI(data, config) {
  const { awsAccessKey, awsSecretKey, awsRegion, awsSessionToken } = config.apiKeys;
  const model = config.selectedModel || 'anthropic.claude-sonnet-4-20250514-v1:0';

  // AWS Signature V4 implementation would go here
  // For now, this is a placeholder structure
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4000,
    messages: data.messages,
    system: data.systemPrompt || "You are a helpful AI assistant analyzing web content."
  };

  // This would need proper AWS authentication implementation
  const response = await fetch(`https://bedrock-runtime.${awsRegion}.amazonaws.com/model/${model}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // AWS authentication headers would go here
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
    throw new Error(`Bedrock API error: ${response.status}\n${errorText}`);
  }

  const result = await response.json();
  return result.content[0].text;
}

// OpenAI API call (placeholder)
async function callOpenAIAPI(data, config) {
  const { openaiApiKey } = config.apiKeys;
  const model = config.selectedModel || 'gpt-4';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: data.messages,
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (e) {
      errorText = '(詳細取得失敗)';
    }
    throw new Error(`OpenAI API error: ${response.status}\n${errorText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

// Anthropic API call (placeholder)
async function callAnthropicAPI(data, config) {
  const { anthropicApiKey } = config.apiKeys;
  const model = config.selectedModel || 'claude-3-sonnet-20240229';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      // Anthropicの警告ヘッダーを追加
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4000,
      messages: data.messages
    })
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
