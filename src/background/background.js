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
  
  // Validate and correct model name
  const validBedrockModels = [
    'us.anthropic.claude-opus-4-20250514-v1:0',
    'us.anthropic.claude-sonnet-4-20250514-v1:0'
  ];
  
  let model = config.selectedModel || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
  
  // Check if selected model is valid, if not use default
  if (!validBedrockModels.includes(model)) {
    console.warn('Invalid Bedrock model detected, using default:', model);
    model = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    
    // Update the stored setting to the correct model
    try {
      await chrome.storage.local.set({ selectedModel: model });
    } catch (e) {
      console.error('Failed to update model in storage:', e);
    }
  }

  if (!awsAccessKey || !awsSecretKey || !awsRegion) {
    throw new Error('AWS credentials are required for Bedrock API');
  }

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 32000,
    messages: data.messages,
    system: data.systemPrompt || "You are a helpful AI assistant analyzing web content."
  };

  const url = `https://bedrock-runtime.${awsRegion}.amazonaws.com/model/${model}/invoke`;
  const body = JSON.stringify(requestBody);

  // Generate AWS Signature V4
  const signedHeaders = await generateAWSSignatureV4({
    method: 'POST',
    url: url,
    body: body,
    accessKey: awsAccessKey,
    secretKey: awsSecretKey,
    sessionToken: awsSessionToken,
    region: awsRegion,
    service: 'bedrock'
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...signedHeaders
    },
    body: body
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

// AWS RFC 3986 URI encoding (required for AWS Signature V4)
function awsUriEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

// AWS Signature V4 implementation
async function generateAWSSignatureV4(params) {
  const { method, url, body, accessKey, secretKey, sessionToken, region, service } = params;
  
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  
  // Create canonical URI with proper AWS RFC 3986 encoding
  // Each path segment should be URI encoded according to RFC 3986, but slashes should remain as slashes
  const pathSegments = urlObj.pathname.split('/');
  const canonicalUri = pathSegments.map(segment => 
    segment === '' ? '' : awsUriEncode(segment)
  ).join('/');
  
  // Create timestamp
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  
  // Create canonical headers (must be sorted)
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-date:${amzDate}`
  ];
  
  if (sessionToken) {
    canonicalHeaders.push(`x-amz-security-token:${sessionToken}`);
  }
  
  canonicalHeaders.sort();
  const signedHeaders = canonicalHeaders.map(h => h.split(':')[0]).join(';');
  
  const payloadHash = await sha256(body);
  
  const canonicalRequest = [
    method,
    canonicalUri,
    '', // query string (empty for our case)
    canonicalHeaders.join('\n') + '\n',
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  // Return headers
  const headers = {
    'Authorization': authorizationHeader,
    'X-Amz-Date': amzDate
  };
  
  if (sessionToken) {
    headers['X-Amz-Security-Token'] = sessionToken;
  }
  
  return headers;
}

// Helper functions for AWS Signature V4
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmacSha256(`AWS4${key}`, dateStamp);
  const kRegion = await hmacSha256(hexToUint8Array(kDate), regionName);
  const kService = await hmacSha256(hexToUint8Array(kRegion), serviceName);
  const kSigning = await hmacSha256(hexToUint8Array(kService), 'aws4_request');
  return hexToUint8Array(kSigning);
}

function hexToUint8Array(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

// OpenAI API call (placeholder)
async function callOpenAIAPI(data, config) {
  const { openaiApiKey } = config.apiKeys;
  const model = config.selectedModel || 'gpt-4.1';

  // OpenAI APIではsystemプロンプトをmessagesの最初に追加
  const messages = [];
  if (data.systemPrompt) {
    messages.push({
      role: 'system',
      content: data.systemPrompt
    });
  }
  messages.push(...data.messages);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
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
  const model = config.selectedModel || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

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
  
  // Force update any invalid model settings
  chrome.storage.local.get(['selectedModel', 'apiProvider']).then(settings => {
    if (settings.apiProvider === 'bedrock' && settings.selectedModel) {
      const validBedrockModels = [
        'us.anthropic.claude-opus-4-20250514-v1:0',
        'us.anthropic.claude-sonnet-4-20250514-v1:0'
      ];
      
      if (!validBedrockModels.includes(settings.selectedModel)) {
        console.log('Updating invalid Bedrock model on installation:', settings.selectedModel);
        chrome.storage.local.set({ selectedModel: 'us.anthropic.claude-sonnet-4-20250514-v1:0' });
      }
    }
  });
});

// Add manual setting reset function for debugging
async function resetBedrockModel() {
  try {
    await chrome.storage.local.set({
      selectedModel: 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    });
    console.log('Bedrock model reset to default');
  } catch (error) {
    console.error('Failed to reset model:', error);
  }
}

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

// Force reset all problematic settings
async function forceResetBedrockSettings() {
  try {
    const settings = await chrome.storage.local.get(['apiProvider', 'selectedModel']);
    console.log('Current settings before reset:', settings);
    
    if (settings.apiProvider === 'bedrock') {
      await chrome.storage.local.set({
        selectedModel: 'us.anthropic.claude-sonnet-4-20250514-v1:0'
      });
      console.log('Bedrock settings force reset to valid model');
    }
    
    const newSettings = await chrome.storage.local.get(['apiProvider', 'selectedModel']);
    console.log('Settings after reset:', newSettings);
  } catch (error) {
    console.error('Failed to force reset settings:', error);
  }
}

// Expose functions globally for console access
globalThis.resetBedrockModel = resetBedrockModel;
globalThis.checkCurrentSettings = checkCurrentSettings;
globalThis.forceResetBedrockSettings = forceResetBedrockSettings;

// Immediately force reset if invalid model is detected
chrome.storage.local.get(['apiProvider', 'selectedModel']).then(settings => {
  if (settings.apiProvider === 'bedrock' && settings.selectedModel) {
    const validBedrockModels = [
      'us.anthropic.claude-opus-4-20250514-v1:0',
      'us.anthropic.claude-sonnet-4-20250514-v1:0'
    ];
    
    if (!validBedrockModels.includes(settings.selectedModel)) {
      console.log('🚨 Invalid Bedrock model detected immediately:', settings.selectedModel);
      chrome.storage.local.set({ selectedModel: 'us.anthropic.claude-sonnet-4-20250514-v1:0' });
      console.log('✅ Model reset to default immediately');
    }
  }
});
