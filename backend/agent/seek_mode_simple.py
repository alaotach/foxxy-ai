"""
Simplified DOM Seek Mode without external dependencies
Focuses on monitoring CSS selector elements with threshold detection
"""
from typing import Dict, List, Any, Optional, AsyncIterator
import asyncio
import json
from datetime import datetime
import re
import logging
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor


class SimpleDOMAnalyzer:
    """
    Simple DOM analyzer using BeautifulSoup only - no external dependencies
    """
    
    def __init__(self):
        self.logger = logging.getLogger("SimpleDOMAnalyzer")
    
    async def analyze_dom_element(self, html_content: str, css_selector: str) -> Dict[str, Any]:
        """
        Analyze DOM using BeautifulSoup to extract values from CSS selector
        """
        try:
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            elements = soup.select(css_selector)
            
            if not elements:
                return {
                    "success": False,
                    "error": f"No elements found for selector: {css_selector}",
                    "elements_found": 0
                }
            
            # Extract text and numerical values
            first_element = elements[0]
            text_content = first_element.get_text().strip()
            
            # Extract numerical value
            numerical_value = self._extract_numerical_value(text_content)
            
            if numerical_value is not None:
                return {
                    "success": True,
                    "elements_found": len(elements),
                    "first_value": numerical_value,
                    "first_text": text_content,
                    "all_values": [self._extract_numerical_value(el.get_text().strip()) for el in elements]
                }
            else:
                return {
                    "success": True,
                    "elements_found": len(elements),
                    "first_value": None,
                    "first_text": text_content,
                    "error": "No numerical value found in text"
                }
                
        except Exception as e:
            self.logger.error(f"DOM analysis error: {e}")
            return {
                "success": False,
                "error": str(e),
                "elements_found": 0
            }
    
    def _extract_numerical_value(self, text: str) -> Optional[float]:
        """Extract numerical value from text (handles percentages, currency, etc.)"""
        try:
            # Remove common symbols and whitespace
            cleaned = re.sub(r'[%$,€£¥\s]', '', text)
            
            # Find first number (positive or negative) 
            match = re.search(r'-?\d+(?:\.\d+)?', cleaned)
            if match:
                return float(match.group())
            return None
        except (ValueError, AttributeError):
            return None


