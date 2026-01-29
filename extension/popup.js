const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';
const AUTOMATION_CORE_URL = 'http://localhost:3000';

const chatLog = document.getElementById('chatLog');
const promptInput = document.getElementById('promptInput');
const executeBtn = document.getElementById('executeBtn');
const status = document.getElementById('status');
const stepIndicator = document.getElementById('stepIndicator');
const usePlaywrightToggle = document.getElementById('usePlaywrightToggle');
const useVisionToggle = document.getElementById('useVisionToggle');

// WebSocket connection
let wsClient = null;
let useWebSocket = false; // Toggle this to enable/disable WebSocket
let usePlaywright = false; // Toggle to use Playwright instead of content script
let useVision = true; // Toggle to use vision-based automation

// Update usePlaywright when checkbox changes
usePlaywrightToggle.addEventListener('change', (e) => {
  usePlaywright = e.target.checked;
  const mode = usePlaywright ? 'Playwright (new browser)' : 'Current page';
  addMessage(`🔧 Switched to: ${mode}`, 'system');
});

// Update useVision when checkbox changes
useVisionToggle.addEventListener('change', (e) => {
  useVision = e.target.checked;
  const mode = useVision ? 'Vision (AI sees screenshots)' : 'Selectors (CSS)';
  addMessage(`🎯 Switched to: ${mode}`, 'system');
});

// Add message to chat log
function addMessage(text, type = 'system') {
  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  msg.textContent = text;
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Update status
function setStatus(text, showLoader = false) {
  status.innerHTML = showLoader ? `<span class="loader"></span> ${text}` : text;
}

// Execute automation
async function executeAutomation(prompt) {
  if (!prompt.trim()) return;

  addMessage(prompt, 'user');
  executeBtn.disabled = true;
  setStatus('Thinking...', true);

  try {
    // Step 1: Get plan from backend
    setStatus('Getting plan from AI...', true);
    const planResponse = await fetch(`${BACKEND_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!planResponse.ok) {
      throw new Error(`Backend error: ${planResponse.status}`);
    }

    const plan = await planResponse.json();
    addMessage(`📋 Plan created: ${plan.steps.length} steps`, 'system');

    // Decide execution method: Playwright or Content Script
    if (usePlaywright) {
      addMessage('🔧 Using Playwright mode (new browser)', 'system');
      // Execute using automation-core (Playwright)
      await executeWithPlaywright(prompt, plan.steps);
    } else {
      addMessage('🔧 Using content script mode (current page)', 'system');
      // Execute using content script on current page
      await executeWithContentScript(plan);
    }

  } catch (error) {
    addMessage(`❌ Error: ${error.message}`, 'error');
    setStatus('');
    stepIndicator.style.display = 'none';
  } finally {
    executeBtn.disabled = false;
  }
}

// Execute using Playwright automation-core
async function executeWithPlaywright(prompt, steps) {
  try {
    setStatus('Launching Playwright browser...', true);
    
    // Send to automation-core
    const response = await fetch(`${AUTOMATION_CORE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        steps: steps
      })
    });

    if (!response.ok) {
      throw new Error(`Automation core error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      const succeeded = result.results.filter(r => r.success).length;
      addMessage(`✅ Completed: ${succeeded}/${result.results.length} steps`, 'success');
      setStatus(`Done! ${succeeded} steps completed`);
    } else {
      addMessage(`❌ Execution failed: ${result.error}`, 'error');
      setStatus('Execution failed');
    }

    // Show individual step results
    result.results.forEach((stepResult, i) => {
      if (stepResult.success) {
        addMessage(`  ✅ Step ${i + 1}: ${stepResult.step_id}`, 'success');
      } else {
        addMessage(`  ❌ Step ${i + 1}: ${stepResult.error}`, 'error');
      }
    });

    stepIndicator.style.display = 'none';

  } catch (error) {
    addMessage(`❌ Playwright error: ${error.message}`, 'error');
    addMessage('💡 Make sure automation-core server is running (npm run server)', 'system');
    setStatus('');
    stepIndicator.style.display = 'none';
  }
}

// Execute using content script on current page
async function executeWithContentScript(plan) {
  try {
    // Step 2: Get active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    // Step 3: Execute steps on the current page
    setStatus('Executing on current page...', true);
    
    const results = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      stepIndicator.style.display = 'block';
      stepIndicator.textContent = `Step ${i + 1}/${plan.steps.length}: ${step.type} ${step.selector || step.url || ''}`;
      
      try {
        // Execute step in content script
        const result = await browser.tabs.sendMessage(tab.id, {
          action: 'executeStep',
          step: step
        });

        results.push(result);

        if (!result.success) {
          addMessage(`❌ Step ${i + 1} failed: ${result.error}`, 'error');
          break;
        } else {
          addMessage(`✅ Step ${i + 1}: ${step.type}`, 'success');
        }
      } catch (error) {
        results.push({
          step_id: step.id,
          success: false,
          error: error.message,
          duration_ms: 0
        });
        addMessage(`❌ Step ${i + 1} failed: ${error.message}`, 'error');
        break;
      }
    }

    // Step 4: Send feedback to backend
    setStatus('Sending feedback...', true);
    const pageInfo = await browser.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    
    await fetch(`${BACKEND_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: plan.task_id,
        feedback: {
          task_id: plan.task_id,
          completed_steps: results,
          current_url: pageInfo.url,
          page_title: pageInfo.title
        }
      })
    });

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    addMessage(`✅ Completed: ${succeeded} succeeded, ${failed} failed`, 'system');
    setStatus(`Done! ${succeeded}/${plan.steps.length} steps succeeded`);
    stepIndicator.style.display = 'none';

  } catch (error) {
    addMessage(`❌ Content script error: ${error.message}`, 'error');
    setStatus('');
    stepIndicator.style.display = 'none';
  }
}

