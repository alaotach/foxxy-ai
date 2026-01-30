// Pure VLM Automation - Simpler, more accurate
// VLM sees the page and decides actions directly

console.log('🎯 Pure VLM Automation loaded');

const BACKEND_URL = 'http://localhost:8000';

// Capture screenshot
async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
      if (response && response.screenshot) {
        resolve(response.screenshot.split(',')[1]); // Base64 only
      } else {
        resolve(null);
      }
    });
  });
}

// Execute action from VLM
async function executeAction(action) {
  console.log('⚡ Executing VLM action:', action.action);
  
  switch (action.action) {
    case 'click':
      await clickAt(action.x, action.y);
      break;
      
    case 'type':
      await typeText(action.text);
      break;
      
    case 'scroll':
      window.scrollBy({ top: action.amount, behavior: 'smooth' });
      await sleep(500);
      break;
      
    case 'wait':
      await sleep(action.duration || 2000);
      break;
      
    case 'done':
      console.log('✅ Task complete!');
      break;
      
    default:
      console.log('❌ Unknown action:', action.action);
  }
  
  console.log('💭 VLM reasoning:', action.reasoning);
}

// Click at coordinates with visual feedback
async function clickAt(x, y) {
  console.log(`👆 Clicking at EXACT COORDINATES (${x}, ${y})`);
  
  // Validate coordinates
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    console.warn(`⚠️ Coords (${x},${y}) outside viewport (${window.innerWidth}x${window.innerHeight})`);
    return;
  }
  
  // Visual marker
  const marker = document.createElement('div');
  marker.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 30px;
    height: 30px;
    border: 4px solid #00ff00;
    border-radius: 50%;
    background: rgba(0, 255, 0, 0.3);
    z-index: 999999;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: clickPulse 0.6s ease-out;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes clickPulse {
      0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(marker);
  
  // PURE COORDINATE CLICKING - Create real mouse events
  const mousedownEvent = new MouseEvent('mousedown', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0
  });
  
  const mouseupEvent = new MouseEvent('mouseup', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0
  });
  
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0
  });
  
  // Get element at coordinates and dispatch events
  const element = document.elementFromPoint(x, y);
  if (element) {
    console.log('🎯 Element at coordinates:', element.tagName, element.className);
    element.dispatchEvent(mousedownEvent);
    await sleep(50);
    element.dispatchEvent(mouseupEvent);
    await sleep(50);
    element.dispatchEvent(clickEvent);
  } else {
    console.warn('⚠️ No element at coordinates, dispatching to document');
    document.dispatchEvent(mousedownEvent);
    document.dispatchEvent(mouseupEvent);
    document.dispatchEvent(clickEvent);
  }
  
  // Remove marker
  setTimeout(() => marker.remove(), 600);
  
  // Wait for page response
  await sleep(1000);
}

// Type text (finds focused element or active input)
async function typeText(text) {
  const activeEl = document.activeElement;
  
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || 
                   activeEl.contentEditable === 'true')) {
    if (activeEl.contentEditable === 'true') {
      activeEl.textContent = text;
    } else {
      activeEl.value = text;
    }
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));
    console.log(`⌨️ Typed: "${text}"`);
  } else {
    console.warn('⚠️ No active input element');
  }
  
  await sleep(500);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main automation loop
async function runPureVLMAutomation(goal) {
  console.log('🚀 Starting Pure VLM Automation');
  console.log('🎯 Goal:', goal);
  
  let step = 0;
  const maxSteps = 30;
  
  while (step < maxSteps) {
    step++;
    console.log(`\n⏳ Step ${step}/${maxSteps}`);
    
    // Capture current page
    const screenshot = await captureScreenshot();
    if (!screenshot) {
      console.error('❌ Failed to capture screenshot');
      break;
    }
    
    // Ask VLM what to do
    try {
      const response = await fetch(`${BACKEND_URL}/vision/pure_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshot,
          task: goal,
          context: `Step ${step}: Working towards "${goal}"`
        })
      });
      
      const action = await response.json();
      
      // Check if done
      if (action.action === 'done') {
        console.log('✅ Task completed!');
        break;
      }
      
      // Check for error
      if (action.action === 'error') {
        console.error('❌ VLM error:', action.reasoning);
        break;
      }
      
      // Execute the action
      await executeAction(action);
      
      // Wait between actions
      await sleep(2000);
      
    } catch (error) {
      console.error('❌ Error:', error);
      break;
    }
  }
  
  if (step >= maxSteps) {
    console.warn('⚠️ Max steps reached');
  }
  
  console.log('🏁 Automation complete');
}

// Example usage
window.runPureVLM = runPureVLMAutomation;

console.log('✅ Pure VLM ready! Use: runPureVLM("Your goal here")');
console.log('💡 Example: runPureVLM("make 14 feb valentine ppt for her on canva")');
