"""
Seek Mode - Intelligent element/text finding and monitoring using LangChain
Allows users to search for elements on the page with various strategies
"""
from typing import Dict, List, Any, Optional, AsyncIterator
from agent.schema import SeekResult
import asyncio
import json
from datetime import datetime
import re
import base64
from pathlib import Path
import logging
from concurrent.futures import ThreadPoolExecutor
import os
import requests


# WhatsApp messaging function using local wp-bot (Baileys)
async def send_whatsapp_message(
    message: str, 
    phone_number: Optional[str] = None,
    screenshot_base64: Optional[str] = None,
    include_chart: bool = True
) -> bool:
    import logging
    from datetime import datetime
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("WhatsApp")
    
    # Get phone number from env or parameter
    target_number = phone_number or os.getenv("WHATSAPP_TARGET_NUMBER", "")
    wp_bot_url = os.getenv("WP_BOT_URL", "http://localhost:3001")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"\n{'='*60}")
    print(f"📱 [WhatsApp] === SENDING MESSAGE VIA WP-BOT ===")
    print(f"📱 [WhatsApp] Timestamp: {timestamp}")
    print(f"📱 [WhatsApp] Recipient: {target_number}")
    print(f"📱 [WhatsApp] WP-Bot URL: {wp_bot_url}")
    print(f"📱 [WhatsApp] Message length: {len(message)} characters")
    logger.info(f"📱 [WhatsApp] Preparing to send message to {target_number}")
    
    if include_chart and screenshot_base64:
        print(f"📱 [WhatsApp] 📊 CHART SCREENSHOT ATTACHED")
        print(f"📱 [WhatsApp]    - Size: {len(screenshot_base64)} bytes")
        print(f"📱 [WhatsApp]    - Sending screenshot to: {target_number}")
        logger.info(f"📱 [WhatsApp] Sending chart screenshot to {target_number}")
        
        # Save screenshot locally
        try:
            img_data = base64.b64decode(screenshot_base64)
            screenshots_dir = Path(__file__).parent.parent / "screenshots" / "whatsapp"
            screenshots_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"whatsapp_chart_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            filepath = screenshots_dir / filename
            
            with open(filepath, "wb") as f:
                f.write(img_data)
            
            print(f"📱 [WhatsApp]    - Screenshot saved: {filepath}")
            logger.info(f"📱 [WhatsApp] Screenshot saved locally: {filepath}")
            
        except Exception as e:
            logger.error(f"📱 [WhatsApp] Failed to save screenshot: {e}")
    
    # Print message preview
    print(f"📱 [WhatsApp] Message content:")
    print(f"{'─'*40}")
    print(message[:500] + "..." if len(message) > 500 else message)
    print(f"{'─'*40}")
    
    if not target_number:
        print(f"📱 [WhatsApp] ⚠️  No phone number specified")
        print(f"📱 [WhatsApp] Set WHATSAPP_TARGET_NUMBER in .env or pass phone_number")
        logger.warning("No target phone number specified")
        print(f"{'='*60}\n")
        return False
    
    try:
        # Send message via wp-bot HTTP API
        print(f"📱 [WhatsApp] 📤 Sending to {target_number} via wp-bot...")
        logger.info(f"📱 [WhatsApp] Calling wp-bot API at {wp_bot_url}/send")
        
        payload = {
            "phone": target_number,
            "message": message
        }
        
        # Include image if provided
        if include_chart and screenshot_base64:
            payload["image"] = screenshot_base64
        
        response = requests.post(
            f"{wp_bot_url}/send",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"📱 [WhatsApp] ✅ Message sent successfully to {target_number}!")
            if result.get("hasImage"):
                print(f"📱 [WhatsApp] ✅ Screenshot also sent to {target_number}!")
            logger.info(f"📱 [WhatsApp] Message sent via wp-bot to {target_number}")
            print(f"📱 [WhatsApp] === MESSAGE SENT ===")
            print(f"{'='*60}\n")
            return True
        else:
            error_msg = response.json().get("error", response.text)
            print(f"📱 [WhatsApp] ❌ Failed to send: {response.status_code}")
            print(f"📱 [WhatsApp] Error: {error_msg}")
            logger.error(f"Failed to send via wp-bot: {error_msg}")
            print(f"{'='*60}\n")
            return False
        
    except requests.exceptions.ConnectionError:
        print(f"📱 [WhatsApp] ❌ Cannot connect to wp-bot at {wp_bot_url}")
        print(f"📱 [WhatsApp] Make sure wp-bot is running: cd wp-bot && npm start")
        logger.error(f"Cannot connect to wp-bot at {wp_bot_url}")
        print(f"{'='*60}\n")
        return False
        
    except requests.exceptions.Timeout:
        print(f"📱 [WhatsApp] ❌ Request timeout")
        logger.error("wp-bot request timeout")
        print(f"{'='*60}\n")
        return False
        
    except Exception as e:
        print(f"📱 [WhatsApp] ❌ Error: {str(e)}")
        logger.error(f"WhatsApp send error: {e}")
        print(f"{'='*60}\n")
        return False