// Event listeners
executeBtn.addEventListener('click', () => {
  executeAutomation(promptInput.value);
  promptInput.value = '';
});

promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    executeAutomation(promptInput.value);
    promptInput.value = '';
  }
});

// Check backend connection on load
async function checkBackend() {
  try {
    const response = await fetch(BACKEND_URL);
    if (response.ok) {
      setStatus('✅ Connected to backend');
      
      // Try WebSocket connection
      if (useWebSocket) {
        try {
          wsClient = new FoxyWebSocket(WS_URL);
          await wsClient.connect();
          
          // Set up WebSocket listeners
          setupWebSocketListeners();
          
          addMessage('🔌 Real-time streaming enabled', 'system');
        } catch (error) {
          console.warn('WebSocket not available, using HTTP only', error);
          useWebSocket = false;
        }
      }
    }
  } catch (error) {
    setStatus('⚠️ Backend not running');
    addMessage('⚠️ Make sure Python backend is running (python main.py)', 'error');
  }
  
  // Check automation-core connection
  try {
    const response = await fetch(`${AUTOMATION_CORE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      addMessage('🦊 Automation Core ready (Playwright available)', 'system');
      usePlaywright = true; // Enable Playwright option
    }
  } catch (error) {
    console.log('Automation core not running, will use content script only');
  }
}

function setupWebSocketListeners() {
  if (!wsClient) return;

  wsClient.on('planning_start', (data) => {
    addMessage(`🧠 Planning: "${data.prompt}"`, 'system');
  });

  wsClient.on('step_executing', (data) => {
    stepIndicator.style.display = 'block';
    stepIndicator.textContent = `Step ${data.step_num}/${data.total}: ${data.step.type}`;
  });

  wsClient.on('step_result', (data) => {
    const { result } = data;
    if (result.success) {
      addMessage(`✅ ${result.step_id}`, 'success');
    } else {
      addMessage(`❌ ${result.step_id}: ${result.error}`, 'error');
    }
  });

  wsClient.on('execution_complete', (data) => {
    stepIndicator.style.display = 'none';
    addMessage(`🎉 Complete: ${data.summary.succeeded} succeeded`, 'success');
  });

  wsClient.on('error', (data) => {
    addMessage(`❌ Error: ${data.error}`, 'error');
  });
}

checkBackend();
