// Foxy AI - Visual Browser Automation Assistant
// 
// UI Improvements:
// - Chat messages flow downward (top to bottom) with auto-scroll
// - Complete AI responses displayed with reasoning and screenshots
// - All screenshots shown inline (before/after action states)
// - Better visual hierarchy with labeled sections
// - Improved message formatting for end-user readability
// - Voice commands with "Hey Foxy" wake word detection
//
import VoiceCommandsManager from './voice-commands.js';

const BACKEND_URL = 'http://localhost:8000';

let promptInput;
let executeBtn;
let chatContainer;
let voiceBtn;
let voiceStatus;

let isExecuting = false;
let currentMessageId = null;
let shouldStopAutomation = false;

// Voice commands
let voiceManager = null;
let voiceEnabled = false;

// Chat persistence
let currentSiteKey = null;
let commandHistory = [];
let historyIndex = -1;

document.addEventListener('DOMContentLoaded', async () => {
  promptInput = document.getElementById('promptInput');
  executeBtn = document.getElementById('executeBtn');
  chatContainer = document.getElementById('chatContainer');
  voiceBtn = document.getElementById('voiceBtn');
  voiceStatus = document.getElementById('voiceStatus');
  
  // Add stop button for voice/automation
  addStopButton();

  if (!promptInput || !executeBtn || !chatContainer) {
    console.error('Foxy AI UI failed to initialize (missing elements)');
    return;
  }

  // Initialize voice commands
  initializeVoiceCommands();
  
  // Add test typing button handler
  const testTypeBtn = document.getElementById('testTypeBtn');
  if (testTypeBtn) {
    testTypeBtn.addEventListener('click', testTyping);
  }

  // Get current site key (hostname or "all" for new tab)
  await initializeChatForCurrentSite();

  // Load chat history for current site
  await loadChatHistory();

  executeBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || isExecuting) return;

    // Save to command history
    commandHistory.push(prompt);
    historyIndex = commandHistory.length;
    await saveCommandHistory();

    // Request active tab permission if needed
    try {
      const granted = await chrome.permissions.request({
        permissions: ['activeTab', 'tabs']
      });
      if (!granted) {
        addAssistantMessage('❌ Permission denied - please allow access to tabs', 'error');
        return;
      }
    } catch (e) {
      console.log('Permission already granted or not needed');
    }

    isExecuting = true;
    shouldStopAutomation = false;
    executeBtn.disabled = true;
    
    // Show stop button
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) stopBtn.style.display = 'inline-block';
    
    // Add user message
    addUserMessage(prompt);
    promptInput.value = '';

    try {
      await runAutomation(prompt);
    } catch (error) {
      addAssistantMessage(`❌ Error: ${error?.message || String(error)}`, 'error');
    } finally {
      isExecuting = false;
      executeBtn.disabled = false;
      shouldStopAutomation = false;
      
      // Hide stop button
      const stopBtn = document.getElementById('stopBtn');
      if (stopBtn) stopBtn.style.display = 'none';
      
      // Return to listening if voice is active
      if (voiceEnabled) {
        updateVoiceStatus('Say "Hey Foxy" for next command', 'active');
      }
    }
  });

  promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeBtn.click();
    }
  });

  // Arrow up/down for command history (like terminal)
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        promptInput.value = commandHistory[historyIndex] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        promptInput.value = commandHistory[historyIndex] || '';
      } else {
        historyIndex = commandHistory.length;
        promptInput.value = '';
      }
    }
  });

  // Add clear chat button
  addClearChatButton();
});

// Initialize voice commands system
async function initializeVoiceCommands() {
  if (!voiceBtn || !voiceStatus) {
    console.warn('Voice UI elements not found');
    return;
  }

  voiceBtn.addEventListener('click', async () => {
    if (!voiceEnabled) {
      await enableVoiceCommands();
    } else {
      disableVoiceCommands();
    }
  });
}

