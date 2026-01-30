// Foxy AI - Visual Browser Automation Assistant
const BACKEND_URL = 'http://localhost:8000';

let promptInput;
let executeBtn;
let taskTitle;
let emptyState;
let thinkingStatus;
let stepsList;
let screenshotPreview;
let mainContent;

let currentSteps = [];
let isExecuting = false;
let lastScreenshot = null;

document.addEventListener('DOMContentLoaded', () => {
  promptInput = document.getElementById('promptInput');
  executeBtn = document.getElementById('executeBtn');
  taskTitle = document.getElementById('taskTitle');
  emptyState = document.getElementById('emptyState');
  thinkingStatus = document.getElementById('thinkingStatus');
  stepsList = document.getElementById('stepsList');
  screenshotPreview = document.getElementById('screenshotPreview');
  mainContent = document.getElementById('mainContent');

  if (!promptInput || !executeBtn) {
    if (document.body) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding:12px;color:#ff6b6b;font-size:12px;';
      msg.textContent = 'Foxy AI UI failed to initialize (missing elements).';
      document.body.prepend(msg);
    }
    return;
  }

  executeBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || isExecuting) return;

    // Request active tab permission if needed
    try {
      const granted = await chrome.permissions.request({
        permissions: ['activeTab', 'tabs']
      });
      if (!granted) {
        showError('Permission denied - please allow access to tabs');
        return;
      }
    } catch (e) {
      console.log('Permission already granted or not needed');
    }

    isExecuting = true;
    executeBtn.disabled = true;

    try {
      await runAutomation(prompt);
    } catch (error) {
      showError(error?.message || String(error));
    } finally {
      isExecuting = false;
      executeBtn.disabled = false;
    }
  });

  promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') executeBtn.click();
  });

  // Update send button style based on input
  promptInput.addEventListener('input', () => {
    if (promptInput.value.trim()) {
      executeBtn.classList.add('active');
    } else {
      executeBtn.classList.remove('active');
    }
  });
});

async function runAutomation(prompt) {
  // Update task title
  taskTitle.textContent = prompt;
  
  // Hide empty state, show thinking
  emptyState.style.display = 'none';
  thinkingStatus.classList.add('active');
  stepsList.classList.remove('active');
  
  // Clear previous steps
  stepsList.innerHTML = '';
  currentSteps = [];
  lastScreenshot = null;
  
  // Use autonomous agent mode
  await runAutonomousAgent(prompt);
}

