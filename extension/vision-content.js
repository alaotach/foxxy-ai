// Vision-based content script - uses screenshots and AI instead of selectors

console.log('🦊 Foxy AI Vision content script loaded');

const BACKEND_URL = 'http://localhost:8000';

// Execute a single automation step using vision
async function executeStepVision(step) {
  const startTime = Date.now();
  const result = {
    step_id: step.id,
    success: false,
    duration_ms: 0,
    observations: {},
    error: null
  };

  try {
    console.log(`⚡ Executing (vision): ${step.type}`, step);

    switch (step.type) {
      case 'navigate':
        if (step.url) {
          window.location.href = step.url;
          result.observations.current_url = step.url;
          result.observations.page_title = document.title;
        }
        break;

      case 'click':
      case 'vision_click':
        // Take screenshot
        const screenshot = await captureScreenshot();
        
        // Ask AI where to click
        const clickResponse = await fetch(`${BACKEND_URL}/vision/find_element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot: screenshot,
            description: step.description || step.selector || 'the element to click',
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight
          })
        });
        
        const clickData = await clickResponse.json();
        
        if (clickData.success) {
          // Click at the coordinates
          await clickAtCoordinates(clickData.x, clickData.y);
          result.observations.click_coordinates = { x: clickData.x, y: clickData.y };
        } else {
          throw new Error(`Vision could not find: ${step.description || step.selector}`);
        }
        break;

      case 'type':
        // Take screenshot to find input field
        const typeScreenshot = await captureScreenshot();
        
        const typeResponse = await fetch(`${BACKEND_URL}/vision/find_element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot: typeScreenshot,
            description: step.description || step.selector || 'the input field',
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight
          })
        });
        
        const typeData = await typeResponse.json();
        
        if (typeData.success) {
          // Click to focus
          await clickAtCoordinates(typeData.x, typeData.y);
          await sleep(200);
          
          // Type the text
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.value = step.text;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // Fallback: simulate typing
            document.execCommand('insertText', false, step.text);
          }
        } else {
          throw new Error(`Vision could not find input: ${step.description || step.selector}`);
        }
        break;

      case 'scroll':
        const amount = step.amount || 500;
        window.scrollBy({ top: amount, behavior: 'smooth' });
        await sleep(500);
        break;

      case 'screenshot':
        const screenshotData = await captureScreenshot();
        result.observations.screenshot = screenshotData;
        break;

      case 'extract_text':
        // Use vision to extract text from screenshot
        const extractScreenshot = await captureScreenshot();
        
        const extractResponse = await fetch(`${BACKEND_URL}/vision/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot: extractScreenshot,
            question: `Extract the text from: ${step.description || step.selector || 'the visible content'}`
          })
        });
        
        const extractData = await extractResponse.json();
        result.observations.extracted_text = extractData.answer;
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    result.success = true;
    console.log(`✅ Success (vision): ${step.type}`);

  } catch (error) {
    result.success = false;
    result.error = error.message;
    console.error(`❌ Failed (vision): ${step.type}`, error);
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// Capture screenshot of visible viewport
async function captureScreenshot() {
  return new Promise((resolve) => {
    // Send message to background script to capture screenshot
    browser.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
      if (response && response.screenshot) {
        // Remove data:image/png;base64, prefix
        const base64 = response.screenshot.split(',')[1];
        resolve(base64);
      } else {
        resolve(null);
      }
    });
  });
}

// Click at specific coordinates
async function clickAtCoordinates(x, y) {
  // Create visual feedback
  const marker = document.createElement('div');
  marker.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 20px;
    height: 20px;
    border: 3px solid #ff6b35;
    border-radius: 50%;
    background: rgba(255, 107, 53, 0.2);
    z-index: 999999;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: pulse 0.5s ease-out;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(marker);
  
  // Click at coordinates
  const element = document.elementFromPoint(x, y);
  if (element) {
    element.click();
  } else {
    // Dispatch mouse event at coordinates
    const event = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });
    document.elementFromPoint(x, y)?.dispatchEvent(event);
  }
  
  // Remove marker after animation
  setTimeout(() => {
    marker.remove();
    style.remove();
  }, 500);
  
  await sleep(300);
}

// Get page info
function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title
  };
}

// Utility: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeStep') {
    executeStepVision(message.step).then(sendResponse);
    return true; // Async response
  }
  
  if (message.action === 'getPageInfo') {
    sendResponse(getPageInfo());
    return true;
  }
});
