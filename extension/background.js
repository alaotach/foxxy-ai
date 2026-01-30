// Background Service Worker (Chrome Manifest V3)
// Central hub for: receiving prompts, forwarding to LLM backend, relaying actions
// Maintains WebSocket connection for real-time communication

console.log('🦊 Foxy AI background service worker loaded');

// Side panel handler - opens the side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Configuration
const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

// Track active connections and WebSocket
const connections = new Map();
let websocket = null;
let wsReconnectAttempts = 0;
const MAX_WS_RECONNECT_ATTEMPTS = 5;

// Initialize WebSocket connection to backend
function initWebSocket() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    return; // Already connected
  }
  
  try {
    websocket = new WebSocket(WS_URL);
    
    websocket.onopen = () => {
      console.log('🔌 WebSocket connected to backend');
      wsReconnectAttempts = 0;
    };
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    websocket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      websocket = null;
      
      // Attempt to reconnect
      if (wsReconnectAttempts < MAX_WS_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        console.log(`Reconnecting WebSocket (attempt ${wsReconnectAttempts})...`);
        setTimeout(initWebSocket, 2000 * wsReconnectAttempts);
      }
    };
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket:', error);
  }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
  // Forward to active tab or handle based on message type
  if (data.type === 'action' && data.actions) {
    // Execute actions on active tab
    executeActionsOnActiveTab(data.actions);
  }
}

// Send message via WebSocket
function sendWebSocketMessage(data) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(data));
    return true;
  } else {
    console.error('❌ WebSocket not connected');
    return false;
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Foxy AI installed! 🎉');
    // Initialize WebSocket on install
    initWebSocket();
  }
});

