// Sidebar JavaScript for Chrome AI Assist

let pageData = null;
let chatHistory = [];
let isApiConfigured = false;
let isComposing = false; // IME変換状態を管理
let isApiRequestInProgress = false; // APIリクエスト中フラグ
let debugInfo = {
  lastApiCall: null,
  apiCalls: [],
  performanceMetrics: {}
};

// DOM Elements
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const closeBtn = document.getElementById('closeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const debugBtn = document.getElementById('debugBtn');
const apiStatus = document.getElementById('apiStatus');
const initialMessage = document.getElementById('initialMessage');

// Debug Panel Elements
const debugPanel = document.getElementById('debugPanel');
const debugCloseBtn = document.getElementById('debugCloseBtn');
const debugExportBtn = document.getElementById('debugExportBtn');

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkApiConfiguration();
  autoResizeTextarea();
});

// Setup event listeners
function setupEventListeners() {
  // Close button
  closeBtn.addEventListener('click', () => {
    parent.postMessage({ type: 'CLOSE_SIDEBAR' }, '*');
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Debug button
  debugBtn.addEventListener('click', toggleDebugPanel);

  // Debug panel close button
  debugCloseBtn.addEventListener('click', closeDebugPanel);

  // Debug action buttons
  debugExportBtn.addEventListener('click', exportDebugInfo);

  // Send button
  sendBtn.addEventListener('click', sendMessage);

  // Message input - IME変換状態を監視
  messageInput.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  
  messageInput.addEventListener('compositionend', () => {
    isComposing = false;
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendButtonState();
  });

  // Listen for messages from content script
  window.addEventListener('message', handleMessage);
}

// Handle messages from content script
function handleMessage(event) {
  if (event.data.type === 'INIT') {
    pageData = event.data.data;
    initializeChat();
  } else if (event.data.type === 'AI_RESPONSE') {
    handleAIResponse(event.data.data);
  }
}

// Initialize chat with page content
function initializeChat() {
  if (!pageData) return;

  // Update page info
  pageTitle.textContent = pageData.title || 'タイトルなし';
  pageUrl.textContent = pageData.url || '';

  // Create initial AI message
  const initialText = `このページについて質問や指示があればどうぞ！`;
  
  // Update initial message
  setTimeout(() => {
    updateInitialMessage(initialText);
    enableInput();
  }, 1000);

  // Initialize chat history with page content
  chatHistory = [
    {
      role: 'system',
      content: `あなたは現在開いているWebページの内容を理解し、分析できるAIアシスタントです。

【現在のページ情報】
- URL: ${pageData.url}
- タイトル: ${pageData.title}
- ページコンテンツ: 
${pageData.content}

【あなたの役割】
1. 上記のページコンテンツを正確に理解し、記憶してください
2. ユーザーの質問に対して、ページの内容に基づいた正確な回答を提供してください
3. ページに記載されていない情報については、その旨を明確に伝えてください
4. 必要に応じて、ページの特定の部分を引用して回答してください

【重要な指示】
- ページの内容から逸脱した推測や一般的な知識での回答は避けてください
- ユーザーが「このページ」「この記事」と言った場合は、必ず上記のページコンテンツを参照してください
- 回答する際は、どの部分を参照したかを明示してください
- すべての回答は日本語で行ってください`
    },
    {
      role: 'assistant',
      content: initialText
    }
  ];
}

// Update initial message
function updateInitialMessage(text) {
  const loadingDiv = initialMessage.querySelector('.loading');
  if (loadingDiv) {
    loadingDiv.remove();
    const messageContent = initialMessage.querySelector('.message-content');
    messageContent.textContent = text;
  }
}

// Enable input after initialization
function enableInput() {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.placeholder = '質問や指示を入力してください...';
}

// Check API configuration
async function checkApiConfiguration() {
  try {
    const config = await chrome.storage.local.get(['apiProvider', 'apiKeys']);
    
    if (config.apiProvider && config.apiKeys) {
      isApiConfigured = true;
      apiStatus.textContent = `${config.apiProvider.toUpperCase()} API設定済み`;
      apiStatus.className = 'api-status connected';
    } else {
      isApiConfigured = false;
      apiStatus.textContent = 'API未設定 - 設定ボタンから設定してください';
      apiStatus.className = 'api-status error';
    }
  } catch (error) {
    console.error('Error checking API configuration:', error);
    isApiConfigured = false;
    apiStatus.textContent = 'API設定の確認に失敗しました';
    apiStatus.className = 'api-status error';
  }
}

// Send message
function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !isApiConfigured || isApiRequestInProgress) return;

  // Set API request in progress
  isApiRequestInProgress = true;
  updateSendButtonState();

  // Record start time for performance tracking
  const startTime = performance.now();
  debugInfo.performanceMetrics.lastStartTime = startTime;

  // Add user message to chat
  addUserMessage(message);
  
  // Add to chat history
  chatHistory.push({
    role: 'user',
    content: message
  });

  // Clear input
  messageInput.value = '';
  autoResizeTextarea();

  // Show loading indicator
  const loadingMessage = addAIMessage('', true);

  // Prepare request data for debugging
  const requestData = {
    messages: chatHistory.slice(1), // Exclude system message for API calls
    systemPrompt: chatHistory[0].content
  };

  // Send to AI
  parent.postMessage({
    type: 'SEND_MESSAGE',
    data: requestData
  }, '*');
}

