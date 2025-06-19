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

// MCP elements
const mcpJsonInput = document.getElementById('mcpJsonInput');
const validateJsonBtn = document.getElementById('validateJsonBtn');
const formatJsonBtn = document.getElementById('formatJsonBtn');
const jsonValidationResult = document.getElementById('jsonValidationResult');

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

  // MCP JSON buttons
  validateJsonBtn.addEventListener('click', validateMCPJson);
  formatJsonBtn.addEventListener('click', formatMCPJson);

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
      'customBaseUrl',
      'mcpSettings'
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

    // Set Selected Model - with validation for old/unsupported models
    if (settings.selectedModel) {
      const provider = settings.apiProvider;
      if (provider === 'bedrock') {
        // Check if the stored model is valid/supported
        const validBedrockModels = [
          'us.anthropic.claude-opus-4-20250514-v1:0',
          'us.anthropic.claude-sonnet-4-20250514-v1:0'
        ];
        
        if (validBedrockModels.includes(settings.selectedModel)) {
          bedrockModel.value = settings.selectedModel;
        } else {
          // Set to default if invalid/old model
          bedrockModel.value = 'us.anthropic.claude-opus-4-20250514-v1:0';
          console.warn('Invalid Bedrock model detected, reset to default:', settings.selectedModel);
        }
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

    // Set MCP Settings
    if (settings.mcpSettings) {
      // Convert to JSON format if needed
      if (typeof settings.mcpSettings === 'string') {
        mcpJsonInput.value = settings.mcpSettings;
      } else if (settings.mcpSettings.mcpServers) {
        mcpJsonInput.value = JSON.stringify(settings.mcpSettings, null, 2);
      }
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

    // Parse and validate MCP JSON
    let mcpConfig = null;
    const mcpJsonValue = mcpJsonInput.value.trim();
    if (mcpJsonValue) {
      try {
        mcpConfig = JSON.parse(mcpJsonValue);
        // Validate structure
        if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
          showStatus('MCP設定にmcpServersフィールドが必要です', 'error');
          setSaveButtonLoading(false);
          return;
        }
      } catch (error) {
        showStatus('MCP設定のJSONが無効です', 'error');
        setSaveButtonLoading(false);
        return;
      }
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
      customBaseUrl: customBaseUrl.value.trim(),
      mcpSettings: mcpConfig
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

// Validate MCP JSON
function validateMCPJson() {
  const jsonValue = mcpJsonInput.value.trim();
  
  if (!jsonValue) {
    showValidationResult('JSONを入力してください', 'error');
    return;
  }
  
  try {
    const config = JSON.parse(jsonValue);
    
    // Check structure
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      showValidationResult('mcpServersフィールドが必要です', 'error');
      return;
    }
    
    // Check each server
    const serverNames = Object.keys(config.mcpServers);
    if (serverNames.length === 0) {
      showValidationResult('少なくとも1つのサーバー設定が必要です', 'error');
      return;
    }
    
    for (const serverName of serverNames) {
      const server = config.mcpServers[serverName];
      if (!server.command) {
        showValidationResult(`${serverName}: commandフィールドが必要です`, 'error');
        return;
      }
      if (server.args && !Array.isArray(server.args)) {
        showValidationResult(`${serverName}: argsは配列である必要があります`, 'error');
        return;
      }
    }
    
    showValidationResult('有効なMCP設定です', 'success');
  } catch (error) {
    // Improve error message for common JSON syntax errors
    let errorMessage = error.message;
    if (errorMessage.includes('Unexpected end of JSON input')) {
      errorMessage = 'JSONが不完全です。閉じ括弧 } が不足している可能性があります';
    } else if (errorMessage.includes('Expected')) {
      errorMessage = `JSON構文エラー: ${errorMessage}`;
    }
    showValidationResult(`JSONパースエラー: ${errorMessage}`, 'error');
  }
}

// Format MCP JSON
function formatMCPJson() {
  const jsonValue = mcpJsonInput.value.trim();
  
  if (!jsonValue) {
    return;
  }
  
  try {
    const config = JSON.parse(jsonValue);
    mcpJsonInput.value = JSON.stringify(config, null, 2);
    showValidationResult('フォーマット完了', 'success');
  } catch (error) {
    // Improve error message for common JSON syntax errors
    let errorMessage = error.message;
    if (errorMessage.includes('Unexpected end of JSON input')) {
      errorMessage = 'JSONが不完全です。閉じ括弧 } が不足している可能性があります';
    } else if (errorMessage.includes('Expected')) {
      errorMessage = `JSON構文エラー: ${errorMessage}`;
    }
    showValidationResult(`フォーマットエラー: ${errorMessage}`, 'error');
  }
}

// Show validation result
function showValidationResult(message, type) {
  jsonValidationResult.textContent = message;
  jsonValidationResult.className = `validation-result ${type}`;
  
  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      jsonValidationResult.className = 'validation-result';
    }, 3000);
  }
}

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
