/**
 * Tool Registry - Central registry for all browser automation tools
 * Inspired by BrowserOS controller extension
 */

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerAllTools();
  }

  /**
   * Register a tool with its handler function
   */
  register(name, handler) {
    this.tools.set(name, handler);
    console.log(`✅ Registered tool: ${name}`);
  }

  /**
   * Execute a tool by name with provided parameters
   */
  async execute(toolName, params) {
    const handler = this.tools.get(toolName);
    
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`🔧 Executing tool: ${toolName}`, params);
    const startTime = Date.now();
    
    try {
      const result = await handler(params);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Tool ${toolName} completed in ${duration}ms`);
      return {
        success: true,
        result,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ Tool ${toolName} failed:`, error);
      return {
        success: false,
        error: error.message,
        duration_ms: duration
      };
    }
  }

  /**
   * Get list of all available tools
   */
  getAvailableTools() {
    return Array.from(this.tools.keys());
  }

  /**
   * Register all available tools
   */
  registerAllTools() {
    // Import and register all tool categories
    this.registerNavigationTools();
    this.registerInteractionTools();
    this.registerExtractionTools();
    this.registerUtilityTools();
  }

  /**
   * Navigation tools
   */
  registerNavigationTools() {
    // Navigate to URL
    this.register('navigate', async (params) => {
      const { url } = params;
      if (!url) throw new Error('URL required');
      
      window.location.href = url;
      
      // Wait for page to start loading
      await sleep(500);
      
      return {
        url: window.location.href,
        title: document.title
      };
    });

    // Go back
    this.register('go_back', async () => {
      window.history.back();
      await sleep(500);
      return { success: true };
    });

    // Go forward
    this.register('go_forward', async () => {
      window.history.forward();
      await sleep(500);
      return { success: true };
    });

    // Reload page
    this.register('reload', async () => {
      window.location.reload();
      await sleep(500);
      return { success: true };
    });
  }

  /**
   * Interaction tools (click, type, scroll, etc.)
   */
  registerInteractionTools() {
    // Click element
    this.register('click', async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) throw new Error('Selector required');
      
      const element = await waitForElement(selector, timeout);
      highlightElement(element);
      await sleep(300);
      
      element.click();
      await sleep(200);
      
      return {
        clicked: true,
        selector,
        element_text: element.textContent?.substring(0, 100)
      };
    });

    // Type text
    this.register('type', async (params) => {
      const { selector, text, timeout = 10000, clear = true } = params;
      if (!selector || text === undefined) {
        throw new Error('Selector and text required');
      }
      
      const element = await waitForElement(selector, timeout);
      highlightElement(element);
      await sleep(300);
      
      if (clear) {
        element.value = '';
      }
      
      // Simulate realistic typing
      for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
      
      return {
        typed: true,
        selector,
        text_length: text.length
      };
    });

    // Press key(s)
    this.register('press_key', async (params) => {
      const { key, selector, timeout = 10000 } = params;
      if (!key) throw new Error('Key required');
      
      let element = document.activeElement;
      
      if (selector) {
        element = await waitForElement(selector, timeout);
        element.focus();
      }
      
      const keyEvent = new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(keyEvent);
      await sleep(200);
      
      return {
        key_pressed: key,
        selector
      };
    });

    // Scroll
    this.register('scroll', async (params) => {
      const { direction = 'down', amount, smooth = true } = params;
      
      let scrollAmount = amount || 500;
      if (direction === 'up') scrollAmount = -Math.abs(scrollAmount);
      
      window.scrollBy({
        top: scrollAmount,
        behavior: smooth ? 'smooth' : 'auto'
      });
      
      await sleep(smooth ? 500 : 200);
      
      return {
        scrolled: true,
        direction,
        amount: scrollAmount,
        scroll_y: window.scrollY
      };
    });

    // Scroll to element
    this.register('scroll_to_element', async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) throw new Error('Selector required');
      
      const element = await waitForElement(selector, timeout);
      highlightElement(element);
      
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      await sleep(500);
      
      return {
        scrolled_to: true,
        selector
      };
    });

    // Hover over element
    this.register('hover', async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) throw new Error('Selector required');
      
      const element = await waitForElement(selector, timeout);
      
      const event = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      element.dispatchEvent(event);
      highlightElement(element);
      await sleep(500);
      
      return {
        hovered: true,
        selector
      };
    });
  }

  /**
   * Extraction tools (get data from page)
   */
  registerExtractionTools() {
    // Get page content
    this.register('get_page_content', async () => {
      return {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText?.substring(0, 5000),
        html_length: document.documentElement.innerHTML.length
      };
    });

    // Extract text from element
    this.register('extract_text', async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) throw new Error('Selector required');
      
      const element = await waitForElement(selector, timeout);
      highlightElement(element);
      await sleep(300);
      
      return {
        text: element.textContent || element.innerText || '',
        selector
      };
    });

    // Extract attribute
    this.register('extract_attribute', async (params) => {
      const { selector, attribute, timeout = 10000 } = params;
      if (!selector || !attribute) {
        throw new Error('Selector and attribute required');
      }
      
      const element = await waitForElement(selector, timeout);
      const value = element.getAttribute(attribute);
      
      return {
        attribute,
        value,
        selector
      };
    });

    // Get all links
    this.register('get_links', async () => {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: a.textContent?.trim().substring(0, 100),
          href: a.href,
          title: a.title
        }))
        .filter(link => link.text || link.title)
        .slice(0, 50); // Limit to 50 links
      
      return {
        count: links.length,
        links
      };
    });

    // Get form fields
    this.register('get_form_fields', async (params) => {
      const { formSelector } = params;
      
      let form = formSelector 
        ? await waitForElement(formSelector, 5000)
        : document.querySelector('form');
      
      if (!form) {
        throw new Error('No form found');
      }
      
      const fields = Array.from(form.querySelectorAll('input, select, textarea'))
        .map(field => ({
          type: field.type || field.tagName.toLowerCase(),
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          required: field.required
        }));
      
      return {
        field_count: fields.length,
        fields
      };
    });

    // Take screenshot (delegate to background script)
    this.register('screenshot', async (params) => {
      try {
        console.log('📸 Requesting screenshot from background...');
        
        // Send message to background script to capture
        const response = await chrome.runtime.sendMessage({
          type: 'capture_screenshot',
          params: params || {}
        });
        
        console.log('📸 Screenshot response:', response.success ? 'Success' : 'Failed');
        
        if (!response.success) {
          throw new Error(response.error || 'Screenshot capture failed');
        }
        
        return response;
      } catch (error) {
        console.error('❌ Screenshot tool error:', error);
        throw error;
      }
    });

    // Get interactive elements
    this.register('get_interactive_elements', async () => {
      const selectors = 'button, a, input, select, textarea, [role="button"], [onclick]';
      const elements = Array.from(document.querySelectorAll(selectors))
        .filter(el => {
          // Filter visible elements
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .slice(0, 30) // Limit to 30 elements
        .map((el, index) => ({
          index,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          text: (el.textContent || el.value || '').trim().substring(0, 50),
          id: el.id,
          classes: Array.from(el.classList).join(' '),
          placeholder: el.placeholder
        }));
      
      return {
        count: elements.length,
        elements
      };
    });
  }

  /**
   * Utility tools
   */
  registerUtilityTools() {
    // Wait for element
    this.register('wait_for_element', async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) throw new Error('Selector required');
      
      const element = await waitForElement(selector, timeout);
      
      return {
        found: true,
        selector,
        element_visible: element.offsetParent !== null
      };
    });

    // Wait for timeout
    this.register('wait', async (params) => {
      const { duration = 1000 } = params;
      await sleep(duration);
      
      return {
        waited_ms: duration
      };
    });

    // Execute JavaScript
    this.register('execute_javascript', async (params) => {
      const { code } = params;
      if (!code) throw new Error('Code required');
      
      try {
        // Create function and execute
        const func = new Function(code);
        const result = func();
        
        return {
          executed: true,
          result: JSON.stringify(result)
        };
      } catch (error) {
        throw new Error(`JavaScript execution failed: ${error.message}`);
      }
    });

    // Get current URL and metadata
    this.register('get_page_info', async () => {
      return {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scroll_x: window.scrollX,
          scroll_y: window.scrollY
        },
        document: {
          ready_state: document.readyState,
          content_type: document.contentType
        }
      };
    });
  }
}

// Helper functions (import from content.js utilities)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForElement(selector, timeout = 10000) {
  const startTime = Date.now();
  
  // Try to find element immediately
  let element = findElement(selector);
  if (element) return element;
  
  // Wait for element to appear
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      element = findElement(selector);
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
    
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector} (timeout ${timeout}ms)`));
    }, timeout);
  });
}

function findElement(selector) {
  // Try text selector first (text=Login)
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

function findElementByText(text) {
  const xpath = `//*[contains(text(), "${text}")]`;
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue;
}

function highlightElement(element) {
  const original = {
    outline: element.style.outline,
    backgroundColor: element.style.backgroundColor
  };
  
  element.style.outline = '3px solid #ff6b35';
  element.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
  
  setTimeout(() => {
    element.style.outline = original.outline;
    element.style.backgroundColor = original.backgroundColor;
  }, 1000);
}

// Export singleton instance
const toolRegistry = new ToolRegistry();

// Make available globally
if (typeof window !== 'undefined') {
  window.toolRegistry = toolRegistry;
}
