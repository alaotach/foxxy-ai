// Background script for vision automation

console.log('🦊 Foxy AI Vision background script loaded');

const BACKEND_URL = 'http://localhost:8000';

// Handle screenshot capture requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureScreenshot') {
    // Wait 2 seconds before capturing screenshot
    setTimeout(() => {
      // Capture visible tab screenshot
      chrome.tabs.captureVisibleTab(null, { format: 'png' }).then(dataUrl => {
        sendResponse({ screenshot: dataUrl });
      }).catch(error => {
        console.error('Screenshot capture failed:', error);
        sendResponse({ screenshot: null, error: error.message });
      });
    }, 2000);
    return true; // Async response
  }
  
  if (message.action === 'visionFindElement') {
    // Proxy vision API calls to avoid CORS in content script
    fetch(`${BACKEND_URL}/vision/find_element`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.data)
    })
    .then(response => response.json())
    .then(data => sendResponse(data))
    .catch(error => {
      console.error('Vision API error:', error);
      sendResponse({ error: error.message, success: false });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'visionAnalyze') {
    // Proxy vision analyze calls
    fetch(`${BACKEND_URL}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.data)
    })
    .then(response => response.json())
    .then(data => sendResponse(data))
    .catch(error => {
      console.error('Vision API error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'downloadFile') {
    // Download file using browser.downloads API
    console.log('📥 Background: Starting download:', message.url);
    
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || 'download',
      saveAs: true  // Show save dialog
    })
    .then(downloadId => {
      console.log('✅ Background: Download started with ID:', downloadId);
      sendResponse({ success: true, downloadId: downloadId });
    })
    .catch(error => {
      console.error('❌ Background: Download error:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep channel open for async response
  }
});