// Initialize WebSocket when service worker starts
initWebSocket();

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.type || message.action);
  
  // Handle old vision system messages (action-based)
  if (message.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(dataUrl => {
        console.log('✅ Screenshot captured');
        sendResponse({ screenshot: dataUrl });
      })
      .catch(error => {
        console.error('❌ Screenshot failed:', error);
        sendResponse({ screenshot: null, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'visionFindElement') {
    fetch(`${BACKEND_URL}/vision/find_element`, {
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
  
  // Handle new tool registry messages (type-based)
  switch (message.type) {
    case 'capture_screenshot':
      handleScreenshot(message.params, sender)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'execute_in_tab':
      handleExecuteInTab(message.tabId, message.code)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'get_active_tab':
      getActiveTab()
        .then(tab => sendResponse({ success: true, tab }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'send_to_llm':
      // Send prompt to LLM backend
      handleLLMRequest(message.prompt, message.context)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'execute_actions':
      // Execute array of actions on active tab
      executeActionsOnActiveTab(message.actions)
        .then(results => sendResponse({ success: true, results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      console.warn('Unknown message type:', message.type || message.action);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Handle keyboard shortcuts (optional - only if commands permission is granted)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-foxy') {
      // Chrome doesn't support sidebar, open popup or side panel instead
      console.log('Toggle command received');
    }
  });
}

/**
 * Send prompt to LLM backend and get semantic actions
 */
async function handleLLMRequest(prompt, context = {}) {
  try {
    // Get current tab info
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    // Capture screenshot for context
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const base64 = screenshot.split(',')[1]; // Remove data:image/png;base64, prefix
    
    // Send to backend
    const response = await fetch(`${BACKEND_URL}/agent/next_step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: prompt,
        screenshot: base64,
        viewport: {
          url: tab.url,
          title: tab.title,
          ...context
        },
        history: context.history || []
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📥 LLM response:', data);
    
    return {
      success: true,
      actions: data.actions || [],
      reasoning: data.reasoning,
      completed: data.completed
    };
    
  } catch (error) {
    console.error('❌ LLM request failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute array of actions on active tab (batch or iterative)
 */
async function executeActionsOnActiveTab(actions) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    throw new Error('No active tab found');
  }
  
  const tab = tabs[0];
  const results = [];
  
  for (const action of actions) {
    try {
      // Send action to content script
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'executeStep',
        step: action
      });
      
      results.push(result);
      
      // If action failed and has no retries left, stop execution
      if (!result.success && action.stopOnError) {
        console.error('⚠️ Action failed, stopping execution:', action);
        break;
      }
      
      // Small delay between actions
      await sleep(200);
      
    } catch (error) {
      console.error('❌ Failed to execute action:', action, error);
      results.push({
        success: false,
        error: error.message,
        action: action.type
      });
      
      if (action.stopOnError) {
        break;
      }
    }
  }
  
  return results;
}

/**
 * Capture screenshot of active tab or specific area
 */
async function handleScreenshot(params = {}, sender) {
  try {
    console.log('📸 Capturing screenshot...');
    
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tab = tabs[0];
    console.log('📸 Capturing tab:', tab.id, tab.url);
    
    // Capture visible area
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });
    
    console.log('✅ Screenshot captured, size:', dataUrl.length);
    
    return {
      success: true,
      screenshot: dataUrl,
      format: 'png',
      timestamp: Date.now(),
      tab: {
        id: tab.id,
        url: tab.url,
        title: tab.title
      }
    };
    
  } catch (error) {
    console.error('❌ Screenshot failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute JavaScript code in a specific tab
 * Using Manifest V3 scripting.executeScript API
 */
async function handleExecuteInTab(tabId, code) {
  if (!tabId || !code) {
    throw new Error('Tab ID and code required');
  }
  
  // Manifest V3: Use scripting.executeScript
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: new Function(code)
  });
  
  if (results && results[0]) {
    return results[0].result;
  }
  
  throw new Error('No result from script execution');
}

/**
 * Get active tab
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    throw new Error('No active tab found');
  }
  
  return {
    id: tabs[0].id,
    url: tabs[0].url,
    title: tabs[0].title,
    windowId: tabs[0].windowId
  };
}

/**
 * Handle long-lived connections (for streaming)
 */
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 New connection:', port.name);
  
  connections.set(port.name, port);
  
  port.onMessage.addListener((message) => {
    console.log(`📨 Message from ${port.name}:`, message);
    // Handle messages from long-lived connections
  });
  
  port.onDisconnect.addListener(() => {
    console.log('🔌 Disconnected:', port.name);
    connections.delete(port.name);
  });
});

// Utility: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('✅ Background service worker initialized');

/**
 * Capture screenshot of active tab or specific area
 */
async function handleScreenshot(params = {}, sender) {
  try {
    console.log('📸 Capturing screenshot...');
    
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tab = tabs[0];
    console.log('📸 Capturing tab:', tab.id, tab.url);
    
    // Capture visible area
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });
    
    console.log('✅ Screenshot captured, size:', dataUrl.length);
    
    return {
      success: true,
      screenshot: dataUrl,
      format: 'png',
      timestamp: Date.now(),
      tab: {
        id: tab.id,
        url: tab.url,
        title: tab.title
      }
    };
    
  } catch (error) {
    console.error('❌ Screenshot failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute JavaScript code in a specific tab
 * Using Manifest V3 scripting.executeScript API
 */
async function handleExecuteInTab(tabId, code) {
  if (!tabId || !code) {
    throw new Error('Tab ID and code required');
  }
  
  // Manifest V3: Use scripting.executeScript
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: new Function(code)
  });
  
  if (results && results[0]) {
    return results[0].result;
  }
  
  throw new Error('No result from script execution');
}

/**
 * Get active tab
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    throw new Error('No active tab found');
  }
  
  return {
    id: tabs[0].id,
    url: tabs[0].url,
    title: tabs[0].title,
    windowId: tabs[0].windowId
  };
}

/**
 * Handle long-lived connections (for streaming)
 */
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 New connection:', port.name);
  
  connections.set(port.name, port);
  
  port.onMessage.addListener((message) => {
    console.log(`📨 Message from ${port.name}:`, message);
    // Handle messages from long-lived connections
  });
  
  port.onDisconnect.addListener(() => {
    console.log('🔌 Disconnected:', port.name);
    connections.delete(port.name);
  });
});

console.log('✅ Background script initialized');
