// Options Page JavaScript for Chrome AI Assist

// DOM Elements
const apiProviderSelect = document.getElementById('apiProviderSelect');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

// Configuration forms
const bedrockConfig = document.getElementById('bedrockConfig');
const openaiConfig = document.getElementById('openaiConfig');
const anthropicConfig = document.getElementById('anthropicConfig');

// AWS Bedrock elements
const awsAccessKey = document.getElementById('awsAccessKey');
const awsSecretKey = document.getElementById('awsSecretKey');
const awsSessionToken = document.getElementById('awsSessionToken');
const awsRegion = document.getElementById('awsRegion');
const useCustomVpcEndpoint = document.getElementById('useCustomVpcEndpoint');
const vpcEndpointGroup = document.getElementById('vpcEndpointGroup');
const vpcEndpointUrl = document.getElementById('vpcEndpointUrl');
const useCrossRegion = document.getElementById('useCrossRegion');
const usePromptCaching = document.getElementById('usePromptCaching');
const bedrockModel = document.getElementById('bedrockModel');
const enableExtendedThinking = document.getElementById('enableExtendedThinking');
const budgetSlider = document.getElementById('budgetSlider');
const budgetValue = document.getElementById('budgetValue');

// OpenAI elements
const openaiApiKey = document.getElementById('openaiApiKey');
const openaiModel = document.getElementById('openaiModel');

// Anthropic elements
const anthropicApiKey = document.getElementById('anthropicApiKey');
const useCustomBaseUrl = document.getElementById('useCustomBaseUrl');
const customBaseUrlGroup = document.getElementById('customBaseUrlGroup');
const customBaseUrl = document.getElementById('customBaseUrl');
const anthropicModel = document.getElementById('anthropicModel');
const anthropicExtendedThinking = document.getElementById('anthropicExtendedThinking');
const anthropicBudgetSlider = document.getElementById('anthropicBudgetSlider');
const anthropicBudgetValue = document.getElementById('anthropicBudgetValue');

const customInstructions = document.getElementById('customInstructions');

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // API Provider change
  apiProviderSelect.addEventListener('change', showConfigForm);

  // VPC Endpoint toggle
  useCustomVpcEndpoint.addEventListener('change', toggleVpcEndpoint);

  // Custom Base URL toggle
  useCustomBaseUrl.addEventListener('change', toggleCustomBaseUrl);

  // Budget sliders
  budgetSlider.addEventListener('input', updateBudgetValue);
  anthropicBudgetSlider.addEventListener('input', updateAnthropicBudgetValue);

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
  bedrockConfig.style.display = 'none';
  openaiConfig.style.display = 'none';
  anthropicConfig.style.display = 'none';

  // Show selected provider form
  switch (provider) {
    case 'bedrock':
      bedrockConfig.style.display = 'block';
      break;
    case 'openai':
      openaiConfig.style.display = 'block';
      break;
    case 'anthropic':
      anthropicConfig.style.display = 'block';
      break;
  }
}

// Toggle VPC endpoint input
function toggleVpcEndpoint() {
  vpcEndpointGroup.style.display = useCustomVpcEndpoint.checked ? 'block' : 'none';
}

// Toggle custom base URL input
function toggleCustomBaseUrl() {
  customBaseUrlGroup.style.display = useCustomBaseUrl.checked ? 'block' : 'none';
}

// Update budget value display
function updateBudgetValue() {
  budgetValue.textContent = budgetSlider.value.toLocaleString();
}

