// Options Page JavaScript for Chrome AI Assist

// DOM Elements
const apiProviderSelect = document.getElementById('apiProviderSelect');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

// Configuration forms
const openaiConfig = document.getElementById('openaiConfig');
const anthropicConfig = document.getElementById('anthropicConfig');

// OpenAI elements
const openaiApiKey = document.getElementById('openaiApiKey');
const openaiModel = document.getElementById('openaiModel');

// Anthropic elements
const anthropicApiKey = document.getElementById('anthropicApiKey');
const anthropicModel = document.getElementById('anthropicModel');

const customInstructions = document.getElementById('customInstructions');

// MCP credential elements
const backlogDomain = document.getElementById('backlogDomain');
const backlogApiKey = document.getElementById('backlogApiKey');
const docbaseDomain = document.getElementById('docbaseDomain');
const docbaseApiToken = document.getElementById('docbaseApiToken');

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // API Provider change
  apiProviderSelect.addEventListener('change', showConfigForm);

  // Fetch models buttons
  document.querySelectorAll('.fetch-models-btn').forEach(btn => {
    btn.addEventListener('click', () => fetchModels(btn.dataset.provider));
  });

  // Save button
  saveBtn.addEventListener('click', saveSettings);

  // Auto-save on input change (debounced)
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('change', debounce(autoSave, 1000));
  });
}

// Show appropriate configuration form
function showConfigForm() {
  const provider = apiProviderSelect.value;

  // Hide all config forms
  openaiConfig.style.display = 'none';
  anthropicConfig.style.display = 'none';

  // Show selected provider form
  switch (provider) {
    case 'openai':
      openaiConfig.style.display = 'block';
      break;
    case 'anthropic':
      anthropicConfig.style.display = 'block';
      break;
  }
}

