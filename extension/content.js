// Content script - executes automation steps on the current page

console.log('🦊 Foxy AI content script loaded');

// Execute a single automation step
async function executeStep(step) {
  const startTime = Date.now();
  const result = {
    step_id: step.id,
    success: false,
    duration_ms: 0,
    observations: {},
    error: null
  };

  try {
    console.log(`⚡ Executing: ${step.type}`, step);

    switch (step.type) {
      case 'navigate':
        // Navigate in the current tab
        if (step.url) {
          window.location.href = step.url;
          result.observations.current_url = step.url;
          result.observations.page_title = document.title;
        }
        break;

      case 'click':
        if (!step.selector) throw new Error('Click requires selector');
        const clickElement = await waitForElement(step.selector, step.timeout || 10000);
        
        // Highlight before clicking
        highlightElement(clickElement);
        await sleep(300);
        
        clickElement.click();
        break;

      case 'type':
        if (!step.selector || !step.text) throw new Error('Type requires selector and text');
        const inputElement = await waitForElement(step.selector, step.timeout || 10000);
        
        // Highlight before typing
        highlightElement(inputElement);
        await sleep(300);
        
        if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
          inputElement.value = step.text;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          inputElement.textContent = step.text;
        }
        break;

      case 'scroll':
        const amount = step.amount || 500;
        window.scrollBy({ top: amount, behavior: 'smooth' });
        break;

      case 'wait':
        if (!step.selector) throw new Error('Wait requires selector');
        await waitForElement(step.selector, step.timeout || 10000);
        result.observations.element_found = true;
        break;

      case 'extract_text':
        if (!step.selector) throw new Error('Extract text requires selector');
        const textElement = await waitForElement(step.selector, step.timeout || 10000);
        highlightElement(textElement);
        result.observations.extracted_text = textElement.textContent || textElement.innerText || '';
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    result.success = true;
    console.log(`✅ Success: ${step.type}`);
  } catch (error) {
    result.success = false;
    result.error = error.message;
    console.error(`❌ Failed: ${step.type}`, error);
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Try to find element immediately
    const element = findElement(selector);
    if (element) {
      return resolve(element);
    }

    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      const element = findElement(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector} (timeout ${timeout}ms)`));
    }, timeout);
  });
}

// Find element with multiple selector strategies
function findElement(selector) {
  // Try text selector first (text=Login or text="Login")
  if (selector.startsWith('text=')) {
    const textMatch = selector.match(/^text=["']?([^"']+)["']?$/);
    if (textMatch) {
      const text = textMatch[1];
      return findElementByText(text);
    }
  }

  // Try CSS selector
  try {
    return document.querySelector(selector);
  } catch (e) {
    return null;
  }
}

// Find element by visible text
function findElementByText(text) {
  const xpath = `//*[contains(text(), "${text}")]`;
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

// Highlight element with animation
function highlightElement(element) {
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalBackground = element.style.backgroundColor;

  element.style.outline = '3px solid #667eea';
  element.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
  element.style.transition = 'all 0.3s';

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.backgroundColor = originalBackground;
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
    title: document.title
  };
}

// Message listener from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeStep') {
    executeStep(message.step).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getPageInfo') {
    sendResponse(getPageInfo());
    return true;
  }
});

console.log('✅ Foxy AI ready on this page');
