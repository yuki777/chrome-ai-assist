// Popup JavaScript for Chrome AI Assist

// DOM Elements
const apiStatus = document.getElementById('apiStatus');
const currentPage = document.getElementById('currentPage');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Toggle sidebar button
  toggleSidebarBtn.addEventListener('click', () => {
    console.log('🔵 [Popup] Toggle sidebar button clicked');
    console.log('🔵 [Popup] Sending toggleSidebar message to background script');
    
    chrome.runtime.sendMessage({ action: 'toggleSidebar' }, (response) => {
      console.log('🔵 [Popup] Response from background script:', response);
      if (chrome.runtime.lastError) {
        console.error('🔴 [Popup] Runtime error:', chrome.runtime.lastError);
      }
    });
    
    console.log('🔵 [Popup] Closing popup window');
    window.close(); // Close popup after action
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    console.log('🔵 [Popup] Settings button clicked');
    chrome.runtime.openOptionsPage();
    window.close(); // Close popup after action
  });
}

// Initialize popup data
async function initializePopup() {
  await Promise.all([
    checkApiStatus(),
    getCurrentPageInfo()
  ]);
}

// Check API configuration status
async function checkApiStatus() {
  try {
    const config = await chrome.storage.local.get(['apiProvider', 'apiKeys']);
    
    if (config.apiProvider && config.apiKeys) {
      let providerName = config.apiProvider.toUpperCase();
      let statusText = '';
      let isConfigured = false;

      // Check specific provider configurations
      switch (config.apiProvider) {
        case 'bedrock':
          const { awsAccessKey, awsSecretKey, awsRegion } = config.apiKeys;
          if (awsAccessKey && awsSecretKey && awsRegion) {
            statusText = `${providerName} (${awsRegion})`;
            isConfigured = true;
          } else {
            statusText = `${providerName} - 設定不完全`;
          }
          break;
          
        case 'openai':
          const { openaiApiKey } = config.apiKeys;
          if (openaiApiKey) {
            statusText = `${providerName} - 設定済み`;
            isConfigured = true;
          } else {
            statusText = `${providerName} - APIキー未設定`;
          }
          break;
          
        case 'anthropic':
          const { anthropicApiKey } = config.apiKeys;
          if (anthropicApiKey) {
            statusText = `${providerName} - 設定済み`;
            isConfigured = true;
          } else {
            statusText = `${providerName} - APIキー未設定`;
          }
          break;
          
        default:
          statusText = '不明なプロバイダー';
      }

      apiStatus.textContent = statusText;
      apiStatus.className = isConfigured ? 'status-value connected' : 'status-value error';
      
      // Enable/disable sidebar button based on configuration
      toggleSidebarBtn.disabled = !isConfigured;
      
    } else {
      apiStatus.textContent = '未設定';
      apiStatus.className = 'status-value error';
      toggleSidebarBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error checking API status:', error);
    apiStatus.textContent = '確認エラー';
    apiStatus.className = 'status-value error';
    toggleSidebarBtn.disabled = true;
  }
}

// Get current page information
async function getCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      const url = new URL(tab.url);
      const domain = url.hostname;
      const title = tab.title || 'タイトルなし';
      
      // Truncate title if too long
      const displayTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
      
      currentPage.innerHTML = `
        <div style="font-weight: 500;">${escapeHtml(displayTitle)}</div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${escapeHtml(domain)}</div>
      `;
      currentPage.className = 'status-value';
      
      // Check if current page is supported
      if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
        currentPage.innerHTML += '<div style="color: #ef4444; font-size: 11px; margin-top: 4px;">このページはサポートされていません</div>';
        toggleSidebarBtn.disabled = true;
        toggleSidebarBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span>利用不可</span>
        `;
      }
      
    } else {
      currentPage.textContent = 'ページ情報を取得できません';
      currentPage.className = 'status-value error';
    }
  } catch (error) {
    console.error('Error getting current page info:', error);
    currentPage.textContent = '取得エラー';
    currentPage.className = 'status-value error';
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for storage changes to update status
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.apiProvider || changes.apiKeys)) {
    checkApiStatus();
  }
});

// Add loading state to buttons
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    const originalContent = button.innerHTML;
    button.innerHTML = `
      <div class="loading">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    button.dataset.originalContent = originalContent;
  } else {
    button.disabled = false;
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt + A to toggle sidebar
  if (e.altKey && e.key === 'a') {
    e.preventDefault();
    if (!toggleSidebarBtn.disabled) {
      toggleSidebarBtn.click();
    }
  }
  
  // Alt + S for settings
  if (e.altKey && e.key === 's') {
    e.preventDefault();
    settingsBtn.click();
  }
  
  // Escape to close popup
  if (e.key === 'Escape') {
    window.close();
  }
});

// Add keyboard shortcut hints to buttons
toggleSidebarBtn.title = 'AI Assistを開く (Alt+A)';
settingsBtn.title = '設定を開く (Alt+S)';
