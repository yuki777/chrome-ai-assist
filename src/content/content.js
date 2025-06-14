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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="90%" height="90%" style="object-fit:contain;pointer-events:none;">
      <g transform="translate(12,12) scale(0.5)">
        <path fill="#2196f3" d="M23.426,31.911l-1.719,3.936c-0.661,1.513-2.754,1.513-3.415,0l-1.719-3.936	c-1.529-3.503-4.282-6.291-7.716-7.815l-4.73-2.1c-1.504-0.668-1.504-2.855,0-3.523l4.583-2.034	c3.522-1.563,6.324-4.455,7.827-8.077l1.741-4.195c0.646-1.557,2.797-1.557,3.443,0l1.741,4.195	c1.503,3.622,4.305,6.514,7.827,8.077l4.583,2.034c1.504,0.668,1.504,2.855,0,3.523l-4.73,2.1	C27.708,25.62,24.955,28.409,23.426,31.911z"/>
        <path fill="#7e57c2" d="M38.423,43.248l-0.493,1.131c-0.361,0.828-1.507,0.828-1.868,0l-0.493-1.131	c-0.879-2.016-2.464-3.621-4.44-4.5l-1.52-0.675c-0.822-0.365-0.822-1.56,0-1.925l1.435-0.638c2.027-0.901,3.64-2.565,4.504-4.65	l0.507-1.222c0.353-0.852,1.531-0.852,1.884,0l0.507,1.222c0.864,2.085,2.477,3.749,4.504,4.65l1.435,0.638	c0.822,0.365,0.822,1.56,0,1.925l-1.52,0.675C40.887,39.627,39.303,41.232,38.423,43.248z"/>
      </g>
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
  if (content.length > 40000) {
    content = content.substring(0, 40000) + '...';
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
