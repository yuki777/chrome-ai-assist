// Content Script for Chrome AI Assist

let sidebarIframe = null;
let isInitialized = false;

// Initialize the content script
(function initialize() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('🟡 [Content] Content script initialized');

  // Create AI Assist button
  createAIAssistButton();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🟡 [Content] Received message:', request);
    
    if (request.action === 'extractContent') {
      console.log('🟡 [Content] Extracting page content');
      const content = extractPageContent();
      console.log('🟡 [Content] Extracted content:', content);
      sendResponse(content);
    } else if (request.action === 'toggleSidebar') {
      console.log('🟡 [Content] Toggling sidebar');
      toggleSidebar();
      sendResponse({ success: true });
    }
  });
})();

// Create AI Assist floating button
function createAIAssistButton() {
  const button = document.createElement('div');
  button.id = 'ai-assist-button';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
  button.title = 'AI Assist';
  button.addEventListener('click', toggleSidebar);
  document.body.appendChild(button);
}

// Extract page content
function extractPageContent() {
  const title = document.title;
  const url = window.location.href;
  
  // Extract main content (prioritize article, main, or body)
  let content = '';
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    'body'
  ];

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Remove script and style elements
      const clone = element.cloneNode(true);
      const scripts = clone.querySelectorAll('script, style, nav, header, footer, aside');
      scripts.forEach(el => el.remove());
      
      content = clone.innerText.trim();
      if (content.length > 100) {
        break;
      }
    }
  }

  // Fallback to body text if no content found
  if (!content) {
    const bodyClone = document.body.cloneNode(true);
    const scripts = bodyClone.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach(el => el.remove());
    content = bodyClone.innerText.trim();
  }

  // Limit content length to prevent API overload
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '...';
  }

  return {
    title,
    url,
    content,
    timestamp: new Date().toISOString()
  };
}

// Toggle sidebar visibility
function toggleSidebar() {
  console.log('🟡 [Content] Toggling sidebar visibility');
  try {
    // 既存iframeがあれば必ずremove
    if (sidebarIframe && document.body.contains(sidebarIframe)) {
      console.log('🟡 [Content] Sidebar already exists, removing it');
      sidebarIframe.remove();
      sidebarIframe = null;
      document.body.classList.remove('ai-assist-sidebar-open');
      return;
    }
    // 新規生成
    console.log('🟡 [Content] Creating new sidebar');
    createSidebar();
  } catch (e) {
    console.error('🔴 [Content] Error in toggleSidebar:', e);
    // context失効時は握りつぶす
  }
}

// Create sidebar iframe
function createSidebar() {
  try {
    // 既存iframeがあれば必ずremove
    if (sidebarIframe && document.body.contains(sidebarIframe)) {
      sidebarIframe.remove();
      sidebarIframe = null;
      document.body.classList.remove('ai-assist-sidebar-open');
    }
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'ai-assist-sidebar';
    sidebarIframe.src = chrome.runtime.getURL('src/sidebar/sidebar.html');
    sidebarIframe.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      width: 25% !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      border: none !important;
      background: white !important;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1) !important;
      transform: translateX(100%) !important;
      transition: transform 0.3s ease !important;
    `;

    document.body.appendChild(sidebarIframe);
    document.body.classList.add('ai-assist-sidebar-open');

    // Animate sidebar in
    setTimeout(() => {
      // transformプロパティを正しく上書きするため、!importantを外す
      sidebarIframe.style.transform = 'translateX(0)';
    }, 10);

    // Initialize sidebar with page content
    sidebarIframe.onload = () => {
      try {
        const pageContent = extractPageContent();
        sidebarIframe.contentWindow.postMessage({
          type: 'INIT',
          data: pageContent
        }, '*');
      } catch (e) {
        console.error('🔴 [Content] Error posting INIT to sidebar:', e);
      }
    };
  } catch (e) {
    console.error('🔴 [Content] Error in createSidebar:', e);
    // context失効時は握りつぶす
  }
}

// Listen for messages from sidebar
window.addEventListener('message', (event) => {
  if (event.source !== sidebarIframe?.contentWindow) return;

  if (event.data.type === 'CLOSE_SIDEBAR') {
    toggleSidebar();
  } else if (event.data.type === 'SEND_MESSAGE') {
    // Forward message to background script for AI processing
    chrome.runtime.sendMessage({
      action: 'callAI',
      data: event.data.data
    }, (response) => {
      sidebarIframe.contentWindow.postMessage({
        type: 'AI_RESPONSE',
        data: response
      }, '*');
    });
  }
});

// Handle page navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Close sidebar on navigation
    if (sidebarIframe) {
      toggleSidebar();
    }
  }
}).observe(document, { subtree: true, childList: true });
