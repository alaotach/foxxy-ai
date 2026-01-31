"""
Browser Integration for DOM Threshold Monitoring
This module provides the bridge between the DOM monitoring system and browser extension
"""
import json
import asyncio
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
import websockets
import logging

class BrowserDOMMonitor:
    """
    Handles DOM parsing and monitoring for real browser integration
    Connects to browser extension via WebSocket for live DOM updates
    """
    
    def __init__(self):
        self.connected_browsers: Dict[str, Any] = {}
        self.logger = logging.getLogger("BrowserDOMMonitor")
        
    async def connect_to_browser(self, browser_id: str, websocket_url: str = "ws://localhost:9222"):
        """Connect to browser extension WebSocket"""
        try:
            websocket = await websockets.connect(websocket_url)
            self.connected_browsers[browser_id] = {
                "websocket": websocket,
                "connected_at": asyncio.get_event_loop().time()
            }
            self.logger.info(f"Connected to browser {browser_id}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to browser {browser_id}: {e}")
            return False
    
    async def get_live_dom(self, browser_id: str) -> Optional[str]:
        """Get current DOM HTML from connected browser"""
        if browser_id not in self.connected_browsers:
            return None
            
        try:
            websocket = self.connected_browsers[browser_id]["websocket"]
            
            # Request current DOM
            await websocket.send(json.dumps({
                "action": "getDom",
                "timestamp": asyncio.get_event_loop().time()
            }))
            
            response = await websocket.recv()
            data = json.loads(response)
            
            return data.get("html", "")
            
        except Exception as e:
            self.logger.error(f"Failed to get DOM from browser {browser_id}: {e}")
            return None
    
    async def parse_live_element(self, browser_id: str, css_selector: str) -> Dict[str, Any]:
        """
        Parse live DOM element for the specified CSS selector
        This replaces the placeholder _parse_dom_element method
        """
        try:
            # Get live DOM from browser
            html_content = await self.get_live_dom(browser_id)
            
            if not html_content:
                return {
                    "success": False,
                    "error": f"No DOM content from browser {browser_id}"
                }
            
            # Parse with BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            elements = soup.select(css_selector)
            
            if elements:
                element = elements[0]
                text_content = element.get_text().strip()
                
                # Extract numerical value from span content
                numerical_value = self._extract_numerical_value(text_content)
                
                return {
                    "success": True,
                    "value": numerical_value,
                    "text": text_content,
                    "element_count": len(elements),
                    "browser_id": browser_id,
                    "timestamp": asyncio.get_event_loop().time()
                }
            else:
                return {
                    "success": False,
                    "error": f"No elements found for selector: {css_selector}",
                    "browser_id": browser_id
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "browser_id": browser_id
            }
    
    def _extract_numerical_value(self, text: str) -> Optional[float]:
        """Extract numerical value from text (handles percentages, currency, etc.)"""
        import re
        try:
            # Remove common symbols and extract numbers
            cleaned = re.sub(r'[%$,€£¥\\s]', '', text)
            
            # Find first number (positive or negative) 
            match = re.search(r'-?\\d+(?:\\.\\d+)?', cleaned)
            if match:
                return float(match.group())
            return None
        except (ValueError, AttributeError):
            return None

