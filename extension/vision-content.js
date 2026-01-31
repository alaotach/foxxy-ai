// Vision-based content script - HYBRID: Uses both vision screenshots AND DOM snapshots
// NOW INTEGRATED WITH: Tool Registry (toolRegistry), WebSocket Manager (wsManager), Protocol
// - Old vision automation: Uses captureScreenshot() and DOM snapshots
// - New tool registry: Available as window.toolRegistry with 30+ tools
// - Both systems work together seamlessly!

// Prevent double injection
if (window.foxyAIContentScriptLoaded) {
  console.log('⚠️ Foxy AI content script already loaded, skipping');
} else {
  window.foxyAIContentScriptLoaded = true;
  
  (function() {
    'use strict';
    
    console.log('🦊 Foxy AI Hybrid Vision+DOM content script loaded');
    console.log('✨ Integrated with Tool Registry and WebSocket Manager');

const BACKEND_URL = 'http://localhost:8000';

const SCREENSHOT_OVERLAY_KEY = 'foxyShowScreenshots';
const SCREENSHOT_OVERLAY_MAX_WIDTH = 260;

// Automation visual indicator
let automationOverlay = null;
let shaderAnimationFrame = null;

function showAutomationAura() {
  if (automationOverlay) return;
  
  automationOverlay = document.createElement('div');
  automationOverlay.id = 'foxy-ai-root';
  
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
        background-color: #ffaa00;
        border-radius: 2px;
        box-shadow: 0 0 10px #ffaa00;
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
  
  automationOverlay.appendChild(canvas);
  automationOverlay.appendChild(statusDiv);
  document.documentElement.appendChild(automationOverlay);
  
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
      
      // Orange color palette (#FF8C00, #FFA500, #FFB900)
      vec3 color1 = vec3(1.0, 0.549, 0.0);  // #FF8C00
      vec3 color2 = vec3(1.0, 0.647, 0.0);  // #FFA500
      vec3 color3 = vec3(1.0, 0.725, 0.0);  // #FFB900
      
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

function getShowScreenshotOverlay() {
  const stored = localStorage.getItem(SCREENSHOT_OVERLAY_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

function setShowScreenshotOverlay(enabled) {
  localStorage.setItem(SCREENSHOT_OVERLAY_KEY, enabled ? 'true' : 'false');
}

function ensureScreenshotOverlayContainer() {
  let container = document.getElementById('foxy-screenshot-overlay');
  if (container) return container;

  container = document.createElement('div');
  container.id = 'foxy-screenshot-overlay';
  container.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: ${SCREENSHOT_OVERLAY_MAX_WIDTH + 20}px;
    max-height: 70vh;
    overflow: auto;
    z-index: 999999;
    background: rgba(15, 15, 15, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    backdrop-filter: blur(6px);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #e5e7eb;
    font-size: 12px;
    font-weight: 600;
  `;
  header.textContent = 'Foxy Screenshots';

  const toggle = document.createElement('button');
  toggle.textContent = 'Hide';
  toggle.style.cssText = `
    background: #1f2937;
    color: #e5e7eb;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
  `;
  toggle.addEventListener('click', () => {
    setShowScreenshotOverlay(false);
    container.remove();
  });

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
  headerRow.appendChild(header);
  headerRow.appendChild(toggle);

  container.appendChild(headerRow);
  document.body.appendChild(container);
  return container;
}

function showScreenshotOverlay(base64Screenshot) {
  if (!getShowScreenshotOverlay()) return;

  const container = ensureScreenshotOverlayContainer();
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'background:#111827;border:1px solid #1f2937;border-radius:8px;padding:6px;';

  const img = document.createElement('img');
  img.src = `data:image/png;base64,${base64Screenshot}`;
  img.style.cssText = `
    width: ${SCREENSHOT_OVERLAY_MAX_WIDTH}px;
    height: auto;
    display: block;
    border-radius: 6px;
  `;

  const timestamp = document.createElement('div');
  timestamp.style.cssText = 'color:#9ca3af;font-size:10px;margin-top:4px;';
  timestamp.textContent = new Date().toLocaleTimeString();

  wrapper.appendChild(img);
  wrapper.appendChild(timestamp);
  container.appendChild(wrapper);
}

// Capture screenshot of visible viewport
async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
      if (response && response.screenshot) {
        const base64 = response.screenshot.split(',')[1];
        showScreenshotOverlay(base64);
        resolve(base64); // Return base64 only
      } else {
        resolve(null);
      }
    });
  });
}

// Capture DOM snapshot with ALL clickable elements and their exact positions
function captureDOMSnapshot() {
  const clickableSelectors = [
    // Standard interactive elements
    'button', 'a', '[role="button"]', '[role="link"]', 
    'input', 'textarea', 'select',
    // Custom buttons and clickables
    '[onclick]', '[class*="button"]', '[class*="btn"]',
    // Cards and templates (Canva-specific)
    '[class*="card"]', '[class*="template"]', '[class*="tile"]',
    '[class*="Card"]', '[class*="Template"]', '[class*="Tile"]',
    '[data-template]', '[data-design]', 'article',
    // Test IDs and accessibility
    '[data-testid]', '[aria-label]', 'img[alt]',
    // Editable content
    '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
    'div[role="textbox"]', '[role="combobox"]', '[role="searchbox"]',
    // Divs that might be clickable
    'div[tabindex]', 'span[tabindex]', '[role="presentation"]'
  ];
  
  const elements = [];
  const selector = clickableSelectors.join(', ');
  const domElements = document.querySelectorAll(selector);
  
  domElements.forEach((el, index) => {
    // Only include visible elements (not display:none or visibility:hidden)
    if (el.offsetParent === null || el.offsetWidth === 0 || el.offsetHeight === 0) return;
    
    const rect = el.getBoundingClientRect();
    
    // Include elements in viewport AND near-viewport (within 2000px buffer for lazy loading)
    // This captures Canva template cards and other dynamically loaded content
    const bufferZone = 2000;
    if (rect.top > window.innerHeight + bufferZone || rect.bottom < -bufferZone || 
        rect.left > window.innerWidth + bufferZone || rect.right < -bufferZone) return;
    
    const isInput = el.tagName.toLowerCase() === 'input' || 
                    el.tagName.toLowerCase() === 'textarea' ||
                    el.getAttribute('contenteditable') === 'true' ||
                    el.getAttribute('role') === 'textbox';
    
    elements.push({
      index: index,
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      text: el.textContent?.trim().substring(0, 100) || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      alt: el.getAttribute('alt') || '',
      className: el.className?.toString().substring(0, 100) || '',
      id: el.id || '',
      href: el.href || '',
      contentEditable: el.getAttribute('contenteditable') || 'false',
      isInput: isInput,
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.left + rect.width / 2),
        centerY: Math.round(rect.top + rect.height / 2)
      }
    });
  });
  
  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    },
    url: window.location.href,
    title: document.title,
    elements: elements
  };
}

// Execute a single automation step using HYBRID vision+DOM
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
    console.log(`⚡ Executing (hybrid): ${step.type}`, step);

    switch (step.type) {
      case 'navigate':
        if (step.url) {
          // Navigation causes page unload, so we need to respond immediately
          result.success = true;
          result.observations.current_url = step.url;
          result.observations.navigating = true;
          // Return early before navigation to ensure response is sent
          result.duration_ms = Date.now() - startTime;
          // Schedule navigation after a small delay to let response send
          setTimeout(() => {
            window.location.href = step.url;
          }, 100);
          return result; // Return immediately
        } else {
          throw new Error('No URL provided for navigation');
        }
        break;

      case 'click':
      case 'vision_click':
      case 'right_click':
        // HYBRID APPROACH: Capture BOTH screenshot and DOM simultaneously
        const description = step.description || step.selector || 'the element to click';
        const isRightClick = step.type === 'right_click';
        
        const [screenshot, domSnapshot] = await Promise.all([
          captureScreenshot(),
          Promise.resolve(captureDOMSnapshot())
        ]);
        
        if (!screenshot) {
          throw new Error('Failed to capture screenshot');
        }
        
        console.log(`🔍 Hybrid analysis: Vision + DOM (${domSnapshot.elements.length} elements)`);
        
        // Send BOTH to backend for intelligent hybrid matching
        const clickData = await chrome.runtime.sendMessage({
          action: 'visionFindElement',
          data: {
            screenshot: screenshot,
            description: description,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            dom_snapshot: domSnapshot  // Include full DOM data
          }
        });
        
        if (clickData.error) {
          throw new Error(`Hybrid API error: ${clickData.error}`);
        }
        
        if (clickData.success && clickData.x && clickData.y) {
          // Hybrid found the element with high precision
          console.log(`✅ Hybrid match: (${clickData.x}, ${clickData.y}) via ${clickData.method}`);
          if (isRightClick) {
            await rightClickAtCoordinates(clickData.x, clickData.y);
            result.observations.right_clicked_at = { x: clickData.x, y: clickData.y };
          } else {
            await clickAtCoordinates(clickData.x, clickData.y);
            result.observations.clicked_at = { x: clickData.x, y: clickData.y };
          }
          result.observations.method = clickData.method || 'hybrid';
          result.observations.confidence = clickData.confidence || 'unknown';
          result.observations.element = clickData.element_info || null;
        } else {
          // Pure DOM fallback as last resort
          console.log('⚠️ Hybrid failed, trying pure DOM fallback...');
          const domSuccess = tryDOMClick(description, isRightClick);
          if (domSuccess) {
            result.observations.fallback = 'dom_heuristic';
          } else {
            throw new Error(`Element not found: ${description}`);
          }
        }
        break;

      case 'type':
        // Type with aggressive input field detection
        const textToType = step.text || '';
        
        // Check if this is a simple "type into focused element" action (no selector/description)
        const hasDescription = step.description || step.selector;
        let activeEl = document.activeElement;
        
        console.log('🔍 Type action - hasDescription:', hasDescription, 'activeElement:', activeEl?.tagName);
        console.log('🔍 Text to type:', textToType.substring(0, 50) + '...');
        
        // Strategy 0: If no description and element is already focused, just type directly
        // Check main document first, then check iframes (for Google Docs)
        let isContentEditable = false;
        let targetDoc = document;
        
        console.log('🔍 Checking main document activeElement:', activeEl?.tagName, 'isContentEditable:', activeEl?.isContentEditable);
        
        if (!hasDescription) {
          // Check if main document has focused editable element
          if (activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable ||
            activeEl.getAttribute('contenteditable') === 'true'
          )) {
            isContentEditable = true;
            console.log('✅ Found focused editable element in main document');
          } 
          // Check iframes (Google Docs uses iframes)
          else if (activeEl && activeEl.tagName === 'IFRAME') {
            console.log('🔍 ActiveElement is IFRAME, checking inside...');
            try {
              const iframeDoc = activeEl.contentDocument || activeEl.contentWindow?.document;
              if (iframeDoc) {
                const iframeActive = iframeDoc.activeElement;
                console.log('🔍 Checking iframe activeElement:', iframeActive?.tagName);
                if (iframeActive && (
                  iframeActive.tagName === 'INPUT' ||
                  iframeActive.tagName === 'TEXTAREA' ||
                  iframeActive.isContentEditable ||
                  iframeActive.getAttribute('contenteditable') === 'true' ||
                  iframeActive.tagName === 'BODY' // Google Docs canvas
                )) {
                  activeEl = iframeActive;
                  targetDoc = iframeDoc;
                  isContentEditable = true;
                  console.log('✅ Found focused editable element in iframe');
                }
              }
            } catch (e) {
              console.log('⚠️ Cannot access iframe (cross-origin):', e.message);
            }
          }
          // Try to find Google Docs canvas directly
          else {
            console.log('🔍 Searching for contenteditable iframes...');
            const iframes = document.querySelectorAll('iframe');
            console.log('🔍 Found', iframes.length, 'iframes');
            for (const iframe of iframes) {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  const body = iframeDoc.body;
                  if (body && (body.isContentEditable || body.getAttribute('contenteditable') === 'true')) {
                    activeEl = body;
                    targetDoc = iframeDoc;
                    isContentEditable = true;
                    console.log('✅ Found contenteditable body in iframe (Google Docs)');
                    break;
                  }
                }
              } catch (e) {
                // Cross-origin iframe, skip
              }
            }
          }
        }
        
        if (!hasDescription && isContentEditable && activeEl) {
          console.log('✅ Typing directly into focused element:', activeEl.tagName);
          
          // For contenteditable (Google Docs, etc.), use execCommand for better compatibility
          if (activeEl.isContentEditable || activeEl.getAttribute('contenteditable') === 'true') {
            console.log('📝 Using execCommand for contenteditable element');
            
            // Type the whole text at once using execCommand (most reliable for Google Docs)
            targetDoc.execCommand('insertText', false, textToType);
            
            // Trigger input event for React-based editors
            activeEl.dispatchEvent(new InputEvent('input', { 
              data: textToType, 
              inputType: 'insertText',
              bubbles: true 
            }));
            
          } else {
            // For regular inputs/textareas, type character by character
            for (const char of textToType) {
              activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
              activeEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
              
              activeEl.value += char;
              
              activeEl.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
              activeEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
              
              await sleep(20);
            }
          }
          
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
          result.observations.typed_text = textToType;
          result.observations.input_field = activeEl.tagName;
          break;
        }
        
        // Strategy 1: Try to find input via hybrid vision+DOM (when description provided)
        const [typeScreenshot, typeDOMSnapshot] = await Promise.all([
          captureScreenshot(),
          Promise.resolve(captureDOMSnapshot())
        ]);
        
        if (!typeScreenshot) {
          throw new Error('Failed to capture screenshot');
        }
        
        // Filter DOM to only input elements
        const inputElements = typeDOMSnapshot.elements.filter(e => e.isInput);
        console.log(`📝 Found ${inputElements.length} input elements in DOM`);
        
        let typed = false;
        
        // Try hybrid first
        if (inputElements.length > 0) {
          const typeData = await chrome.runtime.sendMessage({
            action: 'visionFindElement',
            data: {
              screenshot: typeScreenshot,
              description: step.description || step.selector || 'input field or text box',
              viewport_width: window.innerWidth,
              viewport_height: window.innerHeight,
              dom_snapshot: { ...typeDOMSnapshot, elements: inputElements } // Only send input elements
            }
          });
          
          if (typeData.success && typeData.x && typeData.y) {
            // Click to focus
            await clickAtCoordinates(typeData.x, typeData.y);
            await sleep(500);
            typed = true;
          }
        }
        
        // Strategy 2: Pure DOM fallback - find first visible input
        if (!typed && inputElements.length > 0) {
          console.log('⚠️ Hybrid failed, trying direct DOM input detection...');
          const firstInput = inputElements[0];
          const inputEl = document.elementFromPoint(firstInput.rect.centerX, firstInput.rect.centerY);
          if (inputEl) {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);
            // Use coordinate click instead of element.click()
            await clickAtCoordinates(firstInput.rect.centerX, firstInput.rect.centerY);
            await sleep(300);
            typed = true;
          }
        }
        
        // Strategy 3: Search by placeholder/aria-label
        if (!typed) {
          console.log('⚠️ Trying placeholder/label search...');
          const desc = (step.description || '').toLowerCase();
          const matchingInput = inputElements.find(e => {
            const placeholder = (e.placeholder || '').toLowerCase();
            const label = (e.ariaLabel || '').toLowerCase();
            return placeholder.includes(desc) || label.includes(desc) || 
                   desc.includes(placeholder) || desc.includes(label);
          });
          
          if (matchingInput) {
            const el = document.elementFromPoint(matchingInput.rect.centerX, matchingInput.rect.centerY);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await sleep(300);
              // Use coordinate click instead of element.click()
              await clickAtCoordinates(matchingInput.rect.centerX, matchingInput.rect.centerY);
              await sleep(300);
              typed = true;
            }
          }
        }
        
        if (!typed) {
          console.log('⚠️ No input field found via vision/DOM, checking for contenteditable...');
          // Last resort: check for any contenteditable element
          const editables = document.querySelectorAll('[contenteditable="true"]');
          console.log('🔍 Found', editables.length, 'contenteditable elements in main doc');
          
          // Also check iframes
          const iframes = document.querySelectorAll('iframe');
          let foundEditable = false;
          for (const iframe of iframes) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                const iframeEditables = iframeDoc.querySelectorAll('[contenteditable="true"]');
                console.log('🔍 Found', iframeEditables.length, 'contenteditable elements in iframe');
                if (iframeEditables.length > 0 || (iframeDoc.body && iframeDoc.body.isContentEditable)) {
                  activeEl = iframeDoc.body.isContentEditable ? iframeDoc.body : iframeEditables[0];
                  targetDoc = iframeDoc;
                  foundEditable = true;
                  console.log('✅ Using contenteditable from iframe');
                  break;
                }
              }
            } catch (e) {
              // Cross-origin, skip
            }
          }
          
          if (!foundEditable && editables.length === 0) {
            throw new Error('No input field found to type into');
          }
          
          if (!foundEditable) {
            activeEl = editables[0];
          }
        }
        
        // Type the text - use appropriate method based on element type
        console.log('📝 Final typing into:', activeEl?.tagName, 'isContentEditable:', activeEl?.isContentEditable);
        
        if (!activeEl) {
          activeEl = targetDoc.activeElement;
          console.log('📝 Using targetDoc.activeElement:', activeEl?.tagName);
        }
        
        if (activeEl) {
          // For contenteditable elements (Google Docs, etc.), use execCommand
          if (activeEl.isContentEditable || activeEl.getAttribute('contenteditable') === 'true') {
            console.log('✅ Using execCommand for contenteditable');
            
            // Focus the element first
            activeEl.focus();
            await sleep(100);
            
            // Use execCommand which works for contenteditable
            const success = targetDoc.execCommand('insertText', false, textToType);
            console.log('📝 execCommand result:', success);
            
            if (!success) {
              // Fallback: simulate typing events
              console.log('⚠️ execCommand failed, using event simulation');
              for (const char of textToType) {
                const keyEvent = new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true });
                activeEl.dispatchEvent(keyEvent);
                targetDoc.execCommand('insertText', false, char);
                await sleep(10);
              }
            }
            
            activeEl.dispatchEvent(new InputEvent('input', { 
              data: textToType, 
              inputType: 'insertText',
              bubbles: true 
            }));
            
          } else {
            // For regular input/textarea elements
            console.log('✅ Using value setter for input/textarea');
            
            // Clear existing content
            if (activeEl.value !== undefined) {
              activeEl.value = '';
            }
            
            // Type character by character for better reliability
            for (const char of textToType) {
              activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
              activeEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
              
              activeEl.value += char;
              
              activeEl.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
              activeEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
              
              await sleep(20);
            }
            
            // Trigger change event
            activeEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        
        result.observations.typed_text = textToType;
        result.observations.input_field = activeEl?.tagName || 'unknown';
        break;

      case 'scroll':
        const scrollAmount = step.amount || 500;
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        await sleep(500);
        result.observations.scrolled = scrollAmount;
        break;

      case 'wait':
        await sleep(step.timeout || 2000);
        break;

      case 'screenshot':
        const screenshotData = await captureScreenshot();
        result.observations.screenshot = screenshotData;
        break;

      case 'extract_text':
        const extractScreenshot = await captureScreenshot();
        
        const extractData = await chrome.runtime.sendMessage({
          action: 'visionAnalyze',
          data: {
            screenshot: extractScreenshot,
            question: `Extract the text from: ${step.description || step.selector || 'the visible content'}`
          }
        });
        
        if (extractData.error) {
          throw new Error(`Vision API error: ${extractData.error}`);
        }
        
        result.observations.extracted_text = extractData.answer;
        break;

      case 'download_image':
        // Find and download the largest visible image
        const images = Array.from(document.querySelectorAll('img'));
        const visibleImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100 && 
                 img.offsetParent !== null &&
                 rect.top < window.innerHeight && rect.bottom > 0;
        });
        
        if (visibleImages.length === 0) {
          throw new Error('No large images found on page');
        }
        
        // Sort by size and get the largest
        visibleImages.sort((a, b) => {
          const aSize = a.naturalWidth * a.naturalHeight;
          const bSize = b.naturalWidth * b.naturalHeight;
          return bSize - aSize;
        });
        
        const targetImage = visibleImages[0];
        const imageUrl = targetImage.src || targetImage.currentSrc;
        
        console.log(`📥 Attempting to download: ${imageUrl}`);
        console.log(`📐 Image size: ${targetImage.naturalWidth}x${targetImage.naturalHeight}`);
        
        // Trigger download via background script
        const downloadResult = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'downloadFile',
            url: imageUrl,
            filename: step.filename || 'downloaded_image.jpg'
          }, (response) => {
            resolve(response);
          });
        });
        
        if (downloadResult && downloadResult.success) {
          console.log('✅ Download started successfully');
          result.observations.downloaded_image = imageUrl;
          result.observations.image_size = `${targetImage.naturalWidth}x${targetImage.naturalHeight}`;
          result.observations.download_id = downloadResult.downloadId;
        } else {
          const error = downloadResult?.error || 'Download failed';
          console.error('❌ Download error:', error);
          throw new Error(`Download failed: ${error}`);
        }
        
        await sleep(1000); // Wait for download to start
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    result.success = true;
    console.log(`✅ Success (hybrid): ${step.type}`);

  } catch (error) {
    result.success = false;
    result.error = error.message;
    console.error(`❌ Failed (hybrid): ${step.type}`, error);
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

// Click at specific coordinates with visual feedback
async function clickAtCoordinates(x, y) {
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
  
  // PURE COORDINATE CLICKING - Create real mouse events at exact coordinates
  console.log(`🎯 Clicking at EXACT coordinates (${x}, ${y})`);
  
  // Create sequence of mouse events for realistic clicking
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
  
  // Find element at coordinates and dispatch events
  const element = document.elementFromPoint(x, y);
  if (element) {
    console.log(`🎯 Element at (${x},${y}):`, element.tagName, element.className);
    element.dispatchEvent(mousedownEvent);
    await sleep(50);
    element.dispatchEvent(mouseupEvent);
    await sleep(50);
    element.dispatchEvent(clickEvent);
  } else {
    console.warn('⚠️ No element found at coordinates, dispatching to document');
    document.dispatchEvent(mousedownEvent);
    document.dispatchEvent(mouseupEvent);
    document.dispatchEvent(clickEvent);
  }
  
  setTimeout(() => {
    marker.remove();
    style.remove();
  }, 500);
  
  await sleep(300);
}

// Right-click at coordinates to open context menu
async function rightClickAtCoordinates(x, y) {
  const marker = document.createElement('div');
  marker.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 20px;
    height: 20px;
    border: 3px solid #3b82f6;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.2);
    z-index: 999999;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: pulse 0.5s ease-out;
  `;
  
  document.body.appendChild(marker);
  
  // PURE COORDINATE RIGHT-CLICKING
  console.log(`🖱️ Right-clicking at EXACT coordinates (${x}, ${y})`);
  
  const contextMenuEvent = new MouseEvent('contextmenu', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 2
  });
  
  const element = document.elementFromPoint(x, y);
  if (element) {
    console.log(`🎯 Right-click element at (${x},${y}):`, element.tagName, element.className);
    element.dispatchEvent(contextMenuEvent);
  } else {
    document.dispatchEvent(contextMenuEvent);
  }
  
  setTimeout(() => marker.remove(), 500);
  await sleep(500);
}

// DOM fallback for when hybrid vision fails
function tryDOMClick(description, isRightClick = false) {
  const desc = description.toLowerCase();
  let element = null;
  
  // Button patterns
  if (desc.includes('button') || desc.includes('click')) {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn, a.button'));
    element = buttons.find(btn => {
      const text = btn.textContent.toLowerCase();
      return desc.split(' ').some(word => word.length > 3 && text.includes(word));
    });
  }
  
  // Template/card patterns
  if (!element && (desc.includes('template') || desc.includes('card') || desc.includes('tile'))) {
    const cards = Array.from(document.querySelectorAll('[class*="template"], [class*="card"], [class*="tile"], [data-test*="template"]'));
    element = cards.find(card => card.offsetParent !== null);
  }
  
  // Search/input patterns
  if (!element && (desc.includes('search') || desc.includes('input'))) {
    element = document.querySelector('input[type="search"], input[placeholder*="search" i], [role="searchbox"]');
  }
  
  // Link patterns
  if (!element && desc.includes('link')) {
    const links = Array.from(document.querySelectorAll('a'));
    element = links.find(link => {
      const text = link.textContent.toLowerCase();
      return desc.split(' ').some(word => word.length > 3 && text.includes(word));
    });
  }
  
  if (element && element.offsetParent !== null) {
    console.log('✅ DOM fallback found:', element);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      if (isRightClick) {
        const event = new MouseEvent('contextmenu', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        element.dispatchEvent(event);
      } else {
        // Use MouseEvent with coordinates instead of element.click()
        const mouseOpts = {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        };
        element.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        element.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        element.dispatchEvent(new MouseEvent('click', mouseOpts));
      }
    }, 300);
    return true;
  }
  
  return false;
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

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeStep') {
    executeStepVision(message.step).then(sendResponse);
    return true; // Keep channel open for async
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
  }
  
  return false;
});

})(); // End IIFE
} // End double injection guard

})(); // End IIFE
} // End double injection guard

})(); // End IIFE
} // End double injection guard
