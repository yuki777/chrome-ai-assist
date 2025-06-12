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
const historyBtn = document.getElementById('historyBtn');
const apiStatus = document.getElementById('apiStatus');
const initialMessage = document.getElementById('initialMessage');

// Debug Panel Elements
const debugPanel = document.getElementById('debugPanel');
const debugCloseBtn = document.getElementById('debugCloseBtn');
const debugExportBtn = document.getElementById('debugExportBtn');

// History Panel Elements
const historyPanel = document.getElementById('historyPanel');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const historyList = document.getElementById('historyList');
const historyClearAllBtn = document.getElementById('historyClearAllBtn');

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('messageInput');
  if (textarea && !textarea.disabled) {
    textarea.focus();
  }

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

  // History button
  historyBtn.addEventListener('click', toggleHistoryPanel);

  // History panel close button
  historyCloseBtn.addEventListener('click', closeHistoryPanel);

  // History action buttons
  historyClearAllBtn.addEventListener('click', clearAllHistory);

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
  const initialText = `このページについて質問や指示があればどうぞ！ページ内容に関連した質問にもお答えできます。`;
  
  // Update initial message
  setTimeout(() => {
    updateInitialMessage(initialText);
    enableInput();
  }, 1000);

  // Initialize chat history with page content
  chatHistory = [
    {
      role: 'system',
      content: `あなたは現在開いているWebページの内容を理解し、分析できる有用なAIアシスタントです。

【現在のページ情報】
- URL: ${pageData.url}
- タイトル: ${pageData.title}
- ページコンテンツ: 
${pageData.content}

【あなたの役割と対応方針】
1. **主要機能**: 上記のページコンテンツを正確に理解し、記憶してください
2. **基本回答**: ユーザーの質問に対して、ページの内容に基づいた正確な回答を提供してください
3. **関連情報提供**: ページ内容に関連する質問については、以下の優先順位で対応してください：
   - 第1優先: ページ内容から直接答えられる場合はその情報を提供
   - 第2優先: ページ内容にない場合は、その旨を明示した上で関連する一般的な知識を提供
   - 第3優先: 調査や追加情報が必要な場合は、具体的な調査方法や情報源を提案
4. **引用と明示**: 回答する際は、どの部分を参照したかを明示してください

【対応ガイドライン】
✅ **積極的に対応すべき質問**:
- ページ内容についての説明や分析
- ページで言及されている技術・概念に関する追加説明
- ページ内容に関連する一般的な質問（コスト、技術比較、影響分析など）
- ページ内容を基にした推奨事項や次のステップの提案

✅ **対応時の注意点**:
- ページ内容が情報源である場合は「このページによると」「ページに記載されている通り」などと明示
- ページにない情報を補完する場合は「ページには記載されていませんが」と前置きを入れる
- 不確実な情報については「一般的には」「通常の場合」などの表現を使用
- 調査が必要な場合は具体的な調査方法を提案

❌ **避けるべき対応**:
- 完全に無関係な話題への展開
- 根拠のない断定的な発言

【重要な指示】
- ユーザーが「このページ」「この記事」と言った場合は、必ず上記のページコンテンツを参照してください
- 情報の出典（ページ内容 vs 一般知識）を明確に区別してください
- すべての回答は日本語で行ってください
- ユーザーにとって有用で実用的な回答を心がけてください`
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
    messageDiv.innerHTML = `<div class="message-content">
      <div class="loading">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>AIが応答を生成中...</span>
      </div>
    </div>`;
  } else {
    messageDiv.innerHTML = `<div class="message-content">${formatMessage(text)}</div>`;
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
    
    // Save chat history after AI response
    saveChatHistory();
  }
}