// Add user message to chat
function addUserMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
      </svg>
    </div>
    <div class="message-content">${escapeHtml(text)}</div>
  `;

  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Add AI message to chat
function addAIMessage(text, isLoading = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  
  if (isLoading) {
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="loading">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>AIが応答を生成中...</span>
        </div>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="message-content">${formatMessage(text)}</div>
    `;
  }

  chatMessages.appendChild(messageDiv);
  scrollToBottom();
  return messageDiv;
}

// Handle AI response
function handleAIResponse(response) {
  // Reset API request in progress flag
  isApiRequestInProgress = false;
  updateSendButtonState();

  // Calculate processing time
  if (debugInfo.performanceMetrics.lastStartTime) {
    const endTime = performance.now();
    const processingTime = Math.round(endTime - debugInfo.performanceMetrics.lastStartTime);
    debugInfo.performanceMetrics.lastProcessingTime = `${processingTime}ms`;
  }

  // Track API call for debugging
  const lastRequest = {
    messages: chatHistory.slice(1),
    systemPrompt: chatHistory.length > 0 ? chatHistory[0].content : ''
  };
  
  trackApiCall(
    lastRequest,
    response.success ? response.data : null,
    response.success,
    response.error
  );

  // Remove loading message
  const loadingMessages = chatMessages.querySelectorAll('.ai-message .loading');
  loadingMessages.forEach(loading => {
    const messageDiv = loading.closest('.message');
    if (messageDiv) messageDiv.remove();
  });

  if (response.error) {
    // Show error message
    addErrorMessage(response.error);
  } else if (response.success && response.data) {
    // Add AI response to chat
    addAIMessage(response.data);
    
    // Add to chat history
    chatHistory.push({
      role: 'assistant',
      content: response.data
    });
  }
}

// Add error message
function addErrorMessage(error) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
      </svg>
    </div>
    <div class="message-content">
      <div class="error-message">
        <strong>エラーが発生しました：</strong><br>
        ${escapeHtml(error)}
      </div>
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Format message with basic markdown support
function formatMessage(text) {
  if (!text) return '';
  
  let formatted = escapeHtml(text);
  
  // Bold: **text** or __text__
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Code: `code`
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Auto-resize textarea
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Scroll to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update send button state based on current conditions
function updateSendButtonState() {
  const hasMessage = messageInput.value.trim().length > 0;
  const canSend = isApiConfigured && !isApiRequestInProgress && hasMessage;
  
  sendBtn.disabled = !canSend;
  
  // Update button appearance based on state
  if (isApiRequestInProgress) {
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.title = 'AI応答待ち中...';
  } else if (!isApiConfigured) {
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.title = 'API設定が必要です';
  } else if (!hasMessage) {
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.title = 'メッセージを入力してください';
  } else {
    sendBtn.style.opacity = '1';
    sendBtn.style.cursor = 'pointer';
    sendBtn.title = '送信';
  }
}

// Update API status when storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.apiProvider || changes.apiKeys)) {
    checkApiConfiguration();
  }
});

// =============================================================================
// DEBUG FUNCTIONS
// =============================================================================

// Toggle debug panel
function toggleDebugPanel() {
  if (debugPanel.style.display === 'none' || !debugPanel.style.display) {
    showDebugPanel();
  } else {
    closeDebugPanel();
  }
}