class LangChainDOMAnalyzer:
    
    def __init__(self):
        self.logger = logging.getLogger("LangChainDOMAnalyzer")
        self.llm = None
        self.dom_prompt = None
        self.output_parser = None
    
    async def analyze_dom_element(self, html_content: str, css_selector: str) -> Dict[str, Any]:
        try:
            if not self.llm or not self.dom_prompt:
                return {
                    "success": False,
                    "error": "LangChain not available",
                    "elements_found": 0
                }
            
            # Create the prompt
            prompt_value = self.dom_prompt.format_prompt(
                css_selector=css_selector,
                html_content=html_content[:5000]
            )
            
            # Process with LangChain
            result = await asyncio.to_thread(
                self.llm.invoke,
                prompt_value.to_string()
            )
            
            # Parse JSON response
            try:
                parsed_result = self.output_parser.parse(result)
                return parsed_result
            except:
                # Fallback manual parsing if JSON parsing fails
                return self._parse_llm_response(result, css_selector)
                
        except Exception as e:
            self.logger.error(f"LangChain DOM analysis error: {e}")
            return {
                "success": False,
                "error": str(e),
                "elements_found": 0
            }
    
    def _parse_llm_response(self, response: str, css_selector: str) -> Dict[str, Any]:
        try:
            # Look for JSON in the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                return json.loads(json_str)
            
            # If no JSON, create basic response
            return {
                "success": False,
                "error": "Could not parse LLM response",
                "elements_found": 0,
                "raw_response": response[:200]
            }
        except:
            return {
                "success": False,
                "error": "Failed to parse response",
                "elements_found": 0
            }
    
    async def analyze_stock_chart(
        self,
        screenshot_base64: str,
        analysis_prompt: str,
        stock_symbol: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            # Create specialized prompt for stock analysis with percentage focus and candlestick patterns
            stock_prompt = f"""You are a professional technical analyst and candlestick pattern expert. Analyze this trading chart screenshot with DEEP TECHNICAL ANALYSIS.

{f'Trading Pair/Symbol: {stock_symbol}' if stock_symbol else ''}
Analysis Request: {analysis_prompt}

=== CANDLESTICK PATTERN ANALYSIS (CRITICAL) ===
Identify ALL candlestick patterns visible on the chart:

BULLISH REVERSAL PATTERNS:
- Hammer / Inverted Hammer
- Morning Star / Morning Doji Star
- Bullish Engulfing
- Piercing Line
- Three White Soldiers
- Bullish Harami

BEARISH REVERSAL PATTERNS:
- Hanging Man / Shooting Star
- Evening Star / Evening Doji Star
- Bearish Engulfing
- Dark Cloud Cover
- Three Black Crows
- Bearish Harami

CONTINUATION PATTERNS:
- Doji (Neutral/Indecision)
- Spinning Top
- Rising/Falling Three Methods
- Marubozu (Bullish/Bearish)

=== PERCENTAGE VALUES (HIGH PRIORITY) ===
Scan and identify ALL percentage values visible:
- Price change percentages (e.g., +2.34%, -1.67%)
- RSI percentage levels (e.g., 73%, 28%)
- Portfolio gains/losses
- Volume change percentages
- Moving average distances

=== TECHNICAL INDICATORS ===
Analyze all visible indicators:
- RSI (Overbought >70, Oversold <30)
- MACD (Signal line crossovers, histogram)
- Moving Averages (EMA/SMA crossovers, price position)
- Bollinger Bands (squeeze, breakout)
- Volume analysis

=== RESPOND WITH JSON ===
{{
  "signal_triggered": true/false,
  "prediction": {{
    "direction": "BULLISH" / "BEARISH" / "NEUTRAL",
    "confidence": "HIGH" / "MEDIUM" / "LOW",
    "timeframe": "short-term (1-4h) / medium-term (1-3d) / long-term (1w+)",
    "target_move": "+X% / -X% expected"
  }},
  "candlestick_patterns": [
    {{
      "pattern_name": "Bullish Engulfing",
      "type": "bullish_reversal",
      "location": "most recent candles",
      "strength": "strong/moderate/weak",
      "confirmation_needed": true/false
    }}
  ],
  "percentages_found": [
    {{"type": "price_change", "value": "+2.34%", "location": "top right"}},
    {{"type": "rsi", "value": "73.2%", "location": "indicator panel"}}
  ],
  "current_price": "price if visible",
  "technical_indicators": {{
    "rsi": {{"value": "X%", "signal": "overbought/oversold/neutral"}},
    "macd": {{"signal": "bullish_crossover/bearish_crossover/neutral", "histogram": "increasing/decreasing"}},
    "moving_averages": {{"trend": "above/below", "crossover": "golden_cross/death_cross/none"}},
    "volume": {{"level": "high/normal/low", "trend": "increasing/decreasing"}},
    "support_resistance": {{"nearest_support": "price", "nearest_resistance": "price"}}
  }},
  "analysis": "Detailed technical analysis combining candlestick patterns with indicators. Explain WHY the prediction is bullish/bearish based on pattern formations and indicator confluence.",
  "recommendation": "STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL",
  "risk_level": "LOW / MEDIUM / HIGH",
  "key_levels": {{
    "entry": "suggested entry price",
    "stop_loss": "suggested stop loss",
    "take_profit": ["TP1", "TP2", "TP3"]
  }},
  "reason": "Concise summary: Pattern X detected + Indicator Y confirms = Direction prediction"
}}

ANALYSIS PRIORITY:
1. Identify the MOST RECENT candlestick patterns (last 3-5 candles)
2. Check for pattern confirmation with volume
3. Correlate with RSI/MACD signals
4. Determine trend direction and strength
5. Make price movement prediction

Respond with ONLY the JSON, no additional text."""
            
            # Use vision to analyze the chart
            result = await asyncio.to_thread(
                self.vision.analyze_screenshot,
                screenshot_base64,
                stock_prompt
            )
            
            # Parse JSON response
            json_start = result.find('{')
            json_end = result.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_text = result[json_start:json_end]
                analysis = json.loads(json_text)
                
                return {
                    "success": True,
                    "analysis": analysis,
                    "timestamp": datetime.now().isoformat(),
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "error": "Could not parse analysis response",
                    "raw_response": result
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


class SeekMode:
    
    def __init__(self):
        self.dom_analyzer = LangChainDOMAnalyzer()
        self.active_seeks: Dict[str, bool] = {}
        self.dom_thresholds: Dict[str, Dict] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        self.seek_history: Dict[str, List] = {}
        self.screenshot_intervals: Dict[str, int] = {}
        self.last_screenshots: Dict[str, str] = {}
        self.stock_analyzer = None
        self.vision = None
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("SeekMode")
    
    async def start_dom_seek(
        self,
        task_id: str,
        query: str,
        html_content: str,
        continuous: bool = True,
        check_interval: int = 2
    ) -> AsyncIterator[Dict[str, Any]]:
        try:
            # Parse query parameters
            parts = query.split('|')
            if len(parts) != 3:
                yield {
                    "type": "dom_error",
                    "error": "Query format should be: 'css_selector|threshold|operator'",
                    "task_id": task_id
                }
                return
                
            css_selector = parts[0].strip()
            threshold = float(parts[1].strip())
            operator = parts[2].strip()
            
            # Validate operator
            if operator not in ['>', '<', '>=', '<=', '==', '!=']:
                yield {
                    "type": "dom_error", 
                    "error": f"Invalid operator: {operator}. Use: >, <, >=, <=, ==, !=",
                    "task_id": task_id
                }
                return
                
            # Store threshold config
            self.dom_thresholds[task_id] = {
                "css_selector": css_selector,
                "threshold": threshold,
                "operator": operator,
                "last_value": None,
                "threshold_crossed": False
            }
            
            yield {
                "type": "dom_monitoring_started",
                "message": f"Monitoring {css_selector} for value {operator} {threshold}",
                "task_id": task_id,
                "config": self.dom_thresholds[task_id]
            }
            
        except ValueError as e:
            yield {
                "type": "dom_error",
                "error": f"Invalid threshold value: {parts[1] if len(parts) > 1 else 'missing'}",
                "task_id": task_id
            }
            return
        except Exception as e:
            yield {
                "type": "dom_error",
                "error": str(e),
                "task_id": task_id
            }
            return
        
        # Start monitoring loop
        while self.active_seeks.get(task_id, False):
            try:
                # For now, return a placeholder since we don't have actual DOM access
                # In real implementation, this would parse actual HTML from browser
                yield {
                    "type": "dom_monitoring_error",
                    "error": "DOM parsing not available - need browser integration",
                    "task_id": task_id
                }
                    
            except Exception as e:
                yield {
                    "type": "dom_monitoring_error",
                    "error": str(e),
                    "task_id": task_id
                }
                
            if not continuous:
                break
                
            await asyncio.sleep(check_interval)
            
        yield {
            "type": "dom_monitoring_stopped",
            "task_id": task_id
        }
    
    def _extract_numerical_value(self, text: str) -> Optional[float]:
        try:
            # Remove common symbols and extract numbers
            cleaned = re.sub(r'[%$,€£¥\s]', '', text)
            # Find first number (positive or negative)
            match = re.search(r'-?\d+(?:\.\d+)?', cleaned)
            if match:
                return float(match.group())
            return None
        except (ValueError, AttributeError):
            return None
    
    def _check_threshold(self, current_value: float, threshold: float, operator: str, task_id: str) -> Dict[str, Any]:
        config = self.dom_thresholds.get(task_id, {})
        last_value = config.get("last_value")
        
        # Determine if threshold is crossed
        crossed = False
        
        if operator == ">":
            crossed = current_value > threshold
        elif operator == "<":
            crossed = current_value < threshold  
        elif operator == ">=":
            crossed = current_value >= threshold
        elif operator == "<=":
            crossed = current_value <= threshold
        elif operator == "==":
            crossed = abs(current_value - threshold) < 0.001  # Float comparison
        elif operator == "!=":
            crossed = abs(current_value - threshold) >= 0.001
            
        # Only trigger if this is a new crossing (prevent spam)
        previously_crossed = config.get("threshold_crossed", False)
        is_new_crossing = crossed and not previously_crossed
        
        # Update state
        config["last_value"] = current_value
        config["threshold_crossed"] = crossed
        
        return {
            "crossed": is_new_crossing,
            "condition_met": crossed,
            "current_value": current_value,
            "last_value": last_value,
            "is_new_crossing": is_new_crossing
        }
    
    def stop_seek(self, task_id: str):
        self.active_seeks[task_id] = False
        if task_id in self.dom_thresholds:
            del self.dom_thresholds[task_id]
        self.logger.info(f"Stopped monitoring for task {task_id}")
    
    async def _seek_text(
        self,
        task_id: str,
        text_query: str,
        action: str,
        continuous: bool,
        screenshot_interval: int = 1
    ) -> AsyncIterator[Dict[str, Any]]:
        
        while self.active_seeks.get(task_id, False):
            # Send command to extension to search for text
            seek_command = {
                "type": "seek_text",
                "query": text_query,
                "action": action,
                "task_id": task_id
            }
            
            yield {
                "type": "seek_command",
                "command": seek_command,
                "message": f"Searching for text: '{text_query}'"
            }
            
            # Simulate waiting for result from extension
            # In production, this would wait for WebSocket response
            await asyncio.sleep(0.5)
            
            # Mock result - in production this comes from extension
            result = SeekResult(
                found=True,
                elements=[{"text": text_query, "selector": "body", "visible": True}],
                timestamp=datetime.now()
            )
            
            # Store result
            if task_id not in self.seek_history:
                self.seek_history[task_id] = []
            self.seek_history[task_id].append(result)
            
            yield {
                "type": "seek_result",
                "result": result.dict(),
                "task_id": task_id,
                "action": action
            }
            
            if not continuous:
                break
            
            await asyncio.sleep(screenshot_interval)  # Use configurable interval
        
        yield {
            "type": "seek_stopped",
            "task_id": task_id,
            "results_count": len(self.seek_history.get(task_id, []))
        }
    
    async def _seek_element(
        self,
        task_id: str,
        element_description: str,
        action: str,
        continuous: bool,
        screenshot_interval: int = 1
    ) -> AsyncIterator[Dict[str, Any]]:
        
        while self.active_seeks.get(task_id, False):
            # Check if it's a CSS selector or natural language
            is_selector = any(c in element_description for c in ['#', '.', '[', '>'])
            
            seek_command = {
                "type": "seek_element",
                "selector": element_description if is_selector else None,
                "description": element_description if not is_selector else None,
                "action": action,
                "task_id": task_id
            }
            
            yield {
                "type": "seek_command",
                "command": seek_command,
                "message": f"Searching for element: '{element_description}'"
            }
            
            await asyncio.sleep(0.5)
            
            # Mock result
            result = SeekResult(
                found=True,
                elements=[{
                    "selector": element_description,
                    "bounds": {"x": 100, "y": 200, "width": 150, "height": 40},
                    "visible": True
                }],
                timestamp=datetime.now()
            )
            
            if task_id not in self.seek_history:
                self.seek_history[task_id] = []
            self.seek_history[task_id].append(result)
            
            yield {
                "type": "seek_result",
                "result": result.dict(),
                "task_id": task_id,
                "action": action
            }
            
            if not continuous:
                break
            
            await asyncio.sleep(screenshot_interval)
        
        yield {
            "type": "seek_stopped",
            "task_id": task_id
        }
    
    async def _seek_vision(
        self,
        task_id: str,
        visual_query: str,
        action: str,
        screenshot_base64: str,
        continuous: bool,
        screenshot_interval: int = 2
    ) -> AsyncIterator[Dict[str, Any]]:
        
        while self.active_seeks.get(task_id, False):
            yield {
                "type": "seek_analyzing",
                "message": f"Using AI vision to search for: '{visual_query}'",
                "task_id": task_id
            }
            
            try:
                # Use vision AI to locate the element
                coordinates = await self._vision_locate(screenshot_base64, visual_query)
                
                if coordinates:
                    result = SeekResult(
                        found=True,
                        elements=[{
                            "description": visual_query,
                            "x": coordinates["x"],
                            "y": coordinates["y"],
                            "confidence": coordinates.get("confidence", 0.9)
                        }],
                        screenshot=screenshot_base64,
                        timestamp=datetime.now()
                    )
                    
                    if task_id not in self.seek_history:
                        self.seek_history[task_id] = []
                    self.seek_history[task_id].append(result)
                    
                    yield {
                        "type": "seek_result",
                        "result": result.dict(),
                        "task_id": task_id,
                        "action": action,
                        "coordinates": coordinates
                    }
                else:
                    yield {
                        "type": "seek_not_found",
                        "message": f"Could not find: '{visual_query}'",
                        "task_id": task_id
                    }
                
            except Exception as e:
                yield {
                    "type": "seek_error",
                    "error": str(e),
                    "task_id": task_id
                }
            
            if not continuous:
                break
            
            await asyncio.sleep(screenshot_interval)  # Vision is slower, use configurable interval
        
        yield {
            "type": "seek_stopped",
            "task_id": task_id
        }
    
    async def _vision_locate(self, screenshot_base64: str, description: str) -> Optional[Dict[str, Any]]:
        try:
            # Use the vision system's seek_element method
            result = await asyncio.to_thread(
                self.vision.seek_element,
                screenshot_base64,
                description,
                return_all=False  # Get best match
            )
            
            if result.get("found") and result.get("element"):
                element = result["element"]
                return {
                    "x": element["x"],
                    "y": element["y"],
                    "confidence": element.get("confidence", "unknown"),
                    "element_type": element.get("element_type", "unknown"),
                    "description": element.get("description", "")
                }
            
            return None
            
        except Exception as e:
            print(f"Vision locate error: {e}")
            return None
    
    async def _seek_vision(
        self,
        task_id: str,
        visual_query: str,
        action: str,
        screenshot_base64: str,
        continuous: bool
    ) -> AsyncIterator[Dict[str, Any]]:
        
        while self.active_seeks.get(task_id, False):
            yield {
                "type": "seek_analyzing",
                "message": f"Using AI vision to search for: '{visual_query}'",
                "task_id": task_id
            }
            
            try:
                # Use vision AI to locate the element
                coordinates = await self._vision_locate(screenshot_base64, visual_query)
                
                if coordinates:
                    result = SeekResult(
                        found=True,
                        elements=[{
                            "description": visual_query,
                            "x": coordinates["x"],
                            "y": coordinates["y"],
                            "confidence": coordinates.get("confidence", 0.9)
                        }],
                        screenshot=screenshot_base64,
                        timestamp=datetime.now()
                    )
                    
                    if task_id not in self.seek_history:
                        self.seek_history[task_id] = []
                    self.seek_history[task_id].append(result)
                    
                    yield {
                        "type": "seek_result",
                        "result": result.dict(),
                        "task_id": task_id,
                        "action": action,
                        "coordinates": coordinates
                    }
                else:
                    yield {
                        "type": "seek_not_found",
                        "message": f"Could not find: '{visual_query}'",
                        "task_id": task_id
                    }
                
            except Exception as e:
                yield {
                    "type": "seek_error",
                    "error": str(e),
                    "task_id": task_id
                }
            
            if not continuous:
                break
            
            await asyncio.sleep(2)  # Vision is slower, poll every 2 seconds
        
        yield {
            "type": "seek_stopped",
            "task_id": task_id
        }
    
    async def _seek_percentages(
        self,
        task_id: str,
        context_query: str,
        action: str,
        screenshot_base64: str,
        continuous: bool,
        screenshot_interval: int = 1
    ) -> AsyncIterator[Dict[str, Any]]:
        while self.active_seeks.get(task_id, False):
            yield {
                "type": "seek_analyzing",
                "message": f"Scanning for percentage values with context: '{context_query}'",
                "task_id": task_id
            }
            
            try:
                # Create specialized percentage-focused prompt
                percentage_prompt = (
                    f"PERCENTAGE DETECTOR: Find ALL percentage values (%) in this screenshot.\n"
                    f"Context: {context_query}\n"
                    "SCAN PRIORITY:\n"
                    "1. Numbers followed by % symbol (e.g., +2.34%, -1.67%, 73.2%)\n"
                    "2. Price change indicators\n"
                    "3. Technical indicator levels (RSI, momentum, etc.)\n"
                    "4. Portfolio performance metrics\n"
                    "5. Market percentage movements\n"
                    "Find EVERY percentage visible and classify by type:\n"
                    "- price_change: Stock/asset price movements\n"
                    "- technical_indicator: RSI, MACD, momentum levels\n"
                    "- portfolio: Portfolio gains/losses\n"
                    "- market_movement: Sector/market percentage changes\n"
                    "- other: Any other percentage value\n"
                    f"Focus especially on percentages related to: {context_query}"
                )

                # Use vision to find percentages
                result = await asyncio.to_thread(
                    self.vision.seek_element,
                    screenshot_base64,
                    percentage_prompt,
                    return_all=True  # Get all percentage matches
                )
                
                if result.get("found") and result.get("elements"):
                    percentages = []
                    for element in result["elements"]:
                        # Extract percentage value if present
                        text = element.get("text_content", "")
                        percentage_val = element.get("percentage_value", text)
                        
                        percentages.append({
                            "value": percentage_val,
                            "x": element["x"],
                            "y": element["y"],
                            "type": element.get("element_type", "percentage_indicator"),
                            "confidence": element.get("confidence", "medium"),
                            "description": element.get("description", ""),
                            "context_relevance": self._assess_percentage_relevance(percentage_val, context_query)
                        })
                    
                    # Sort by context relevance and confidence
                    percentages.sort(key=lambda p: (
                        p["context_relevance"],
                        {"high": 3, "medium": 2, "low": 1}.get(p["confidence"], 0)
                    ), reverse=True)
                    
                    seek_result = SeekResult(
                        found=True,
                        elements=percentages,
                        screenshot=screenshot_base64,
                        timestamp=datetime.now()
                    )
                    
                    if task_id not in self.seek_history:
                        self.seek_history[task_id] = []
                    self.seek_history[task_id].append(seek_result)
                    
                    yield {
                        "type": "percentages_found",
                        "result": seek_result.dict(),
                        "task_id": task_id,
                        "action": action,
                        "total_percentages": len(percentages),
                        "top_percentage": percentages[0] if percentages else None
                    }
                else:
                    yield {
                        "type": "no_percentages_found",
                        "message": f"No percentage values found in context: '{context_query}'",
                        "task_id": task_id
                    }
                
            except Exception as e:
                yield {
                    "type": "percentage_seek_error",
                    "error": str(e),
                    "task_id": task_id
                }
            
            if not continuous:
                break
            
            await asyncio.sleep(screenshot_interval)
        
        yield {
            "type": "percentage_seek_stopped",
            "task_id": task_id
        }
    
    def _assess_percentage_relevance(self, percentage_value: str, context_query: str) -> int:
        if not percentage_value or not context_query:
            return 0
            
        context_lower = context_query.lower()
        percentage_lower = percentage_value.lower()
        
        # High relevance keywords
        high_keywords = ['rsi', 'price', 'change', 'gain', 'loss', 'momentum', 'volume']
        medium_keywords = ['move', 'up', 'down', 'percent', '%']
        
        score = 0
        
        # Check if percentage contains relevant context
        for keyword in high_keywords:
            if keyword in context_lower:
                score += 3
        
        for keyword in medium_keywords:
            if keyword in context_lower:
                score += 1
        
        # Boost score for actual numerical values
        if any(char.isdigit() for char in percentage_value):
            score += 2
            
        # Boost for price change indicators
        if any(symbol in percentage_value for symbol in ['+', '-']):
            score += 2
            
        return min(score, 10)  # Cap at 10
    
    async def _seek_dom_threshold(
        self,
        task_id: str,
        query: str,
        action: str,
        continuous: bool,
        screenshot_interval: int = 1
    ) -> AsyncIterator[Dict[str, Any]]:
        try:
            # Parse query parameters
            parts = query.split('|')
            if len(parts) != 3:
                yield {
                    "type": "dom_error",
                    "error": "Query format should be: 'css_selector|threshold|operator'",
                    "task_id": task_id
                }
                return
                
            css_selector = parts[0].strip()
            threshold = float(parts[1].strip())
            operator = parts[2].strip()
            
            # Validate operator
            if operator not in ['>', '<', '>=', '<=', '==', '!=']:
                yield {
                    "type": "dom_error", 
                    "error": f"Invalid operator: {operator}. Use: >, <, >=, <=, ==, !=",
                    "task_id": task_id
                }
                return
                
            # Store threshold config
            self.dom_thresholds[task_id] = {
                "css_selector": css_selector,
                "threshold": threshold,
                "operator": operator,
                "last_value": None,
                "threshold_crossed": False
            }
            
            yield {
                "type": "dom_monitoring_started",
                "message": f"Monitoring {css_selector} for value {operator} {threshold}",
                "task_id": task_id,
                "config": self.dom_thresholds[task_id]
            }
            
        except ValueError as e:
            yield {
                "type": "dom_error",
                "error": f"Invalid threshold value: {parts[1] if len(parts) > 1 else 'missing'}",
                "task_id": task_id
            }
            return
        except Exception as e:
            yield {
                "type": "dom_error",
                "error": str(e),
                "task_id": task_id
            }
            return
        
        # Start parallel monitoring
        while self.active_seeks.get(task_id, False):
            try:
                # Get current DOM state (this would typically come from browser extension)
                dom_result = await self._parse_dom_element(css_selector, task_id)
                
                if dom_result.get("success"):
                    current_value = dom_result.get("value")
                    element_text = dom_result.get("text", "")
                    
                    # Check threshold
                    threshold_result = self._check_threshold(
                        current_value, 
                        threshold, 
                        operator,
                        task_id
                    )
                    
                    if threshold_result.get("crossed"):
                        # Threshold crossed - send alert
                        alert_message = (f"🚨 DOM THRESHOLD ALERT\n"
                                       f"Element: {css_selector}\n"
                                       f"Current Value: {current_value}\n"
                                       f"Threshold: {operator} {threshold}\n"
                                       f"Text Content: {element_text}\n"
                                       f"Time: {datetime.now().strftime('%H:%M:%S')}")
                        
                        # Log the alert
                        self.logger.warning(f"📊 [DOM THRESHOLD] {alert_message}")
                        print(f"\\n{alert_message}\\n")
                        
                        yield {
                            "type": "threshold_crossed",
                            "message": alert_message,
                            "task_id": task_id,
                            "element": {
                                "css_selector": css_selector,
                                "current_value": current_value,
                                "threshold": threshold,
                                "operator": operator,
                                "text_content": element_text
                            },
                            "timestamp": datetime.now().isoformat()
                        }

                        # Always yield current status
                        yield {
                            "type": "dom_status",
                            "task_id": task_id,
                            "element": {
                                "css_selector": css_selector,
                                "current_value": current_value,
                                "text_content": element_text,
                                "threshold": threshold,
                                "operator": operator,
                                "threshold_crossed": threshold_result.get("crossed", False)
                            },
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        yield {
                            "type": "dom_element_not_found",
                            "message": f"Element not found: {css_selector}",
                            "task_id": task_id
                        }
                        
                else:
                    yield {
                        "type": "dom_element_not_found",
                        "message": f"Element not found: {css_selector}",
                        "task_id": task_id
                    }
                    
            except Exception as e:
                yield {
                    "type": "dom_monitoring_error",
                    "error": str(e),
                    "task_id": task_id
                }
                
            if not continuous:
                break
                
            await asyncio.sleep(screenshot_interval)
            
        yield {
            "type": "dom_monitoring_stopped",
            "task_id": task_id
        }
    
    async def _parse_dom_element(self, css_selector: str, task_id: str) -> Dict[str, Any]:
        try:
            # This is a placeholder - in real implementation, this would:
            # 1. Get current page HTML from browser extension via WebSocket
            # 2. Parse with HTML parser
            # 3. Extract numerical value from span element
            
            # For now, return error since DOM parsing is not available
            return {
                "success": False,
                "error": "DOM parsing not available - need browser integration",
                "text_content": None,
                "numerical_value": None
            }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _extract_numerical_value(self, text: str) -> Optional[float]:
        try:
            # Remove common symbols and extract numbers
            cleaned = re.sub(r'[%$,€£¥]', '', text)
            
            # Find first number (positive or negative)
            match = re.search(r'-?\d+(?:\.\d+)?', cleaned)
            if match:
                return float(match.group())
            return None
        except (ValueError, AttributeError):
            return None
    
    def _check_threshold(self, current_value: Optional[float], threshold: float, operator: str, task_id: str) -> Dict[str, Any]:
        if current_value is None:
            return {"crossed": False, "reason": "No numerical value found"}
            
        config = self.dom_thresholds.get(task_id, {})
        last_value = config.get("last_value")
        
        # Determine if threshold is crossed
        crossed = False
        
        if operator == ">":
            crossed = current_value > threshold
        elif operator == "<":
            crossed = current_value < threshold  
        elif operator == ">=":
            crossed = current_value >= threshold
        elif operator == "<=":
            crossed = current_value <= threshold
        elif operator == "==":
            crossed = abs(current_value - threshold) < 0.001  # Float comparison
        elif operator == "!=":
            crossed = abs(current_value - threshold) >= 0.001
            
        # Only trigger if this is a new crossing (prevent spam)
        previously_crossed = config.get("threshold_crossed", False)
        is_new_crossing = crossed and not previously_crossed
        
        # Update state
        config["last_value"] = current_value
        config["threshold_crossed"] = crossed
        
        return {
            "crossed": is_new_crossing,
            "condition_met": crossed,
            "current_value": current_value,
            "last_value": last_value,
            "is_new_crossing": is_new_crossing
        }
    
    async def start_stock_monitoring(
        self,
        task_id: str,
        analysis_prompt: str,
        stock_symbol: Optional[str] = None,
        phone_number: Optional[str] = None,
        screenshot_interval: int = 10,
        get_screenshot_func: Optional[callable] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        self.active_seeks[task_id] = True
        self.screenshot_intervals[task_id] = screenshot_interval
        
        yield {
            "type": "stock_monitoring_started",
            "task_id": task_id,
            "stock_symbol": stock_symbol,
            "analysis_prompt": analysis_prompt,
            "screenshot_interval": screenshot_interval,
            "timestamp": datetime.now().isoformat()
        }
        
        screenshot_count = 0
        
        try:
            while self.active_seeks.get(task_id, False):
                screenshot_count += 1
                
                # Get fresh screenshot
                screenshot_base64 = None
                if get_screenshot_func:
                    try:
                        screenshot_base64 = await get_screenshot_func()
                    except Exception as e:
                        yield {
                            "type": "screenshot_error",
                            "error": str(e),
                            "task_id": task_id
                        }
                        await asyncio.sleep(screenshot_interval)
                        continue
                else:
                    # Use last provided screenshot or request new one
                    screenshot_base64 = self.last_screenshots.get(task_id)
                    if not screenshot_base64:
                        yield {
                            "type": "screenshot_needed",
                            "message": "Please provide screenshot for analysis",
                            "task_id": task_id
                        }
                        await asyncio.sleep(screenshot_interval)
                        continue
                
                yield {
                    "type": "analyzing_chart",
                    "message": f"Analyzing screenshot #{screenshot_count}",
                    "task_id": task_id,
                    "stock_symbol": stock_symbol,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Analyze the stock chart
                analysis = await self.stock_analyzer.analyze_stock_chart(
                    screenshot_base64,
                    analysis_prompt,
                    stock_symbol
                )
                
                if analysis["success"]:
                    analysis_data = analysis["analysis"]
                    signal_triggered = analysis_data.get("signal_triggered", False)
                    
                    yield {
                        "type": "analysis_complete",
                        "task_id": task_id,
                        "analysis": analysis_data,
                        "screenshot_count": screenshot_count,
                        "signal_triggered": signal_triggered,
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    # If signal triggered, send WhatsApp notification
                    if signal_triggered:
                        message = self._format_signal_message(
                            stock_symbol,
                            analysis_prompt,
                            analysis_data
                        )
                        
                        # Send WhatsApp message with chart screenshot
                        success = await send_whatsapp_message(
                            message=message, 
                            phone_number=phone_number,
                            screenshot_base64=screenshot_base64,
                            include_chart=True
                        )
                        
                        yield {
                            "type": "signal_alert",
                            "task_id": task_id,
                            "message": message,
                            "whatsapp_sent": success,
                            "analysis": analysis_data,
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Optionally stop monitoring after signal
                        # self.active_seeks[task_id] = False
                        # break
                
                else:
                    yield {
                        "type": "analysis_error",
                        "error": analysis.get("error", "Analysis failed"),
                        "task_id": task_id
                    }
                
                # Wait for next screenshot
                await asyncio.sleep(screenshot_interval)
                
        except Exception as e:
            yield {
                "type": "monitoring_error",
                "error": str(e),
                "task_id": task_id
            }
        
        finally:
            yield {
                "type": "stock_monitoring_stopped",
                "task_id": task_id,
                "total_screenshots": screenshot_count,
                "timestamp": datetime.now().isoformat()
            }
    
    def _format_signal_message(
        self,
        stock_symbol: Optional[str],
        analysis_prompt: str,
        analysis_data: Dict[str, Any]
    ) -> str:
        symbol_text = f"📈 {stock_symbol}" if stock_symbol else "📈 Stock Alert"
        
        message = f"""{symbol_text} - SIGNAL TRIGGERED! 🚨

📊 Analysis: {analysis_prompt}

💰 Current Price: {analysis_data.get('current_price', 'N/A')}
📈 Recommendation: {analysis_data.get('recommendation', 'N/A').upper()}
🎯 Confidence: {analysis_data.get('confidence', 'N/A').upper()}

📝 Reason: {analysis_data.get('reason', 'N/A')}

🕐 Time: {datetime.now().strftime('%H:%M:%S')}

⚡ Technical Indicators:"""
        
        indicators = analysis_data.get('technical_indicators', {})
        for key, value in indicators.items():
            if value and value != 'N/A':
                message += f"\n   • {key.upper()}: {value}"
        
        return message
    
    def update_screenshot(self, task_id: str, screenshot_base64: str):
        self.last_screenshots[task_id] = screenshot_base64
    
    def stop_seek(self, task_id: str):
        if task_id in self.active_seeks:
            self.active_seeks[task_id] = False
            # Cleanup
            self.screenshot_intervals.pop(task_id, None)
            self.last_screenshots.pop(task_id, None)
            return True
        return False
    
    def get_seek_history(self, task_id: str) -> List[SeekResult]:
        return self.seek_history.get(task_id, [])
    
    def clear_seek_history(self, task_id: str):
        if task_id in self.seek_history:
            del self.seek_history[task_id]
    
    def is_seeking(self, task_id: str) -> bool:
        return self.active_seeks.get(task_id, False)
    
    async def quick_seek(
        self,
        query: str,
        screenshot_base64: Optional[str] = None,
        seek_type: str = "auto"
    ) -> Dict[str, Any]:
        # Auto-detect seek type
        if seek_type == "auto":
            # Check for stock analysis keywords
            stock_keywords = ['rsi', 'macd', 'sma', 'ema', 'resistance', 'support', 
                             'breakout', 'chart', 'technical', 'price', 'volume']
            if any(keyword in query.lower() for keyword in stock_keywords):
                seek_type = "stock"
            # If query looks like a selector, use element seek
            elif any(c in query for c in ['#', '.', '[', '>']):
                seek_type = "element"
            # If screenshot provided and query is descriptive, use vision
            elif screenshot_base64 and len(query.split()) > 2:
                seek_type = "vision"
            # Otherwise use text seek
            else:
                seek_type = "text"
        
        task_id = f"quick-seek-{datetime.now().timestamp()}"
        
        results = []
        async for update in self.start_seek(
            task_id=task_id,
            seek_type=seek_type,
            query=query,
            action="highlight",
            continuous=False,
            screenshot_base64=screenshot_base64
        ):
            results.append(update)
        
        # Return last result
        return results[-1] if results else {"type": "seek_error", "error": "No results"}


# Global seek mode instance
seek_mode = SeekMode()