// Add error message
function addErrorMessage(error) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  
  messageDiv.innerHTML = `
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

// =============================================================================
// HISTORY FUNCTIONS
// =============================================================================

// Current history session ID
let currentHistoryId = null;

// Toggle history panel
function toggleHistoryPanel() {
  if (historyPanel.style.display === 'none' || !historyPanel.style.display) {
    showHistoryPanel();
  } else {
    closeHistoryPanel();
  }
}

// Show history panel
async function showHistoryPanel() {
  historyPanel.style.display = 'flex';
  await loadHistoryList();
}

// Close history panel
function closeHistoryPanel() {
  historyPanel.style.display = 'none';
}

// Generate history ID based on date and URL
function generateHistoryId(pageData) {
  if (!pageData || !pageData.url) return null;
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const urlHash = pageData.url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  return `${date}_${urlHash}`;
}

// Save current chat session to history
async function saveChatHistory() {
  if (!pageData || !chatHistory || chatHistory.length < 2) return; // システムメッセージ + 初期メッセージのみの場合は保存しない
  
  try {
    const config = await chrome.storage.local.get(['apiProvider', 'selectedModel']);
    const historyId = generateHistoryId(pageData);
    
    if (!historyId) return;
    
    const historyItem = {
      id: historyId,
      pageInfo: {
        title: pageData.title || 'タイトルなし',
        url: pageData.url,
        timestamp: pageData.timestamp || Date.now()
      },
      chatHistory: [...chatHistory], // Copy array
      apiConfig: {
        provider: config.apiProvider || 'unknown',
        model: config.selectedModel || 'default'
      },
      savedAt: Date.now(),
      messageCount: chatHistory.length - 1, // Exclude system message
      lastUpdated: Date.now()
    };
    
    // Get existing history list
    const result = await chrome.storage.local.get(['chrome-ai-assist-chat-history-list']);
    let historyList = result['chrome-ai-assist-chat-history-list'] || [];
    
    // Remove old entry with same ID if exists
    historyList = historyList.filter(item => item.id !== historyId);
    
    // Add new entry at the beginning
    historyList.unshift(historyItem);
    
    // Clean up old history (older than 1 month)
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    historyList = historyList.filter(item => item.savedAt > oneMonthAgo);
    
    // Save back to storage
    await chrome.storage.local.set({ 'chrome-ai-assist-chat-history-list': historyList });
    
    currentHistoryId = historyId;
    console.log('Chat history saved:', historyId);
    
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

// Load and display history list
async function loadHistoryList() {
  try {
    const result = await chrome.storage.local.get(['chrome-ai-assist-chat-history-list']);
    const historyList = result['chrome-ai-assist-chat-history-list'] || [];
    
    // Clean up old history
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cleanedHistoryList = historyList.filter(item => item.savedAt > oneMonthAgo);
    
    // Update storage if we removed any items
    if (cleanedHistoryList.length !== historyList.length) {
      await chrome.storage.local.set({ 'chrome-ai-assist-chat-history-list': cleanedHistoryList });
    }
    
    displayHistoryList(cleanedHistoryList);
    
  } catch (error) {
    console.error('Error loading history list:', error);
    showErrorMessage('履歴の読み込みに失敗しました');
  }
}

// Display history list in UI
function displayHistoryList(historyData) {
  if (!historyData || historyData.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <p>履歴がありません</p>
        <small>チャットを開始すると履歴が保存されます</small>
      </div>
    `;
    return;
  }
  
  historyList.innerHTML = '';
  
  historyData.forEach(item => {
    const historyItemDiv = createHistoryItemElement(item);
    historyList.appendChild(historyItemDiv);
  });
}

