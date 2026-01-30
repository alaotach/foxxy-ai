// Content script - executes automation steps on the current page
// Chrome Automation Agent - Implements robust action execution with retries, waits, and logging

console.log('🦊 Foxy AI content script loaded');

// Configuration
const CONFIG = {
  DEFAULT_TIMEOUT: 10000,
  DEFAULT_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 500,
  ACTION_DELAY: 200, // Delay between actions to mimic human pace
  SCROLL_BEHAVIOR: 'auto',
  SCROLL_BLOCK: 'center'
};

// Logging to chrome.storage for debugging
const actionLog = [];

function logAction(action, status, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    status,
    ...details
  };
  actionLog.push(entry);
  console.log(`📝 ${status.toUpperCase()}: ${action}`, details);
  
  // Store logs in chrome.storage.local
  chrome.storage.local.set({ actionLog: actionLog.slice(-100) }); // Keep last 100 entries
}

// Execute a single automation step with retries and proper error handling
async function executeStep(step) {
  const startTime = Date.now();
  const result = {
    step_id: step.id || `step-${Date.now()}`,
    success: false,
    duration_ms: 0,
    observations: {},
    error: null
  };

  logAction(step.type, 'start', { selector: step.selector, value: step.text || step.url });

  try {
    // Execute with retry logic
    let lastError = null;
    const maxAttempts = step.retries || CONFIG.DEFAULT_RETRY_ATTEMPTS;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await executeAction(step, result);
        result.success = true;
        logAction(step.type, 'success', { attempt, observations: result.observations });
        break;
      } catch (error) {
        lastError = error;
        logAction(step.type, 'retry', { attempt, error: error.message });
        
        if (attempt < maxAttempts) {
          await sleep(CONFIG.RETRY_DELAY * attempt); // Exponential backoff
        }
      }
    }
    
    if (!result.success) {
      throw lastError || new Error('Action failed after retries');
    }

  } catch (error) {
    result.success = false;
    result.error = error.message;
    logAction(step.type, 'failed', { error: error.message });
    console.error(`❌ Failed: ${step.type}`, error);
  }

  result.duration_ms = Date.now() - startTime;
  
  // Small delay after each action to let page update
  await sleep(CONFIG.ACTION_DELAY);
  
  return result;
}