# Updated SeekMode integration
class EnhancedSeekMode:
    """
    Enhanced SeekMode with real browser DOM integration
    """
    
    def __init__(self):
        from agent.seek_mode import SeekMode
        self.base_seek_mode = SeekMode()
        self.browser_monitor = BrowserDOMMonitor()
        self.logger = logging.getLogger("EnhancedSeekMode")
    
    async def _parse_dom_element(self, css_selector: str, task_id: str, browser_id: str = "default") -> Dict[str, Any]:
        """
        Enhanced DOM parsing with real browser integration
        Replaces the placeholder method in SeekMode
        """
        try:
            # Try to get live DOM first
            result = await self.browser_monitor.parse_live_element(browser_id, css_selector)
            
            if result.get("success"):
                self.logger.info(f"✅ Found element {css_selector}: {result.get('text')} = {result.get('value')}")
                return result
            else:
                self.logger.warning(f"❌ Element not found {css_selector}: {result.get('error')}")
                return result
                
        except Exception as e:
            self.logger.error(f"DOM parsing error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# Integration example for the trading interface
async def monitor_trading_interface():
    """
    Real-world example: Monitor trading interface for price changes
    """
    print("📈 Real Trading Interface Monitoring")
    print("=" * 50)
    
    enhanced_seek = EnhancedSeekMode()
    
    # Connect to browser (you'd replace this with actual browser connection)
    browser_connected = await enhanced_seek.browser_monitor.connect_to_browser(
        "trading_browser",
        "ws://localhost:9222"  # Chrome DevTools WebSocket
    )
    
    if not browser_connected:
        print("❌ Could not connect to browser - using simulation mode")
        # Fallback to simulation for demo
    else:
        print("✅ Connected to browser successfully")
    
    # Monitor the specific CSS class mentioned in the requirement
    css_selector = "._change_1dqlt_76._colorSell_1dqlt_8 span"
    
    print(f"🎯 Monitoring: {css_selector}")
    print("📊 Watching for price changes...")
    print()
    
    # Continuous monitoring loop
    threshold_configs = [
        {"threshold": 5.0, "operator": ">", "message": "🚀 Price UP > 5%!"},
        {"threshold": -3.0, "operator": "<", "message": "📉 Price DOWN < -3%!"},
    ]
    
    last_values = {}
    
    for i in range(10):  # Monitor for 10 iterations (demo)
        try:
            # Get current value from DOM
            result = await enhanced_seek.browser_monitor.parse_live_element(
                "trading_browser", 
                css_selector
            )
            
            if result.get("success"):
                current_value = result.get("value")
                text_content = result.get("text")
                
                print(f"📊 [{i+1}/10] Current: {current_value}% | Text: '{text_content}'")
                
                # Check thresholds
                for config in threshold_configs:
                    threshold = config["threshold"]
                    operator = config["operator"]
                    message = config["message"]
                    
                    condition_met = False
                    if operator == ">" and current_value and current_value > threshold:
                        condition_met = True
                    elif operator == "<" and current_value and current_value < threshold:
                        condition_met = True
                    
                    if condition_met:
                        # Check if this is a new crossing
                        key = f"{operator}{threshold}"
                        if key not in last_values or last_values[key] != condition_met:
                            print(f"🚨 THRESHOLD ALERT: {message}")
                            print(f"   Value: {current_value}% {'>' if operator == '>' else '<'} {threshold}%")
                            
                            # Here you would integrate with WhatsApp/notifications
                            # await send_whatsapp_message(message)
                            
                        last_values[key] = condition_met
            else:
                print(f"❌ [{i+1}/10] Could not read element: {result.get('error')}")
            
            await asyncio.sleep(2)  # Check every 2 seconds
            
        except Exception as e:
            print(f"❌ Monitoring error: {e}")
            
    print("\\n✅ Monitoring demo completed")

# Browser extension communication example
BROWSER_EXTENSION_CODE = '''
// Add this to your browser extension content script
// It provides DOM monitoring capability to the backend

class DOMMonitor {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.setupWebSocket();
    }
    
    setupWebSocket() {
        try {
            this.websocket = new WebSocket('ws://localhost:8000/browser/dom');
            
            this.websocket.onopen = () => {
                console.log('🔗 DOM Monitor connected to backend');
                this.isConnected = true;
            };
            
            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };
            
            this.websocket.onclose = () => {
                console.log('📪 DOM Monitor disconnected');
                this.isConnected = false;
                // Reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
        } catch (error) {
            console.error('DOM Monitor WebSocket error:', error);
        }
    }
    
    handleMessage(message) {
        if (message.action === 'getDom') {
            // Send current page DOM
            this.sendDOM();
        } else if (message.action === 'getElement') {
            // Get specific element by CSS selector
            this.sendElement(message.selector);
        }
    }
    
    sendDOM() {
        if (this.isConnected) {
            this.websocket.send(JSON.stringify({
                type: 'domContent',
                html: document.documentElement.outerHTML,
                timestamp: Date.now()
            }));
        }
    }
    
    sendElement(selector) {
        const elements = document.querySelectorAll(selector);
        const elementData = Array.from(elements).map(el => ({
            text: el.textContent.trim(),
            html: el.outerHTML,
            position: el.getBoundingClientRect()
        }));
        
        if (this.isConnected) {
            this.websocket.send(JSON.stringify({
                type: 'elementData',
                selector: selector,
                elements: elementData,
                timestamp: Date.now()
            }));
        }
    }
    
    // Monitor specific element for changes
    monitorElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            const observer = new MutationObserver((mutations) => {
                callback(element.textContent.trim());
            });
            
            observer.observe(element, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            return observer;
        }
        return null;
    }
}

// Initialize DOM monitor
const domMonitor = new DOMMonitor();

// Example: Monitor the specific trading class
const tradingObserver = domMonitor.monitorElement(
    '._change_1dqlt_76._colorSell_1dqlt_8 span',
    (newValue) => {
        console.log(`📈 Price changed to: ${newValue}`);
        // Send update to backend
        if (domMonitor.isConnected) {
            domMonitor.websocket.send(JSON.stringify({
                type: 'valueChanged',
                selector: '._change_1dqlt_76._colorSell_1dqlt_8 span',
                value: newValue,
                timestamp: Date.now()
            }));
        }
    }
);
'''

if __name__ == "__main__":
    print("🌐 Browser DOM Integration Example")
    print("=" * 50)
    print("This demonstrates real-time DOM monitoring with browser integration")
    print()
    
    print("📋 Browser Extension Code:")
    print("Add this to your browser extension to enable DOM monitoring:")
    print(BROWSER_EXTENSION_CODE)
    print()
    
    print("🚀 Starting monitoring demo...")
    asyncio.run(monitor_trading_interface())