// Create history item element
function createHistoryItemElement(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'history-item';
  if (item.id === currentHistoryId) {
    itemDiv.classList.add('active');
  }
  
  const date = new Date(item.savedAt).toLocaleDateString('ja-JP');
  const time = new Date(item.savedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  
  itemDiv.innerHTML = `
    <div class="history-item-header">
      <div class="history-item-title">${escapeHtml(item.pageInfo.title)}</div>
      <div class="history-item-actions">
        <button class="history-item-delete-btn" data-history-id="${item.id}" title="削除">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" 
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="history-item-url">${escapeHtml(item.pageInfo.url)}</div>
    <div class="history-item-info">
      <div class="history-item-date">${date} ${time}</div>
      <div class="history-item-stats">
        <div class="history-item-stat">
          💬 ${item.messageCount}
        </div>
        <div class="history-item-stat">
          🔧 ${escapeHtml(item.apiConfig.provider)}
        </div>
      </div>
    </div>
  `;
  
  // Add click event to restore history
  itemDiv.addEventListener('click', (e) => {
    if (!e.target.closest('.history-item-delete-btn')) {
      restoreChatHistory(item.id);
    }
  });
  
  // Add delete button event
  const deleteBtn = itemDiv.querySelector('.history-item-delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteHistoryItem(item.id);
  });
  
  return itemDiv;
}

// Restore chat history from saved session
async function restoreChatHistory(historyId) {
  try {
    const result = await chrome.storage.local.get(['chrome-ai-assist-chat-history-list']);
    const historyList = result['chrome-ai-assist-chat-history-list'] || [];
    
    const historyItem = historyList.find(item => item.id === historyId);
    if (!historyItem) {
      showErrorMessage('履歴が見つかりません');
      return;
    }
    
    // Clear current chat
    clearCurrentChat();
    
    // Restore page data
    pageData = {
      title: historyItem.pageInfo.title,
      url: historyItem.pageInfo.url,
      timestamp: historyItem.pageInfo.timestamp,
      content: '', // Content is embedded in system message
    };
    
    // Update page info display
    pageTitle.textContent = pageData.title;
    pageUrl.textContent = pageData.url;
    
    // Restore chat history
    chatHistory = [...historyItem.chatHistory];
    currentHistoryId = historyId;
    
    // Rebuild chat UI
    rebuildChatUI();
    
    // Close history panel
    closeHistoryPanel();
    
    showSuccessMessage('履歴を復元しました');
    
  } catch (error) {
    console.error('Error restoring chat history:', error);
    showErrorMessage('履歴の復元に失敗しました');
  }
}

// Clear current chat
function clearCurrentChat() {
  chatMessages.innerHTML = '';
  chatHistory = [];
  currentHistoryId = null;
}

// Rebuild chat UI from chat history
function rebuildChatUI() {
  chatMessages.innerHTML = '';
  
  // Skip system message (index 0) and rebuild UI from user/assistant messages
  for (let i = 1; i < chatHistory.length; i++) {
    const message = chatHistory[i];
    
    if (message.role === 'user') {
      addUserMessage(message.content);
    } else if (message.role === 'assistant') {
      addAIMessage(message.content);
    }
  }
  
  scrollToBottom();
}

// Delete specific history item
async function deleteHistoryItem(historyId) {
  if (!confirm('この履歴を削除しますか？')) return;
  
  try {
    const result = await chrome.storage.local.get(['chrome-ai-assist-chat-history-list']);
    let historyList = result['chrome-ai-assist-chat-history-list'] || [];
    
    // Remove the item
    historyList = historyList.filter(item => item.id !== historyId);
    
    // Save back to storage
    await chrome.storage.local.set({ 'chrome-ai-assist-chat-history-list': historyList });
    
    // If deleted item was current session, clear current history ID
    if (historyId === currentHistoryId) {
      currentHistoryId = null;
    }
    
    // Reload history list
    await loadHistoryList();
    
    showSuccessMessage('履歴を削除しました');
    
  } catch (error) {
    console.error('Error deleting history item:', error);
    showErrorMessage('履歴の削除に失敗しました');
  }
}

// Clear all history
async function clearAllHistory() {
  if (!confirm('すべての履歴を削除しますか？この操作は取り消せません。')) return;
  
  try {
    await chrome.storage.local.set({ 'chrome-ai-assist-chat-history-list': [] });
    currentHistoryId = null;
    
    // Reload history list
    await loadHistoryList();
    
    showSuccessMessage('すべての履歴を削除しました');
    
  } catch (error) {
    console.error('Error clearing all history:', error);
    showErrorMessage('履歴の削除に失敗しました');
  }
}