// Execute single action (called by executeStep with retry wrapper)
async function executeAction(step, result) {
  switch (step.type) {
    case 'navigate':
      if (!step.url) throw new Error('Navigate requires url');
      window.location.href = step.url;
      result.observations.current_url = step.url;
      result.observations.page_title = document.title;
      break;

    case 'click':
      if (!step.selector) throw new Error('Click requires selector');
      const clickElement = await waitForElement(step.selector, step.timeout);
      
      // Scroll element into view
      scrollIntoView(clickElement);
      await sleep(100);
      
      // Verify element is clickable
      if (!isElementClickable(clickElement)) {
        throw new Error('Element not clickable (hidden or disabled)');
      }
      
      highlightElement(clickElement);
      await sleep(200);
      
      // Use coordinate-based MouseEvent only - no element.click()
      const rect = clickElement.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      // Dispatch MouseEvent at center coordinates
      const mouseEventOptions = {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x,
        screenY: window.screenY + y
      };
      
      clickElement.dispatchEvent(new MouseEvent('mousedown', mouseEventOptions));
      await sleep(50);
      clickElement.dispatchEvent(new MouseEvent('mouseup', mouseEventOptions));
      await sleep(50);
      clickElement.dispatchEvent(new MouseEvent('click', mouseEventOptions));
      
      result.observations.clicked = true;
      result.observations.element_tag = clickElement.tagName;
      break;

    case 'type':
      if (!step.selector || step.text === undefined) {
        throw new Error('Type requires selector and text');
      }
      const inputElement = await waitForElement(step.selector, step.timeout);
      
      scrollIntoView(inputElement);
      await sleep(100);
      
      highlightElement(inputElement);
      await sleep(200);
      
      // Focus element first
      inputElement.focus();
      
      if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
        // Clear existing value if needed
        if (step.clear !== false) {
          inputElement.value = '';
        }
        
        // Type character by character for realistic input
        if (step.simulate_typing) {
          for (const char of step.text) {
            inputElement.value += char;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50); // Realistic typing speed
          }
        } else {
          inputElement.value = step.text;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        inputElement.textContent = step.text;
      }
      
      result.observations.typed = step.text.length + ' characters';
      break;

    case 'scroll':
      const amount = step.amount || 500;
      const direction = step.direction || 'down';
      
      if (step.selector) {
        // Scroll specific element into view
        const scrollElement = await waitForElement(step.selector, step.timeout);
        scrollIntoView(scrollElement);
      } else {
        // Scroll window
        const scrollAmount = direction === 'down' ? amount : -amount;
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
      
      result.observations.scrolled = amount + 'px';
      break;

    case 'wait':
      if (step.selector) {
        await waitForElement(step.selector, step.timeout || 10000);
        result.observations.element_found = true;
      } else if (step.duration) {
        await sleep(step.duration);
        result.observations.waited = step.duration + 'ms';
      } else {
        throw new Error('Wait requires selector or duration');
      }
      break;

    case 'extract_text':
      if (!step.selector) throw new Error('Extract text requires selector');
      const textElement = await waitForElement(step.selector, step.timeout);
      scrollIntoView(textElement);
      highlightElement(textElement);
      
      const extractedText = textElement.textContent || textElement.innerText || '';
      result.observations.extracted_text = extractedText.trim();
      result.observations.text_length = extractedText.length;
      break;

    case 'extract':
      if (!step.selector) throw new Error('Extract requires selector');
      const elements = document.querySelectorAll(step.selector);
      const data = Array.from(elements).map(el => ({
        text: el.textContent?.trim(),
        html: el.innerHTML,
        tag: el.tagName
      }));
      result.observations.extracted_data = data;
      result.observations.count = data.length;
      break;

    case 'vision_click':
      // Pure coordinate-based click using MouseEvent ONLY - no DOM element.click()
      // Log what we received from backend
      console.log('🎯 vision_click received:', { 
        bbox: step.bbox, 
        description: step.description,
        fullStep: step 
      });
      
      // FLEXIBLE COORDINATE HANDLING - accept either bbox or direct coordinates
      let clickX, clickY;
      
      if (step.bbox && (step.bbox.x !== null && step.bbox.x !== undefined)) {
        // Format 1: bbox object
        const { x, y, width, height } = step.bbox;
        clickX = Math.round(x + (width || 0) / 2);
        clickY = Math.round(y + (height || 0) / 2);
      } else if (step.x !== null && step.x !== undefined && step.y !== null && step.y !== undefined) {
        // Format 2: direct x, y coordinates
        clickX = Math.round(step.x);
        clickY = Math.round(step.y);
      } else {
        const errorMsg = `❌ BACKEND ERROR: No valid coordinates. bbox=${JSON.stringify(step.bbox)}, x=${step.x}, y=${step.y}. Backend MUST return valid coordinates!`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`🖱️ Clicking at coordinates: (${clickX}, ${clickY})`);
      
      // Scroll to make coordinates visible
      window.scrollTo({
        top: Math.max(0, clickY - window.innerHeight / 2),
        left: Math.max(0, clickX - window.innerWidth / 2),
        behavior: 'smooth'
      });
      await sleep(300);
      
      // Get element at coordinates for highlighting only
      const element = document.elementFromPoint(clickX, clickY);
      
      // Highlight the element if found
      if (element) {
        console.log(`✓ Element found at coordinates: <${element.tagName}> class="${element.className}"`);
        highlightElement(element);
        await sleep(200);
        result.observations.element_tag = element.tagName;
        result.observations.element_class = element.className;
      } else {
        console.warn(`⚠️ No element at coordinates (${clickX}, ${clickY}) - clicking anyway`);
      }
      
      // PURE COORDINATE CLICK - dispatch all mouse events at exact coordinates
      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      
      for (const eventType of mouseEvents) {
        const mouseEvent = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: clickX,
          clientY: clickY,
          screenX: clickX,
          screenY: clickY,
          button: 0,
          buttons: eventType === 'mousedown' ? 1 : 0
        });
        
        if (element) {
          element.dispatchEvent(mouseEvent);
        } else {
          // Dispatch to document if no element found
          document.dispatchEvent(mouseEvent);
        }
        
        await sleep(50); // Small delay between events
      }
      
      console.log(`✅ MouseEvent clicks dispatched at (${clickX}, ${clickY})`);
      
      result.observations.vision_click = true;
      result.observations.click_method = 'MouseEvent_ONLY';
      result.observations.coordinates = { x: clickX, y: clickY };
      result.observations.no_dom_click = true;
      break;

    case 'vision_type':
      // Vision-based typing using coordinates ONLY
      if (!step.bbox) {
        throw new Error('vision_type requires bbox coordinates (x, y, width, height)');
      }
      
      const { x: typeX, y: typeY, width: typeWidth, height: typeHeight } = step.bbox;
      const typeCenterX = Math.round(typeX + typeWidth / 2);
      const typeCenterY = Math.round(typeY + typeHeight / 2);
      
      // Scroll to coordinates
      window.scrollTo({
        top: Math.max(0, typeCenterY - window.innerHeight / 2),
        left: Math.max(0, typeCenterX - window.innerWidth / 2),
        behavior: 'smooth'
      });
      await sleep(300);
      
      const inputElement = document.elementFromPoint(typeCenterX, typeCenterY);
      if (!inputElement) throw new Error('No input element found at coordinates');
      
      highlightElement(inputElement);
      await sleep(200);
      
      inputElement.focus();
      
      if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
        if (step.clear !== false) {
          inputElement.value = '';
        }
        
        if (step.simulate_typing) {
          for (const char of step.text) {
            inputElement.value += char;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50);
          }
        } else {
          inputElement.value = step.text;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        inputElement.textContent = step.text;
      }
      
      result.observations.vision_type = true;
      result.observations.typed = step.text.length + ' characters';
      result.observations.coordinates = { x: typeCenterX, y: typeCenterY };
      break;

    case 'vision_extract':
      // Vision-based extraction using coordinates ONLY
      if (!step.bbox) {
        throw new Error('vision_extract requires bbox coordinates (x, y, width, height)');
      }
      
      const { x: extractX, y: extractY, width: extractWidth, height: extractHeight } = step.bbox;
      const extractCenterX = Math.round(extractX + extractWidth / 2);
      const extractCenterY = Math.round(extractY + extractHeight / 2);
      
      // Scroll to coordinates
      window.scrollTo({
        top: Math.max(0, extractCenterY - window.innerHeight / 2),
        left: Math.max(0, extractCenterX - window.innerWidth / 2),
        behavior: 'smooth'
      });
      await sleep(300);
      
      const extractElement = document.elementFromPoint(extractCenterX, extractCenterY);
      
      if (extractElement) {
        highlightElement(extractElement);
        const extractedText = extractElement.textContent || extractElement.innerText || '';
        result.observations.extracted_text = extractedText.trim();
        result.observations.text_length = extractedText.length;
        result.observations.coordinates = { x: extractCenterX, y: extractCenterY };
      } else {
        throw new Error('No element found at bbox coordinates');
      }
      break;

    case 'screenshot':
      // Capture screenshot and send to background
      chrome.runtime.sendMessage({ 
        type: 'capture_screenshot',
        params: step.params || {}
      }, (response) => {
        if (response && response.success) {
          result.observations.screenshot = response.screenshot;
          result.observations.screenshot_size = response.screenshot.length;
        }
      });
      await sleep(500); // Wait for screenshot capture
      break;

    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// Find element by natural language description