async function runAutonomousAgent(goal) {
  // Show thinking status
  thinkingStatus.classList.add('active');
  await sleep(500);
  
  // Hide thinking, show steps
  thinkingStatus.classList.remove('active');
  stepsList.classList.add('active');
  
  addStep('prepare', 'Preparing to assist you', 'active');
  await sleep(300);
  updateStep('prepare', 'Preparing to assist you', 'completed');
  
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
  const maxSteps = 100; // Safety limit
  
  while (stepCount < maxSteps) {
    stepCount++;
    
    // Capture current state (don't show as separate step)
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const base64 = screenshot.split(',')[1];
    lastScreenshot = screenshot;
    
    // Get page info
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }).catch(() => ({
      url: tab.url,
      title: tab.title
    }));
    
    // Ask agent what to do next - show screenshot with thinking message
    addStep(`decide-${stepCount}`, '🤔 Thinking...', 'active', screenshot);
    
    const resp = await fetch(`${BACKEND_URL}/agent/next_step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: goal,
        screenshot: base64,
        viewport: {
          url: pageInfo.url,
          title: pageInfo.title
        },
        history: history
      })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Backend error ${resp.status}: ${text || resp.statusText}`);
    }

    const decision = await resp.json();
    
    updateStep(`decide-${stepCount}`, `💭 ${decision.reasoning}`, 'completed', screenshot);
    
    // Check if completed
    if (decision.completed) {
      addStep('done', '✅ Task completed!', 'completed');
      // Hide automation aura
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
      break;
    }
    
    // Execute next action
    if (!decision.next_action) {
      addStep('error', '❌ Agent got stuck', 'failed');
      // Hide automation aura
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
      break;
    }
    
    const action = decision.next_action;
    const stepId = `action-${stepCount}`;
    const stepTitle = getStepTitle(action);
    
    addStep(stepId, stepTitle, 'active');
    
    // Handle prompt_user action type
    if (action.type === 'prompt_user') {
      const userInput = prompt(action.prompt || 'Please provide input');
      if (userInput === null) {
        updateStep(stepId, 'User cancelled input', 'failed');
        break;
      }
      updateStep(stepId, `User provided: ${action.input_type === 'password' ? '****' : userInput}`, 'completed');
      history.push(`${stepTitle} - User provided ${action.input_type}`);
      // Store the user input for next step
      action.user_provided_value = userInput;
      history.push(`User provided: ${userInput}`);
      continue; // Skip to next iteration where agent can use this value
    }
    
    try {
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
          // Manifest V3: Use scripting.executeScript
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
          // Page is restricted, try to navigate away first
          updateStep(stepId, `${stepTitle} - Restricted page, navigating...`, 'failed');
          const targetUrl = action.url || 'https://www.google.com';
          await chrome.tabs.update(tab.id, { url: targetUrl });
          await sleep(2000);
          history.push(`${stepTitle} - Navigated to escape restricted page`);
          continue; // Skip to next iteration
        } else {
          throw msgError;
        }
      }
      
      if (result.success) {
        updateStep(stepId, stepTitle, 'completed');
        history.push(`${stepTitle} - Success`);
      } else {
        updateStep(stepId, `${stepTitle} - ${result.error}`, 'failed');
        history.push(`${stepTitle} - Failed: ${result.error}`);
        
        // If vision click failed, try scrolling and retrying once
        if (action.type === 'vision_click' && result.error.includes('not found')) {
          await sleep(1000);
          addStep(`retry-${stepCount}`, '🔄 Scrolling to find element...', 'active');
          await chrome.tabs.sendMessage(tab.id, {
            action: 'executeStep',
            step: { type: 'scroll', amount: 300 }
          }).catch(() => {});
          updateStep(`retry-${stepCount}`, '🔄 Scrolled, will retry', 'completed');
        }
      }
      
      // Wait between actions
      await sleep(1000);
      
    } catch (error) {
      updateStep(stepId, `${stepTitle} - Error: ${error.message}`, 'failed');
      history.push(`${stepTitle} - Error: ${error.message}`);
    }
  }
  
  // Hide automation aura when done
  await chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }).catch(() => {});
  
  if (stepCount >= maxSteps) {
    addStep('limit', '⚠️ Reached step limit', 'failed');
  }
}

function getStepTitle(step) {
  switch(step.type) {
    case 'navigate':
      return `Reading page`;
    case 'vision_click':
      return `Clicking ${step.description || 'element'}`;
    case 'type':
      return `Typing text`;
    case 'scroll':
      return `Scrolling page`;
    case 'wait':
      return `Waiting for page to load`;
    case 'screenshot':
      return 'Taking screenshot of page';
    case 'prompt_user':
      return step.prompt || 'Requesting user input';
    default:
      return step.type;
  }
}

function addStep(id, title, status, screenshot = null) {
  const stepDiv = document.createElement('div');
  stepDiv.className = `step-item ${status}`;
  stepDiv.id = `step-${id}`;
  
  stepDiv.innerHTML = `
    <div class="step-bullet"></div>
    <div class="step-text">${title}</div>
  `;
  
  stepsList.appendChild(stepDiv);
  mainContent.scrollTop = mainContent.scrollHeight;
  
  if (screenshot) {
    updateScreenshot(screenshot);
  }
}

function updateStep(id, title, status, screenshot = null) {
  const stepDiv = document.getElementById(`step-${id}`);
  if (!stepDiv) return;
  
  stepDiv.className = `step-item ${status}`;
  stepDiv.querySelector('.step-text').textContent = title;
  
  mainContent.scrollTop = mainContent.scrollHeight;
  
  if (screenshot) {
    updateScreenshot(screenshot);
  }
}

function updateScreenshot(screenshot) {
  const img = document.getElementById('screenshotImg');
  img.src = screenshot;
  screenshotPreview.classList.add('active');
}

function showError(message) {
  thinkingStatus.classList.remove('active');
  stepsList.classList.add('active');
  addStep('error', `Error: ${message}`, 'failed');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