class SeekMode:
    """
    Simple DOM-based Seek Mode for threshold detection - no external dependencies
    Focuses on CSS selector-based element monitoring with threshold alerts
    """
    
    def __init__(self):
        self.dom_analyzer = SimpleDOMAnalyzer()
        self.active_seeks: Dict[str, bool] = {}
        self.dom_thresholds: Dict[str, Dict] = {}
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("SeekMode")
    
    async def start_dom_seek(
        self,
        task_id: str,
        threshold: float,  # Just the threshold value
        operator: str = ">",  # Default operator
        html_content: str = None,
        continuous: bool = True,
        check_interval: int = 2
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Monitor hardcoded trading element with threshold detection using LangChain
        
        Args:
            task_id: Unique task identifier  
            threshold: Threshold value (e.g., 5.0 for 5%)
            operator: Comparison operator (>, <, >=, <=, ==, !=)
            html_content: HTML content to analyze (if None, will simulate)
            continuous: Keep monitoring (for demo, we'll simulate)
            check_interval: How often to check in seconds
            
        Yields:
            DOM monitoring results and threshold alerts
        """
        # HARDCODED CSS selector for trading interface
        css_selector = "._change_1dqlt_76 _colorSell_1dqlt_8 span"
        
        try:
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
            
            self.active_seeks[task_id] = True
            
            yield {
                "type": "dom_monitoring_started",
                "message": f"Monitoring trading element for value {operator} {threshold}",
                "task_id": task_id,
                "css_selector": css_selector,
                "config": self.dom_thresholds[task_id]
            }
            
        except Exception as e:
            yield {
                "type": "dom_error",
                "error": str(e),
                "task_id": task_id
            }
            return
        
        # Use sample HTML if none provided
        if html_content is None:
            html_content = self._get_sample_trading_html()
        
        # Start monitoring loop
        while self.active_seeks.get(task_id, False):
            try:
                # Analyze DOM with BeautifulSoup
                analysis_result = await self.dom_analyzer.analyze_dom_element(html_content, css_selector)
                
                if analysis_result.get("success"):
                    current_value = analysis_result.get("first_value")
                    element_text = analysis_result.get("first_text", "")
                    elements_found = analysis_result.get("elements_found", 0)
                    
                    if current_value is not None:
                        # Check threshold
                        threshold_result = self._check_threshold(
                            current_value, 
                            threshold, 
                            operator,
                            task_id
                        )
                        
                        if threshold_result.get("crossed"):
                            # Threshold crossed - send alert
                            alert_message = f"🚨 TRADING ALERT\\n" \
                                          f"Element: {css_selector}\\n" \
                                          f"Current Value: {current_value}%\\n" \
                                          f"Threshold: {operator} {threshold}%\\n" \
                                          f"Text Content: {element_text}\\n" \
                                          f"Time: {datetime.now().strftime('%H:%M:%S')}"
                            
                            # Log the alert
                            self.logger.warning(f"📊 [TRADING THRESHOLD] {alert_message}")
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
                                    "text_content": element_text,
                                    "elements_found": elements_found
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
                                "threshold_crossed": threshold_result.get("crossed", False),
                                "elements_found": elements_found
                            },
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        yield {
                            "type": "dom_no_value",
                            "message": f"No numerical value found in trading element",
                            "task_id": task_id,
                            "text_found": element_text,
                            "css_selector": css_selector
                        }
                        
                else:
                    yield {
                        "type": "dom_element_not_found",
                        "message": f"Trading element not found: {css_selector}",
                        "task_id": task_id,
                        "error": analysis_result.get("error", "Unknown error")
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
    
    def _check_threshold(self, current_value: float, threshold: float, operator: str, task_id: str) -> Dict[str, Any]:
        """Check if current value crosses the threshold"""
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
    
    def _get_sample_trading_html(self) -> str:
        """Get sample HTML with the hardcoded trading element"""
        return """
        <div class="trading-interface">
            <div class="_change_1dqlt_76 _colorSell_1dqlt_8">
                <span>-2.45%</span>
            </div>
        </div>
        """
    
    async def start_trading_monitor(
        self,
        task_id: str,
        threshold: float,
        operator: str = "<",
        continuous: bool = True
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Quick start method for monitoring the hardcoded trading element
        
        Args:
            task_id: Unique task identifier
            threshold: Alert threshold (e.g., -5.0 for -5%)
            operator: Comparison operator (default: "<" for drops)
            continuous: Keep monitoring
            
        Yields:
            Trading monitoring results and alerts
        """
        self.logger.info(f"🚀 Starting trading monitor: {operator} {threshold}%")
        
        async for result in self.start_dom_seek(
            task_id=task_id,
            threshold=threshold,
            operator=operator,
            html_content=None,  # Use sample HTML
            continuous=continuous,
            check_interval=2
        ):
            yield result
    
    def stop_seek(self, task_id: str):
        """Stop monitoring for a specific task"""
        self.active_seeks[task_id] = False
        if task_id in self.dom_thresholds:
            del self.dom_thresholds[task_id]
        self.logger.info(f"Stopped monitoring for task {task_id}")


# Utility functions for parallel monitoring
async def run_parallel_monitors(seek_mode: SeekMode, monitor_configs: List[Dict[str, Any]]):
    """
    Run multiple DOM monitors in parallel
    
    Args:
        seek_mode: SeekMode instance
        monitor_configs: List of monitor configurations
    """
    tasks = []
    
    for config in monitor_configs:
        task = asyncio.create_task(
            run_single_monitor(seek_mode, config),
            name=config.get("name", config["task_id"])
        )
        tasks.append(task)
    
    # Run all monitors in parallel
    try:
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        print(f"Parallel monitoring error: {e}")

async def run_single_monitor(seek_mode: SeekMode, config: Dict[str, Any]):
    """Run a single DOM monitor"""
    task_id = config["task_id"]
    query = config["query"]
    html_content = config["html_content"]
    name = config.get("name", task_id)
    
    print(f"📊 Started {name} (Task: {task_id})")
    
    async for result in seek_mode.start_dom_seek(
        task_id=task_id,
        query=query,
        html_content=html_content,
        continuous=True,
        check_interval=config.get("check_interval", 2)
    ):
        if result["type"] == "threshold_crossed":
            element = result.get("element", {})
            print(f"🚨 [{name}] ALERT: Value {element.get('current_value')} crossed threshold!")
            
        elif result["type"] == "dom_status":
            element = result.get("element", {})
            print(f"📈 [{name}] Current: {element.get('current_value')} | Text: '{element.get('text_content')}'")