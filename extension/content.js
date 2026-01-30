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

// Automation visual indicator
let automationOverlay = null;
let shaderAnimationFrame = null;

function showAutomationAura() {
  if (window.automationOverlay) return;

  window.automationOverlay = document.createElement('div');
  window.automationOverlay.id = 'foxy-ai-root';
  
  // Create canvas for shader animation
  const canvas = document.createElement('canvas');
  canvas.id = 'foxy-ai-automation-aura';
  canvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  
  // Create status pill
  const statusDiv = document.createElement('div');
  statusDiv.id = 'foxy-ai-status';
  statusDiv.innerHTML = `
    <style>
      #foxy-ai-status {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483648;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 24px;
        border-radius: 50px;
        background: rgba(15, 15, 15, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 165, 0, 0.25);
        box-shadow: 
          0 10px 25px rgba(0, 0, 0, 0.6),
          0 0 15px rgba(255, 140, 0, 0.15);
        color: rgba(255, 255, 255, 0.9);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
      .foxy-icon {
        width: 8px;
        height: 8px;
        background-color: #ed4a14;
        border-radius: 2px;
        box-shadow: 0 0 10px #ed4a14;
        animation: foxy-blink 1.5s infinite ease-in-out;
      }
      @keyframes foxy-blink {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
    </style>
    <div class="foxy-icon"></div>
    <span>Working...</span>
  `;
  
  window.automationOverlay.appendChild(canvas);
  window.automationOverlay.appendChild(statusDiv);
  document.documentElement.appendChild(window.automationOverlay);
  
  // Initialize WebGL shader animation
  initShaderAnimation(canvas);
  
  console.log('🎨 WebGL shader aura activated!');
}

function initShaderAnimation(canvas) {
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not supported, falling back to CSS');
    return;
  }
  
  // Resize canvas to window size
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);
  
  // Vertex shader - just passes through positions
  const vertexShaderSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  
  // Fragment shader - creates wavy, pulsating orange glow
  const fragmentShaderSource = `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      vec2 center = vec2(0.5, 0.5);
      
      // Distance from center (for radial gradient)
      float dist = distance(uv, center);
      
      // Distance from edges
      float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      
      // Wavy animation along edges
      float wave1 = sin(uv.x * 20.0 + time * 2.0) * 0.02;
      float wave2 = sin(uv.y * 15.0 - time * 1.5) * 0.02;
      float wave3 = sin((uv.x + uv.y) * 10.0 + time * 3.0) * 0.015;
      float wavyEdge = edgeDist + wave1 + wave2 + wave3;
      
      // Pulsating intensity (0.75 to 1.0 - never goes below 75%)
      float pulse = 0.75 + 0.25 * sin(time * 2.0);
      
      // Moving gradient flow
      float flow = sin(uv.x * 3.0 + uv.y * 2.0 + time * 1.2) * 0.5 + 0.5;
      
      // Edge glow (stronger near edges)
      float edgeGlow = smoothstep(0.2, 0.0, wavyEdge) * pulse;
      
      // Corner glows
      vec2 cornerTL = uv;
      vec2 cornerTR = vec2(1.0 - uv.x, uv.y);
      vec2 cornerBL = vec2(uv.x, 1.0 - uv.y);
      vec2 cornerBR = vec2(1.0 - uv.x, 1.0 - uv.y);
      
      float cornerGlow = 0.0;
      cornerGlow += smoothstep(0.3, 0.0, length(cornerTL)) * 0.6;
      cornerGlow += smoothstep(0.3, 0.0, length(cornerTR)) * 0.6;
      cornerGlow += smoothstep(0.3, 0.0, length(cornerBL)) * 0.6;
      cornerGlow += smoothstep(0.3, 0.0, length(cornerBR)) * 0.6;
      cornerGlow *= pulse;
      
      // Radial vignette (darker center, glowing edges)
      float vignette = smoothstep(0.3, 1.0, dist) * 0.4;
      
      // Combine all effects with minimum floor
      float intensity = max(0.3, edgeGlow + cornerGlow + vignette * flow);
      
      // #ED4A14 - The Core (Rich Cinnabar)
      vec3 color1 = vec3(0.929, 0.290, 0.078); 

      // #F25A1B - Mid Glow (Minor step up)
      vec3 color2 = vec3(0.949, 0.353, 0.106); 

      // #F76B22 - Outer Flare (Slightly brighter)
      vec3 color3 = vec3(0.968, 0.419, 0.133);
      
      // Mix colors based on flow
      vec3 orangeColor = mix(color1, color2, flow);
      orangeColor = mix(orangeColor, color3, sin(time * 0.8) * 0.5 + 0.5);
      
      // Final color with alpha (never below 30% * 0.7 = 21% opacity)
      gl_FragColor = vec4(orangeColor, intensity * 0.7);
    }
  `;
  
  // Compile shaders
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  
  // Create program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);
  
  // Create fullscreen quad
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]);
  
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  
  const positionLocation = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  
  // Get uniform locations
  const timeLocation = gl.getUniformLocation(program, 'time');
  const resolutionLocation = gl.getUniformLocation(program, 'resolution');
  
  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  
  // Animation loop
  const startTime = Date.now();
  function animate() {
    const time = (Date.now() - startTime) / 1000.0;
    
    gl.uniform1f(timeLocation, time);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    shaderAnimationFrame = requestAnimationFrame(animate);
  }
  animate();
}

function hideAutomationAura() {
  if (shaderAnimationFrame) {
    cancelAnimationFrame(shaderAnimationFrame);
    shaderAnimationFrame = null;
  }
  if (automationOverlay) {
    automationOverlay.remove();
    automationOverlay = null;
    console.log('🎨 Automation aura removed');
  }
}

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
  showAutomationAura(); // Show orange aura when automation starts
  console.log('🎨 Showing automation aura');
  
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
      
      const visionInputElement = document.elementFromPoint(typeCenterX, typeCenterY);
      if (!visionInputElement) throw new Error('No input element found at coordinates');
      
      highlightElement(visionInputElement);
      await sleep(200);
      
      visionInputElement.focus();
      
      if (visionInputElement.tagName === 'INPUT' || visionInputElement.tagName === 'TEXTAREA') {
        if (step.clear !== false) {
          visionInputElement.value = '';
        }
        
        if (step.simulate_typing) {
          for (const char of step.text) {
            visionInputElement.value += char;
            visionInputElement.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(50);
          }
        } else {
          visionInputElement.value = step.text;
          visionInputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        visionInputElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        visionInputElement.textContent = step.text;
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
      .then((result) => {
        // Keep aura showing during automation - don't hide after each step
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'startAutomation') {
    showAutomationAura();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'stopAutomation') {
    hideAutomationAura();
    sendResponse({ success: true });
    return true;
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