// Enable voice commands
async function enableVoiceCommands() {
  try {
    // NOTE: Mic permission prompts do not reliably appear from a Side Panel.
    // We capture audio from the ACTIVE TAB via an injected content script instead.
    updateVoiceStatus('Preparing microphone access in active tab...', 'info');

    // Get Picovoice access key from storage or prompt user
    const result = await chrome.storage.local.get(['picovoiceAccessKey']);
    let accessKey = result.picovoiceAccessKey;

    if (!accessKey) {
      accessKey = prompt('Enter your Picovoice Access Key (get one free at https://console.picovoice.ai/):');
      if (!accessKey) {
        updateVoiceStatus('❌ Access key required', 'error');
        return;
      }
      await chrome.storage.local.set({ picovoiceAccessKey: accessKey });
    }

    // Initialize voice manager (tab capture mode)
    updateVoiceStatus('Initializing voice system...', 'info');
    if (!voiceManager) {
      voiceManager = new VoiceCommandsManager();
      await voiceManager.initialize(
        accessKey,
        handleVoiceCommand,
        updateVoiceStatus,
        { mode: 'tab' }
      );
    }

    // Enable wake word detection (runs in the active tab)
    updateVoiceStatus('Starting wake word detection in active tab...', 'info');
    await voiceManager.enableWakeWord();
    voiceEnabled = true;
    voiceBtn.classList.add('active');
    voiceBtn.textContent = '🎤 Voice Active';
    updateVoiceStatus('Say "Hey Foxy" to start', 'active');

  } catch (error) {
    console.error('Failed to enable voice commands:', error);
    
    // Better error message handling
    let errorMsg = 'Unknown error';
    if (error.message) {
      errorMsg = error.message;
    } else if (error.name) {
      errorMsg = error.name;
    } else {
      errorMsg = String(error);
    }
    
    if (error.name === 'NotAllowedError') {
      updateVoiceStatus('❌ Microphone permission denied', 'error');
    } else if (error.name === 'NotFoundError') {
      updateVoiceStatus('❌ Wake word file not found - check extension files', 'error');
    } else if (error.name === 'NotSupportedError') {
      updateVoiceStatus('❌ Audio not supported in this browser', 'error');
    } else {
      updateVoiceStatus(`❌ ${errorMsg}`, 'error');
    }
    
    // Log full error details for debugging
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// Disable voice commands
function disableVoiceCommands() {
  if (voiceManager) {
    voiceManager.disableWakeWord();
  }
  voiceEnabled = false;
  voiceBtn.classList.remove('active');
  voiceBtn.textContent = '🎤 Enable Voice';
  updateVoiceStatus('Voice commands disabled', 'inactive');
}

// Handle voice command
async function handleVoiceCommand(transcript, confidence) {
  console.log(`Voice command received: "${transcript}" (${(confidence * 100).toFixed(0)}% confidence)`);
  
  const lowerTranscript = transcript.toLowerCase();
  
  // Handle stop/cancel commands
  if (lowerTranscript.includes('stop') || lowerTranscript.includes('cancel') || lowerTranscript.includes('abort')) {
    stopAutomation();
    updateVoiceStatus('Stopped. Say "Hey Foxy" to continue', 'active');
    return;
  }
  
  // Set the command in the input
  promptInput.value = transcript;
  
  // Execute the automation
  executeBtn.click();
  
  // Speak acknowledgment (optional)
  // await voiceManager.speak('Got it');
}

// Update voice status display
function updateVoiceStatus(message, type = 'info') {
  if (!voiceStatus) return;
  
  voiceStatus.textContent = message;
  voiceStatus.className = `voice-status ${type}`;
}

// Add stop button
function addStopButton() {
  const voiceContainer = document.querySelector('.voice-section');
  if (!voiceContainer) return;
  
  const stopBtn = document.createElement('button');
  stopBtn.id = 'stopBtn';
  stopBtn.className = 'stop-btn';
  stopBtn.textContent = '⏹️ Stop';
  stopBtn.title = 'Stop current automation (Ctrl+C)';
  stopBtn.style.display = 'none'; // Hidden by default
  
  stopBtn.addEventListener('click', () => {
    stopAutomation();
  });
  
  // Add after voice button
  if (voiceBtn && voiceBtn.parentNode) {
    voiceBtn.parentNode.insertBefore(stopBtn, voiceBtn.nextSibling);
  }
  
  // Keyboard shortcut Ctrl+C
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && isExecuting) {
      e.preventDefault();
      stopAutomation();
    }
  });
}

