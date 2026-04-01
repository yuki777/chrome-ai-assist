async function copyText(text) {
  // Offscreen documentではuser activationが伝わらないため、execCommand経由が正規の方法
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }

  return copied;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen' || request.action !== 'copyText') {
    return false;
  }

  copyText(request.text || '')
    .then((success) => {
      if (!success) {
        sendResponse({ success: false, error: 'document.execCommand("copy") returned false' });
        return;
      }
      sendResponse({ success: true });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message });
    });

  return true;
});