// Fetch models from API and populate dropdown
async function fetchModels(provider) {
  const btn = document.querySelector(`.fetch-models-btn[data-provider="${provider}"]`);
  const selectId = provider === 'openai' ? 'openaiModel' : 'anthropicModel';
  const selectEl = document.getElementById(selectId);

  // Collect current API keys from the form
  const apiKeys = {};
  switch (provider) {
    case 'openai':
      apiKeys.openaiApiKey = openaiApiKey.value.trim();
      break;
    case 'anthropic':
      apiKeys.anthropicApiKey = anthropicApiKey.value.trim();
      break;
  }

  // Show loading state
  btn.disabled = true;
  btn.textContent = '取得中...';
  selectEl.innerHTML = '<option value="">取得中...</option>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchModels',
      provider,
      apiKeys
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const models = response.models || [];
    if (models.length === 0) {
      selectEl.innerHTML = '<option value="">モデルが見つかりませんでした</option>';
      return;
    }

    // Populate dropdown
    selectEl.innerHTML = '';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name !== model.id ? `${model.name} (${model.id})` : model.id;
      selectEl.appendChild(option);
    }

    // Restore saved selection if it exists in the new list
    const settings = await chrome.storage.local.get(['selectedModel']);
    if (settings.selectedModel) {
      const exists = models.some(m => m.id === settings.selectedModel);
      if (exists) {
        selectEl.value = settings.selectedModel;
      }
    }
  } catch (error) {
    console.error('fetchModels error:', error);
    selectEl.innerHTML = '<option value="">モデル取得に失敗しました</option>';
    showStatus(`モデル取得エラー: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'モデル取得';
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'apiProvider',
      'apiKeys',
      'selectedModel',
      'customInstructions',
      'mcpCredentials'
    ]);

    // Set API Provider
    if (settings.apiProvider) {
      apiProviderSelect.value = settings.apiProvider;
      showConfigForm();
    }

    // Set API Keys
    if (settings.apiKeys) {
      const keys = settings.apiKeys;

      // OpenAI
      if (keys.openaiApiKey) openaiApiKey.value = keys.openaiApiKey;

      // Anthropic
      if (keys.anthropicApiKey) anthropicApiKey.value = keys.anthropicApiKey;
    }

    // Restore saved model as a provisional option (without calling API)
    if (settings.selectedModel) {
      const provider = settings.apiProvider;
      const selectEl = provider === 'openai' ? openaiModel
        : provider === 'anthropic' ? anthropicModel
        : null;

      if (selectEl) {
        selectEl.innerHTML = '';
        const option = document.createElement('option');
        option.value = settings.selectedModel;
        option.textContent = settings.selectedModel;
        selectEl.appendChild(option);
        selectEl.value = settings.selectedModel;
      }
    }

    // Set Custom Instructions
    if (settings.customInstructions) {
      customInstructions.value = settings.customInstructions;
    }

    // MCP Credentials
    if (settings.mcpCredentials) {
      const mcp = settings.mcpCredentials;
      if (mcp.backlogDomain) backlogDomain.value = mcp.backlogDomain;
      if (mcp.backlogApiKey) backlogApiKey.value = mcp.backlogApiKey;
      if (mcp.docbaseDomain) docbaseDomain.value = mcp.docbaseDomain;
      if (mcp.docbaseApiToken) docbaseApiToken.value = mcp.docbaseApiToken;
    }

  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('設定の読み込みに失敗しました', 'error');
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    setSaveButtonLoading(true);

    const provider = apiProviderSelect.value;
    const apiKeys = {};
    let selectedModel = '';

    // Collect API keys based on provider
    switch (provider) {
      case 'openai':
        apiKeys.openaiApiKey = openaiApiKey.value.trim();
        selectedModel = openaiModel.value;
        break;

      case 'anthropic':
        apiKeys.anthropicApiKey = anthropicApiKey.value.trim();
        selectedModel = anthropicModel.value;
        break;
    }

    // Validate required fields
    if (!validateSettings(provider, apiKeys)) {
      setSaveButtonLoading(false);
      return;
    }

    // Build MCP credentials
    // Strip .docbase.io suffix if user entered it
    const rawDocbaseDomain = docbaseDomain.value.trim().replace(/\.docbase\.io$/i, '');
    const mcpCredentials = {
      backlogDomain: backlogDomain.value.trim(),
      backlogApiKey: backlogApiKey.value.trim(),
      docbaseDomain: rawDocbaseDomain,
      docbaseApiToken: docbaseApiToken.value.trim()
    };

    // Prepare settings object
    const settings = {
      apiProvider: provider,
      apiKeys: apiKeys,
      selectedModel: selectedModel,
      customInstructions: customInstructions.value.trim(),
      mcpCredentials
    };

    // Save to storage
    await chrome.storage.local.set(settings);

    showStatus('設定を保存しました', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('設定の保存に失敗しました', 'error');
  } finally {
    setSaveButtonLoading(false);
  }
}

// Auto-save (without user feedback)
async function autoSave() {
  try {
    await saveSettings();
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

// Validate settings
function validateSettings(provider, apiKeys) {
  switch (provider) {
    case 'openai':
      if (!apiKeys.openaiApiKey) {
        showStatus('OpenAI APIキーを入力してください', 'error');
        return false;
      }
      break;

    case 'anthropic':
      if (!apiKeys.anthropicApiKey) {
        showStatus('Anthropic APIキーを入力してください', 'error');
        return false;
      }
      break;
  }
  return true;
}

// Show status message
function showStatus(message, type) {
  saveStatus.textContent = message;
  saveStatus.className = `save-status ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      saveStatus.textContent = '';
      saveStatus.className = 'save-status';
    }, 3000);
  }
}

// Set save button loading state
function setSaveButtonLoading(loading) {
  if (loading) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <div class="loading">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        保存中...
      </div>
    `;
  } else {
    saveBtn.disabled = false;
    saveBtn.textContent = '設定を保存';
  }
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveSettings();
  }
});

// Test API connection (placeholder function)
async function testConnection(provider, apiKeys) {
  // This would implement actual API testing
  // For now, just return true
  return true;
}

// Import/Export settings (future feature)
function exportSettings() {
  // Implementation for exporting settings
}

function importSettings(file) {
  // Implementation for importing settings
}

// Initialize
showConfigForm();