// Test typing functionality
async function testTyping() {
  console.log('🧪 Testing typing functionality...');
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert('❌ No active tab found');
      return;
    }
    
    console.log('📍 Active tab:', tab.url);
    
    // Check if tab is restricted
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('about:') ||
        tab.url.startsWith('chrome-extension://')) {
      alert('❌ Cannot type on restricted pages (chrome://, edge://, about:)\n\nPlease open a regular webpage (like google.com or docs.google.com) and try again.');
      return;
    }
    
    // Inject vision-content.js
    console.log('💉 Injecting content script...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['vision-content.js']
      });
      console.log('✅ Content script injected');
      await sleep(500); // Wait a bit longer for script to initialize
    } catch (e) {
      console.log('⚠️ Injection error (script may already be loaded):', e.message);
    }
    
    // Send test type command
    const testText = 'Hello from Foxy AI! Testing typing at ' + new Date().toLocaleTimeString();
    console.log('📝 Sending test type command:', testText);
    
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'executeStep',
      step: {
        type: 'type',
        text: testText
      }
    });
    
    console.log('✅ Test result:', result);
    
    if (result.success) {
      alert('✅ Typing test successful!\n\nCheck the active tab - text should be typed into the focused element.\n\nFor Google Docs: Make sure you clicked inside the document first.');
    } else {
      alert('❌ Typing test failed: ' + (result.error || 'Unknown error') + '\n\nCheck browser console for details.');
    }
    
  } catch (error) {
    console.error('❌ Test typing failed:', error);
    
    let errorMsg = '❌ Test failed: ' + error.message;
    
    if (error.message.includes('Could not establish connection')) {
      errorMsg += '\n\n💡 Tips:\n• Make sure you\'re on a regular webpage (not chrome:// or about:)\n• Try reloading the page first\n• The page may be blocking the extension';
    }
    
    alert(errorMsg);
  }
}

// Stop automation
function stopAutomation() {
  if (!isExecuting) return;
  
  shouldStopAutomation = true;
  isExecuting = false;
  executeBtn.disabled = false;
  
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  
  addAssistantMessage('⏹️ Automation stopped by user', 'error');
  
  // Hide automation aura on page
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
    }
  });
  
  // Return to listening if voice is active
  if (voiceEnabled) {
    updateVoiceStatus('Say "Hey Foxy" to continue', 'active');
  }
}

async function initializeChatForCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      // Show all sites for new tabs, extension pages, browser pages
      if (url.protocol === 'chrome:' || 
          url.protocol === 'about:' || 
          url.protocol === 'edge:' ||
          url.protocol === 'chrome-extension:' ||
          url.protocol === 'moz-extension:' ||
          !url.hostname || 
          url.hostname === '' ||
          url.href === 'about:blank' ||
          url.href.startsWith('chrome://newtab') ||
          url.href.startsWith('edge://newtab')) {
        currentSiteKey = 'all'; // New tab shows all sites
      } else {
        currentSiteKey = url.hostname;
      }
    } else {
      currentSiteKey = 'all';
    }
  } catch (e) {
    currentSiteKey = 'all';
  }
}