// Update Anthropic budget value display
function updateAnthropicBudgetValue() {
  anthropicBudgetValue.textContent = anthropicBudgetSlider.value.toLocaleString();
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'apiProvider',
      'apiKeys',
      'selectedModel',
      'customInstructions',
      'budgetTokens',
      'enableExtendedThinking',
      'usePromptCaching',
      'useCrossRegion',
      'useCustomVpcEndpoint',
      'vpcEndpointUrl',
      'useCustomBaseUrl',
      'customBaseUrl'
    ]);

    // Set API Provider
    if (settings.apiProvider) {
      apiProviderSelect.value = settings.apiProvider;
      showConfigForm();
    }

    // Set API Keys
    if (settings.apiKeys) {
      const keys = settings.apiKeys;
      
      // AWS Bedrock
      if (keys.awsAccessKey) awsAccessKey.value = keys.awsAccessKey;
      if (keys.awsSecretKey) awsSecretKey.value = keys.awsSecretKey;
      if (keys.awsSessionToken) awsSessionToken.value = keys.awsSessionToken;
      if (keys.awsRegion) awsRegion.value = keys.awsRegion;

      // OpenAI
      if (keys.openaiApiKey) openaiApiKey.value = keys.openaiApiKey;

      // Anthropic
      if (keys.anthropicApiKey) anthropicApiKey.value = keys.anthropicApiKey;
    }

    // Set Selected Model
    if (settings.selectedModel) {
      const provider = settings.apiProvider;
      if (provider === 'bedrock') {
        bedrockModel.value = settings.selectedModel;
      } else if (provider === 'openai') {
        openaiModel.value = settings.selectedModel;
      } else if (provider === 'anthropic') {
        anthropicModel.value = settings.selectedModel;
      }
    }

    // Set Custom Instructions
    if (settings.customInstructions) {
      customInstructions.value = settings.customInstructions;
    }

    // Set other options

    if (settings.budgetTokens) {
      budgetSlider.value = settings.budgetTokens;
      updateBudgetValue();
      anthropicBudgetSlider.value = settings.budgetTokens;
      updateAnthropicBudgetValue();
    }

    if (settings.enableExtendedThinking !== undefined) {
      enableExtendedThinking.checked = settings.enableExtendedThinking;
      anthropicExtendedThinking.checked = settings.enableExtendedThinking;
    }

    if (settings.usePromptCaching !== undefined) {
      usePromptCaching.checked = settings.usePromptCaching;
    }

    if (settings.useCrossRegion !== undefined) {
      useCrossRegion.checked = settings.useCrossRegion;
    }

    if (settings.useCustomVpcEndpoint !== undefined) {
      useCustomVpcEndpoint.checked = settings.useCustomVpcEndpoint;
      toggleVpcEndpoint();
    }

    if (settings.vpcEndpointUrl) {
      vpcEndpointUrl.value = settings.vpcEndpointUrl;
    }

    if (settings.useCustomBaseUrl !== undefined) {
      useCustomBaseUrl.checked = settings.useCustomBaseUrl;
      toggleCustomBaseUrl();
    }

    if (settings.customBaseUrl) {
      customBaseUrl.value = settings.customBaseUrl;
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
      case 'bedrock':
        apiKeys.awsAccessKey = awsAccessKey.value.trim();
        apiKeys.awsSecretKey = awsSecretKey.value.trim();
        apiKeys.awsSessionToken = awsSessionToken.value.trim();
        apiKeys.awsRegion = awsRegion.value;
        selectedModel = bedrockModel.value;
        break;
        
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

    // Prepare settings object
    const settings = {
      apiProvider: provider,
      apiKeys: apiKeys,
      selectedModel: selectedModel,
      customInstructions: customInstructions.value.trim(),
      budgetTokens: parseInt(provider === 'anthropic' ? anthropicBudgetSlider.value : budgetSlider.value),
      enableExtendedThinking: provider === 'anthropic' ? anthropicExtendedThinking.checked : enableExtendedThinking.checked,
      usePromptCaching: usePromptCaching.checked,
      useCrossRegion: useCrossRegion.checked,
      useCustomVpcEndpoint: useCustomVpcEndpoint.checked,
      vpcEndpointUrl: vpcEndpointUrl.value.trim(),
      useCustomBaseUrl: useCustomBaseUrl.checked,
      customBaseUrl: customBaseUrl.value.trim()
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
    case 'bedrock':
      if (!apiKeys.awsRegion) {
        showStatus('AWSリージョンを選択してください', 'error');
        return false;
      }
      break;
      
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