function findElementByDescription(description) {
  // Try matching by text content
  const lowerDesc = description.toLowerCase();
  
  // Search for buttons, links, etc. with matching text
  const allElements = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]');
  for (const el of allElements) {
    const text = (el.textContent || el.innerText || el.value || '').toLowerCase();
    if (text.includes(lowerDesc) || lowerDesc.includes(text)) {
      if (isElementVisible(el)) {
        return el;
      }
    }
  }
  
  // Try matching by aria-label
  const ariaLabel = document.querySelector(`[aria-label*="${description}"]`);
  if (ariaLabel && isElementVisible(ariaLabel)) {
    return ariaLabel;
  }
  
  // Try matching by placeholder
  const placeholder = document.querySelector(`[placeholder*="${description}"]`);
  if (placeholder && isElementVisible(placeholder)) {
    return placeholder;
  }
  
  // Try matching by title
  const title = document.querySelector(`[title*="${description}"]`);
  if (title && isElementVisible(title)) {
    return title;
  }
  
  return null;
}

// Wait for element with explicit polling and MutationObserver
function waitForElement(selector, timeout = CONFIG.DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Try to find element immediately
    const element = findElement(selector);
    if (element && isElementVisible(element)) {
      return resolve(element);
    }

    // Poll every 500ms
    const pollInterval = setInterval(() => {
      const element = findElement(selector);
      if (element && isElementVisible(element)) {
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        observer.disconnect();
        reject(new Error(`Element not found or not visible: ${selector} (timeout ${timeout}ms)`));
      }
    }, 500);

    // Set up MutationObserver for dynamic content
    const observer = new MutationObserver(() => {
      const element = findElement(selector);
      if (element && isElementVisible(element)) {
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Timeout
    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      observer.disconnect();
      reject(new Error(`Element not found: ${selector} (timeout ${timeout}ms)`));
    }, timeout);
  });
}