async function loadChatHistory() {
  const result = await chrome.storage.local.get(['chatHistory', 'commandHistory']);
  const chatHistory = result.chatHistory || {};
  commandHistory = result.commandHistory || [];
  historyIndex = commandHistory.length;

  if (currentSiteKey === 'all') {
    // Show list of all sites with their chats
    showSiteList(chatHistory);
    // Disable input on new tab (no site to automate)
    disableInput('Open a site to start automation');
  } else {
    // Show messages for specific site
    const messages = chatHistory[currentSiteKey] || [];
    
    // Enable input for site-specific chats
    enableInput();
    
    if (messages.length === 0) {
      addEmptyState();
      return;
    }
    
    // Add back button to return to all sites view
    addBackButton();
    
    // Restore messages
    messages.forEach(msg => {
      if (msg.type === 'user') {
        addUserMessage(msg.text, false);
      } else {
        addAssistantMessage(msg.text, msg.messageType || 'normal', false, false);
      }
    });
  }

  // Update site indicator in header
  updateSiteIndicator();
}

function showSiteList(chatHistory) {
  // Get all sites with messages, sorted by most recent
  const sites = Object.keys(chatHistory).map(siteKey => {
    const messages = chatHistory[siteKey];
    const lastMessage = messages[messages.length - 1];
    return {
      site: siteKey,
      messageCount: messages.length,
      lastTimestamp: lastMessage?.timestamp || 0,
      lastMessageText: lastMessage?.text || '',
      lastMessageType: lastMessage?.type || 'user'
    };
  }).sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  if (sites.length === 0) {
    addEmptyState();
    return;
  }

  // Create site list UI
  const listContainer = document.createElement('div');
  listContainer.className = 'site-list';
  listContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  `;

  sites.forEach(siteData => {
    const siteCard = document.createElement('div');
    siteCard.className = 'site-card';
    siteCard.style.cssText = `
      background: var(--user-msg-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    siteCard.onmouseover = () => {
      siteCard.style.background = 'var(--input-bg)';
      siteCard.style.borderColor = 'var(--accent-color)';
    };

    siteCard.onmouseout = () => {
      siteCard.style.background = 'var(--user-msg-bg)';
      siteCard.style.borderColor = 'var(--border-color)';
    };

    siteCard.onclick = () => {
      currentSiteKey = siteData.site;
      chatContainer.innerHTML = '';
      loadChatHistory();
    };

    const timeAgo = getTimeAgo(siteData.lastTimestamp);
    const preview = siteData.lastMessageText.substring(0, 60) + (siteData.lastMessageText.length > 60 ? '...' : '');

    siteCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">
          🌐 ${siteData.site}
        </div>
        <div style="font-size: 11px; color: var(--text-secondary);">
          ${timeAgo}
        </div>
      </div>
      <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
        ${siteData.lastMessageType === 'user' ? '👤' : '🤖'} ${escapeHtml(preview)}
      </div>
      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">
        ${siteData.messageCount} message${siteData.messageCount !== 1 ? 's' : ''}
      </div>
    `;

    listContainer.appendChild(siteCard);
  });

  chatContainer.appendChild(listContainer);
}

function addBackButton() {
  const backBtn = document.createElement('div');
  backBtn.className = 'back-button';
  backBtn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    margin: -8px -8px 12px -8px;
    background: var(--input-bg);
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    font-size: 14px;
    color: var(--text-secondary);
    transition: all 0.2s;
  `;

  backBtn.innerHTML = '← Back to all sites';

  backBtn.onmouseover = () => {
    backBtn.style.color = 'var(--accent-color)';
  };

  backBtn.onmouseout = () => {
    backBtn.style.color = 'var(--text-secondary)';
  };

  backBtn.onclick = () => {
    currentSiteKey = 'all';
    chatContainer.innerHTML = '';
    loadChatHistory();
  };

  chatContainer.appendChild(backBtn);
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'just now';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function updateSiteIndicator() {
  const header = document.querySelector('.header');
  if (!header) return;

  // Remove existing indicator
  const existing = header.querySelector('.site-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.className = 'site-indicator';
  indicator.style.cssText = `
    font-size: 12px;
    color: var(--text-secondary);
    padding: 4px 8px;
    background: var(--input-bg);
    border-radius: 4px;
    margin-left: 8px;
  `;
  
  if (currentSiteKey === 'all') {
    indicator.textContent = '📋 All Sites';
    indicator.title = 'Viewing chat history from all sites';
  } else {
    indicator.textContent = `🌐 ${currentSiteKey}`;
    indicator.title = `Chat history for ${currentSiteKey}`;
  }
  
  const title = header.querySelector('.title');
  if (title) {
    title.after(indicator);
  }
}

async function saveChatMessage(type, text, messageType = 'normal') {
  const result = await chrome.storage.local.get('chatHistory');
  const chatHistory = result.chatHistory || {};
  
  if (!chatHistory[currentSiteKey]) {
    chatHistory[currentSiteKey] = [];
  }
  
  chatHistory[currentSiteKey].push({
    type,
    text,
    messageType,
    timestamp: Date.now()
  });
  
  await chrome.storage.local.set({ chatHistory });
}

async function saveCommandHistory() {
  await chrome.storage.local.set({ commandHistory });
}

async function clearChatHistory() {
  const result = await chrome.storage.local.get('chatHistory');
  const chatHistory = result.chatHistory || {};
  
  if (currentSiteKey === 'all') {
    // Clear all chats
    await chrome.storage.local.set({ chatHistory: {} });
  } else {
    // Clear current site's chat
    delete chatHistory[currentSiteKey];
    await chrome.storage.local.set({ chatHistory });
  }
  
  // Clear UI
  chatContainer.innerHTML = '';
  addEmptyState();
}

function addClearChatButton() {
  const header = document.querySelector('.header');
  if (!header) return;

  const clearBtn = document.createElement('button');
  clearBtn.className = 'clear-chat-btn';
  clearBtn.innerHTML = '🗑️';
  clearBtn.title = 'Clear chat history';
  clearBtn.style.cssText = `
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
  `;
  
  clearBtn.onmouseover = () => {
    clearBtn.style.background = 'var(--input-bg)';
    clearBtn.style.color = 'var(--accent-color)';
  };
  
  clearBtn.onmouseout = () => {
    clearBtn.style.background = 'transparent';
    clearBtn.style.color = 'var(--text-secondary)';
  };
  
  clearBtn.onclick = async () => {
    if (confirm('Clear chat history for this site?')) {
      await clearChatHistory();
    }
  };
  
  header.appendChild(clearBtn);
}

function addEmptyState() {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'empty-state';
  emptyDiv.innerHTML = `
    <div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🦊</div>
      <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Foxy AI</div>
      <div style="font-size: 14px;">Start by typing a command below</div>
      ${currentSiteKey === 'all' ? '<div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">Viewing all sites</div>' : ''}
    </div>
  `;
  chatContainer.appendChild(emptyDiv);
}

function disableInput(message) {
  if (promptInput && executeBtn) {
    promptInput.disabled = true;
    promptInput.placeholder = message || 'Open a specific site to automate';
    executeBtn.disabled = true;
    promptInput.style.opacity = '0.5';
    executeBtn.style.opacity = '0.5';
  }
}

function enableInput() {
  if (promptInput && executeBtn) {
    promptInput.disabled = false;
    promptInput.placeholder = 'Type your command... (e.g., "search for cats")';
    executeBtn.disabled = false;
    promptInput.style.opacity = '1';
    executeBtn.style.opacity = '1';
  }
}

function addUserMessage(text, save = true) {
  // Clear empty state if present
  const emptyState = chatContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.textContent = text;
  
  chatContainer.appendChild(messageDiv);
  scrollToBottom();

  // Save to storage
  if (save) {
    saveChatMessage('user', text);
  }
}

function addAssistantMessage(text, type = 'normal', isReasoning = false, save = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  if (!isReasoning) {
    currentMessageId = messageDiv.id;
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (type === 'error') {
    contentDiv.innerHTML = `<span class="status-badge error">Error</span> ${escapeHtml(text)}`;
  } else if (type === 'success') {
    contentDiv.innerHTML = `<span class="status-badge success">Done</span> ${escapeHtml(text)}`;
  } else if (isReasoning) {
    contentDiv.innerHTML = `<div class="reasoning-label">🧠 AI Thinking</div><div class="reasoning-text">${escapeHtml(text)}</div>`;
  } else {
    contentDiv.textContent = text;
  }
  
  messageDiv.appendChild(contentDiv);
  chatContainer.appendChild(messageDiv);
  scrollToBottom();
  
  // Save to storage
  if (save && !isReasoning) {
    saveChatMessage('assistant', text, type);
  }
  
  return messageDiv.id;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addThinkingIndicator(screenshot = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = 'thinking-msg';
  
  messageDiv.innerHTML = `
    <div class="thinking-indicator">
      <div class="thinking-dots">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
      <span>Thinking...</span>
    </div>
  `;
  
  // Add screenshot if provided
  if (screenshot) {
    const img = document.createElement('img');
    img.src = screenshot;
    img.className = 'screenshot-preview';
    img.alt = 'Analyzing this page';
    img.title = 'Click to view full size - Currently analyzing';
    img.onclick = () => window.open(screenshot, '_blank');
    messageDiv.appendChild(img);
  }
  
  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

function removeThinkingIndicator() {
  const thinking = document.getElementById('thinking-msg');
  if (thinking) thinking.remove();
}

function addActionStep(title, status = 'active', screenshot = null) {
  let messageDiv = document.getElementById(currentMessageId);
  
  if (!messageDiv) {
    currentMessageId = addAssistantMessage('Executing automation...');
    messageDiv = document.getElementById(currentMessageId);
  }
  
  const stepId = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const stepDiv = document.createElement('div');
  stepDiv.className = `action-step ${status}`;
  stepDiv.id = stepId;
  
  const statusIcon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
  
  stepDiv.innerHTML = `
    <div class="action-step-title">
      <span>${statusIcon}</span>
      <span>${escapeHtml(title)}</span>
    </div>
  `;
  
  if (screenshot) {
    const img = document.createElement('img');
    img.src = screenshot;
    img.className = 'screenshot-preview';
    img.alt = 'Step screenshot';
    img.title = 'Click to view full size';
    img.onclick = () => window.open(screenshot, '_blank');
    stepDiv.appendChild(img);
  }
  
  messageDiv.appendChild(stepDiv);
  scrollToBottom();
  
  return stepId;
}

function updateActionStep(stepId, title, status, screenshot = null) {
  const stepDiv = document.getElementById(stepId);
  if (!stepDiv) return;
  
  stepDiv.className = `action-step ${status}`;
  
  const statusIcon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
  const titleDiv = stepDiv.querySelector('.action-step-title');
  if (titleDiv) {
    titleDiv.innerHTML = `
      <span>${statusIcon}</span>
      <span>${escapeHtml(title)}</span>
    `;
  }
  
  if (screenshot) {
    // Remove old screenshot if exists
    const oldImg = stepDiv.querySelector('.screenshot-preview');
    if (oldImg) oldImg.remove();
    
    const img = document.createElement('img');
    img.src = screenshot;
    img.className = 'screenshot-preview';
    img.alt = 'Step screenshot';
    img.title = 'Click to view full size';
    img.onclick = () => window.open(screenshot, '_blank');
    stepDiv.appendChild(img);
  }
  
  scrollToBottom();
}

function scrollToBottom() {
  if (chatContainer) {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  }
}

async function runAutomation(prompt) {
  // Use autonomous agent mode
  await runAutonomousAgent(prompt);
}

async function captureScreenshotWithDelay() {
  // Wait 2 seconds before capturing to let page settle
  await sleep(2000);
  return await chrome.tabs.captureVisibleTab(null, { format: 'png' });
}

async function runAutonomousAgent(goal) {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Ensure vision-content.js is loaded first
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['vision-content.js']
    });
    await sleep(300);
  } catch (e) {
    console.log('Vision content script already loaded or failed:', e.message);
  }
  
  // Show automation aura
  await chrome.tabs.sendMessage(tab.id, { action: 'startAutomation' }).catch((err) => {
    console.log('Could not show aura:', err.message);
  });
  
  const history = [];
  let stepCount = 0;
  const maxSteps = 50; // Reduced from 100 for efficiency
  const actionRetries = {}; // Track retries per action description
  const maxRetriesPerAction = 2; // Max 2 retries per action
  
  while (stepCount < maxSteps) {
    stepCount++;
    
    // Check if user stopped automation
    if (shouldStopAutomation) {
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    // Capture current state first (with 2 second delay for page to settle)
    const screenshot = await captureScreenshotWithDelay();
    
    // Show thinking indicator with screenshot so user can see what's being analyzed
    addThinkingIndicator(screenshot);
    
    // Check again before expensive operations
    if (shouldStopAutomation) {
      removeThinkingIndicator();
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    // Check again after screenshot capture (user may have stopped during delay)
    if (shouldStopAutomation) {
      removeThinkingIndicator();
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    const base64 = screenshot.split(',')[1];
    
    // Get page info
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }).catch(() => ({
      url: tab.url,
      title: tab.title
    }));
    
    // Check before making backend call
    if (shouldStopAutomation) {
      removeThinkingIndicator();
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    // Ask agent what to do next
    const resp = await fetch(`${BACKEND_URL}/agent/next_step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: goal,
        screenshot: base64,
        viewport: {
          url: pageInfo.url,
          title: pageInfo.title,
          width: pageInfo.viewport?.width || 1920,
          height: pageInfo.viewport?.height || 1080
        },
        history: history
      })
    });

    if (!resp.ok) {
      removeThinkingIndicator();
      const text = await resp.text().catch(() => '');
      addAssistantMessage(`Backend error ${resp.status}: ${text || resp.statusText}`, 'error');
      break;
    }

    const decision = await resp.json();
    removeThinkingIndicator();
    
    // Check if stopped during API call
    if (shouldStopAutomation) {
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    // Show AI's reasoning with screenshot as a separate message
    if (decision.reasoning) {
      const reasoningMsg = addAssistantMessage(decision.reasoning, 'normal', true);
      const reasoningDiv = document.getElementById(reasoningMsg);
      if (reasoningDiv && screenshot) {
        const img = document.createElement('img');
        img.src = screenshot;
        img.className = 'screenshot-preview';
        img.alt = 'Current page state';
        img.title = 'Click to view full size - Current page the AI is analyzing';
        img.onclick = () => window.open(screenshot, '_blank');
        reasoningDiv.appendChild(img);
      }
    }
    
    // Check if completed
    if (decision.completed) {
      const successMsg = decision.final_message || 'Task completed successfully!';
      addAssistantMessage(`✅ ${successMsg}`, 'success');
      // Hide automation aura
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
      break;
    }
    
    // Execute next action
    if (!decision.next_action) {
      addAssistantMessage('⚠️ Agent got stuck - no next action available', 'error');
      // Hide automation aura
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
      break;
    }
    
    // Check before executing action
    if (shouldStopAutomation) {
      addAssistantMessage('⏹️ Automation cancelled by user', 'error');
      break;
    }
    
    const action = decision.next_action;
    const stepTitle = getStepTitle(action);
    const actionKey = `${action.type}:${action.description || action.url || ''}`;
    
    // OPTIMIZATION: Track and limit retries per action
    if (!actionRetries[actionKey]) {
      actionRetries[actionKey] = 0;
    }
    
    // Add action step (active state) - show before screenshot
    const stepId = addActionStep(stepTitle, 'active', screenshot);
    
    // Handle prompt_user action type
    if (action.type === 'prompt_user') {
      updateActionStep(stepId, stepTitle, 'active');
      const userInput = prompt(action.prompt || 'Please provide input');
      if (userInput === null) {
        updateActionStep(stepId, '❌ User cancelled input', 'failed');
        addAssistantMessage('Task cancelled by user', 'error');
        break;
      }
      const displayValue = action.input_type === 'password' ? '****' : userInput;
      updateActionStep(stepId, `✅ User provided: ${displayValue}`, 'completed');
      history.push(`${stepTitle} - User provided ${action.input_type}`);
      action.user_provided_value = userInput;
      history.push(`User provided: ${userInput}`);
      continue;
    }
    
    try {
      // Final check before executing action
      if (shouldStopAutomation) {
        updateActionStep(stepId, '⏹️ Cancelled', 'failed');
        addAssistantMessage('⏹️ Automation cancelled by user', 'error');
        break;
      }
      
      // Execute the action
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, {
          action: 'executeStep',
          step: action
        });
      } catch (msgError) {
        // Content script not loaded or permission error
        if (msgError.message.includes('Could not establish connection') || 
            msgError.message.includes('Receiving end does not exist')) {
          console.log('Injecting content script...');
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['vision-content.js']
          });
          await sleep(500);
          result = await chrome.tabs.sendMessage(tab.id, {
            action: 'executeStep',
            step: action
          });
        } else if (msgError.message.includes('Missing host permission')) {
          updateActionStep(stepId, `${stepTitle} - Restricted page, navigating...`, 'failed');
          const targetUrl = action.url || 'https://www.google.com';
          await chrome.tabs.update(tab.id, { url: targetUrl });
          await sleep(2000);
          history.push(`${stepTitle} - Navigated to escape restricted page`);
          continue;
        } else {
          throw msgError;
        }
      }
      
      // Capture screenshot after action (with delay for page to settle)
      const afterScreenshot = await captureScreenshotWithDelay();
      
      if (result.success) {
        updateActionStep(stepId, stepTitle, 'completed', afterScreenshot);
        history.push(`${stepTitle} - Success`);
        actionRetries[actionKey] = 0; // Reset retries on success
      } else {
        updateActionStep(stepId, `${stepTitle} - ${result.error}`, 'failed', afterScreenshot);
        history.push(`${stepTitle} - Failed: ${result.error}`);
        
        // OPTIMIZATION: Skip excessive retries
        actionRetries[actionKey]++;
        if (actionRetries[actionKey] >= maxRetriesPerAction) {
          console.log(`⚠️ Action "${actionKey}" failed ${actionRetries[actionKey]} times. Skipping to next step.`);
          addAssistantMessage(`⏭️ Skipped action (failed ${maxRetriesPerAction} times): ${stepTitle}`, 'error');
          // Continue to next step instead of retrying
          continue;
        }
        
        // If vision click failed, try scrolling once before giving up
        if (action.type === 'vision_click' && result.error.includes('not found') && actionRetries[actionKey] < 2) {
          await sleep(1000);
          const retryId = addActionStep('🔄 Scrolling to find element...', 'active');
          await chrome.tabs.sendMessage(tab.id, {
            action: 'executeStep',
            step: { type: 'scroll', amount: 300 }
          }).catch(() => {});
          updateActionStep(retryId, '🔄 Scrolled, will retry', 'completed');
        }
      }
      
      // Wait between actions
      await sleep(1000);
      
    } catch (error) {
      updateActionStep(stepId, `${stepTitle} - Error: ${error.message}`, 'failed');
      history.push(`${stepTitle} - Error: ${error.message}`);
    }
  }
  
  // Hide automation aura when done
  await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
  
  if (stepCount >= maxSteps) {
    addAssistantMessage('⚠️ Reached step limit (100 steps)', 'error');
  }
}

function getStepTitle(step) {
  switch(step.type) {
    case 'navigate':
      return `📄 Navigating to ${step.url ? new URL(step.url).hostname : 'page'}`;
    case 'vision_click':
      return `🖱️ ${step.description || 'Clicking element'}`;
    case 'type':
      return `⌨️ Typing text`;
    case 'scroll':
      return `📜 Scrolling ${step.direction || 'down'}`;
    case 'wait':
      return `⏳ Waiting for page to load`;
    case 'screenshot':
      return '📸 Taking screenshot';
    case 'prompt_user':
      return step.prompt || '❓ Requesting user input';
    default:
      return step.type;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
