// Background script for vision automation

console.log('🦊 Foxy AI Vision background script loaded');

// Handle screenshot capture requests
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureScreenshot') {
    // Capture visible tab screenshot
    browser.tabs.captureVisibleTab(null, { format: 'png' }).then(dataUrl => {
      sendResponse({ screenshot: dataUrl });
    }).catch(error => {
      console.error('Screenshot capture failed:', error);
      sendResponse({ screenshot: null, error: error.message });
    });
    return true; // Async response
  }
});