// Find element with multiple selector strategies (stable selectors)
function findElement(selector) {
  // Try ID first (most stable)
  if (selector.startsWith('#')) {
    const el = document.getElementById(selector.substring(1));
    if (el) return el;
  }
  
  // Try ARIA attributes (accessible and stable)
  if (selector.startsWith('[aria-')) {
    try {
      const el = document.querySelector(selector);
      if (el) return el;
    } catch (e) {}
  }
  
  // Try text selector (text=Login or text="Login")
  if (selector.startsWith('text=')) {
    const textMatch = selector.match(/^text=["']?([^"']+)["']?$/);
    if (textMatch) {
      const text = textMatch[1];
      return findElementByText(text);
    }
  }

  // Try CSS selector
  try {
    const el = document.querySelector(selector);
    if (el) return el;
  } catch (e) {}
  
  // Try XPath if selector looks like XPath
  if (selector.startsWith('//') || selector.startsWith('(//')) {
    try {
      const result = document.evaluate(selector, document, null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result.singleNodeValue) return result.singleNodeValue;
    } catch (e) {}
  }
  
  return null;
}

// Find element by visible text using XPath
function findElementByText(text) {
  // Try exact match first
  let xpath = `//*[normalize-space(text())="${text}"]`;
  let result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  if (result.singleNodeValue) return result.singleNodeValue;
  
  // Try contains
  xpath = `//*[contains(normalize-space(text()), "${text}")]`;
  result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

// Check if element is visible
function isElementVisible(element) {
  if (!element) return false;
  
  // Check if element has offsetParent (is rendered)
  if (element.offsetParent === null) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  return true;
}

// Check if element is clickable
function isElementClickable(element) {
  if (!isElementVisible(element)) return false;
  
  // Check if disabled
  if (element.disabled) return false;
  
  // Check if has pointer-events: none
  const style = window.getComputedStyle(element);
  if (style.pointerEvents === 'none') return false;
  
  return true;
}

// Scroll element into view with proper behavior
function scrollIntoView(element) {
  if (!element) return;
  
  element.scrollIntoView({
    behavior: CONFIG.SCROLL_BEHAVIOR,
    block: CONFIG.SCROLL_BLOCK,
    inline: 'nearest'
  });
}

// Highlight element with animation and overlay
function highlightElement(element) {
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalBackground = element.style.backgroundColor;
  const originalTransition = element.style.transition;

  element.style.outline = '3px solid #ff6b35';
  element.style.backgroundColor = 'rgba(255, 107, 53, 0.2)';
  element.style.transition = 'all 0.3s ease';

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.backgroundColor = originalBackground;
    element.style.transition = originalTransition;
  }, 1000);
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get current page info
function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    readyState: document.readyState,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    }
  };
}

// Message listener from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeStep') {
    executeStep(message.step)
      .then(sendResponse)
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getPageInfo') {
    sendResponse(getPageInfo());
    return true;
  }
  
  if (message.action === 'getLogs') {
    sendResponse({ logs: actionLog });
    return true;
  }
  
  if (message.action === 'clearLogs') {
    actionLog.length = 0;
    chrome.storage.local.remove('actionLog');
    sendResponse({ success: true });
    return true;
  }
});

console.log('✅ Foxy AI ready on this page');