// Show debug panel
async function showDebugPanel() {
  debugPanel.style.display = 'flex';
  await updateDebugInfo();
  setupExpandableElements();
}

// Close debug panel
function closeDebugPanel() {
  debugPanel.style.display = 'none';
}

// Update debug info
async function updateDebugInfo() {
  try {
    // Get current config
    const config = await chrome.storage.local.get(['apiProvider', 'apiKeys', 'selectedModel']);
    
    // Update API info
    updateElement('debugProvider', config.apiProvider || '未設定');
    updateElement('debugModel', config.selectedModel || 'デフォルト');
    updateElement('debugApiStatus', isApiConfigured ? '接続済み' : '未設定');
    
    // Update page info
    if (pageData) {
      updateElement('debugPageUrl', pageData.url || '-');
      updateElement('debugPageTitle', pageData.title || '-');
      updateElement('debugContentLength', pageData.content ? `${pageData.content.length.toLocaleString()}文字` : '-');
      updateElement('debugTimestamp', pageData.timestamp ? new Date(pageData.timestamp).toLocaleString() : '-');
    }
    
    // Update chat info
    updateElement('debugMessageCount', chatHistory.length.toString());
    updateElement('debugSystemPrompt', chatHistory.length > 0 ? chatHistory[0].content : '-');
    
    // Update last API call info
    if (debugInfo.lastApiCall) {
      updateElement('debugLastCallTime', new Date(debugInfo.lastApiCall.timestamp).toLocaleString());
      updateElement('debugLastCallStatus', debugInfo.lastApiCall.success ? '成功' : 'エラー');
      updateElement('debugLastRequest', JSON.stringify(debugInfo.lastApiCall.request, null, 2));
      updateElement('debugLastResponse', debugInfo.lastApiCall.success ? 
        debugInfo.lastApiCall.response : debugInfo.lastApiCall.error);
    }
    
    // Update performance info
    updateElement('debugProcessingTime', debugInfo.performanceMetrics.lastProcessingTime || '-');
    updateElement('debugMemoryUsage', getMemoryUsage());
    
  } catch (error) {
    console.error('Error updating debug info:', error);
  }
}

// Update element text content safely
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// Get memory usage estimation
function getMemoryUsage() {
  const totalMessages = chatHistory.length;
  const totalChars = chatHistory.reduce((sum, msg) => sum + (msg.content ? msg.content.length : 0), 0);
  const pageContentSize = pageData ? (pageData.content ? pageData.content.length : 0) : 0;
  
  const estimatedKB = Math.round((totalChars + pageContentSize) / 1024 * 2); // rough estimation
  return `約 ${estimatedKB} KB`;
}

// Setup expandable elements
function setupExpandableElements() {
  const expandableElements = document.querySelectorAll('.debug-value.expandable');
  expandableElements.forEach(element => {
    element.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  });
}


// Export debug info as JSON
async function exportDebugInfo() {
  try {
    const config = await chrome.storage.local.get(['apiProvider', 'apiKeys', 'selectedModel']);
    
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      apiConfig: {
        provider: config.apiProvider,
        model: config.selectedModel,
        configured: isApiConfigured
      },
      pageData: pageData,
      chatHistory: chatHistory,
      debugInfo: debugInfo,
      performanceMetrics: {
        memoryUsage: getMemoryUsage(),
        messageCount: chatHistory.length,
        lastProcessingTime: debugInfo.performanceMetrics.lastProcessingTime
      }
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrome-ai-assist-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccessMessage('デバッグ情報をエクスポートしました');
  } catch (error) {
    console.error('Error exporting debug info:', error);
    showErrorMessage('エクスポートに失敗しました');
  }
}

// Show success message
function showSuccessMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'success-message';
  messageDiv.textContent = message;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 3000);
}

// Show error message
function showErrorMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'error-message';
  messageDiv.textContent = message;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 3000);
}

// Track API calls for debugging
function trackApiCall(request, response, success, error) {
  const apiCall = {
    timestamp: new Date().toISOString(),
    request: request,
    response: response,
    success: success,
    error: error,
    processingTime: debugInfo.performanceMetrics.lastProcessingTime
  };
  
  debugInfo.lastApiCall = apiCall;
  debugInfo.apiCalls.push(apiCall);
  
  // Keep only last 10 API calls
  if (debugInfo.apiCalls.length > 10) {
    debugInfo.apiCalls = debugInfo.apiCalls.slice(-10);
  }
}
