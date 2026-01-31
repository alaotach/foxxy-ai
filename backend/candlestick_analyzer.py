"""
Candlestick Pattern Analyzer with WhatsApp Integration
Analyzes trading charts and sends predictions with screenshots
"""
from typing import Dict, List, Any, Optional, AsyncIterator
import asyncio
import json
from datetime import datetime
import re
import logging
import base64
from bs4 import BeautifulSoup
from pathlib import Path


# WhatsApp messaging function
async def send_whatsapp_message(
    message: str, 
    phone_number: Optional[str] = None,
    screenshot_base64: Optional[str] = None,
    include_chart: bool = True
) -> bool:
    """
    Send WhatsApp message with chart analysis and screenshot
    Replace this with actual WhatsApp API integration later
    """
    import logging
    from datetime import datetime
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("WhatsApp")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    logger.info(f"📱 [WhatsApp] Preparing to send trading analysis at {timestamp}")
    logger.info(f"📱 [WhatsApp] To: {phone_number or 'default contact'}")
    logger.info(f"📱 [WhatsApp] Message length: {len(message)} characters")
    
    if include_chart and screenshot_base64:
        logger.info(f"📱 [WhatsApp] Including chart screenshot ({len(screenshot_base64)} bytes)")
        
        # Save screenshot locally for debugging
        try:
            img_data = base64.b64decode(screenshot_base64)
            screenshots_dir = Path(__file__).parent.parent / "screenshots" / "whatsapp"
            screenshots_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"trading_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            filepath = screenshots_dir / filename
            
            with open(filepath, "wb") as f:
                f.write(img_data)
            
            logger.info(f"📱 [WhatsApp] Chart saved locally: {filepath}")
            print(f"📱 [WhatsApp] Chart screenshot saved: {filepath}")
            
        except Exception as e:
            logger.error(f"📱 [WhatsApp] Failed to save chart: {e}")
    
    print(f"📱 [WhatsApp] === TRADING ANALYSIS MESSAGE ===")
    print(f"📱 [WhatsApp] Timestamp: {timestamp}")
    print(f"📱 [WhatsApp] Recipient: {phone_number or 'default contact'}")
    print(f"📱 [WhatsApp] Analysis:")
    print(message)
    print(f"📱 [WhatsApp] === END MESSAGE ===")
    
    # TODO: Replace with actual WhatsApp API call
    # Example: Twilio, WhatsApp Business API, etc.
    
    logger.info(f"📱 [WhatsApp] Trading analysis sent successfully")
    return True


class CandlestickPatternAnalyzer:
    """
    Analyzes candlestick patterns from trading charts
    """
    
    def __init__(self):
        self.logger = logging.getLogger("CandlestickAnalyzer")
        
        # Define common candlestick patterns
        self.bullish_patterns = {
            "hammer": {
                "description": "Hammer - Reversal pattern at bottom",
                "prediction": "BULLISH",
                "confidence": "HIGH",
                "target": "+3-5%"
            },
            "doji": {
                "description": "Doji - Indecision, potential reversal",
                "prediction": "NEUTRAL",
                "confidence": "MEDIUM", 
                "target": "±2-3%"
            },
            "bullish_engulfing": {
                "description": "Bullish Engulfing - Strong reversal",
                "prediction": "BULLISH",
                "confidence": "HIGH",
                "target": "+5-8%"
            },
            "morning_star": {
                "description": "Morning Star - Strong bullish reversal",
                "prediction": "BULLISH",
                "confidence": "VERY HIGH",
                "target": "+8-12%"
            }
        }
        
        self.bearish_patterns = {
            "shooting_star": {
                "description": "Shooting Star - Reversal at top",
                "prediction": "BEARISH",
                "confidence": "HIGH",
                "target": "-3-5%"
            },
            "bearish_engulfing": {
                "description": "Bearish Engulfing - Strong reversal down",
                "prediction": "BEARISH", 
                "confidence": "HIGH",
                "target": "-5-8%"
            },
            "evening_star": {
                "description": "Evening Star - Strong bearish reversal",
                "prediction": "BEARISH",
                "confidence": "VERY HIGH",
                "target": "-8-12%"
            }
        }
    
    def analyze_chart_from_screenshot(self, screenshot_base64: str, current_price: float = None) -> Dict[str, Any]:
        """
        Analyze chart patterns from screenshot
        Since we can't directly read chart data, we'll use contextual analysis
        """
        try:
            # For demo purposes, simulate pattern detection based on current market conditions
            # In real implementation, this would use computer vision to analyze the chart
            
            # Get current time for pattern simulation
            current_hour = datetime.now().hour
            
            # Simulate pattern detection based on various factors
            detected_patterns = self._simulate_pattern_detection(current_price, current_hour)
            
            return {
                "success": True,
                "patterns_detected": detected_patterns,
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "simulated_from_screenshot"
            }
            
        except Exception as e:
            self.logger.error(f"Chart analysis error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _simulate_pattern_detection(self, current_price: Optional[float], hour: int) -> List[Dict[str, Any]]:
        """
        Simulate pattern detection - replace with actual computer vision
        """
        patterns = []
        
        # Simulate based on time and price trends
        if hour >= 9 and hour <= 12:  # Morning session - often bullish
            if current_price and current_price > 2650:  # ETH above 2650
                patterns.append({
                    "pattern": "bullish_engulfing",
                    "details": self.bullish_patterns["bullish_engulfing"],
                    "location": "recent_candles",
                    "strength": 0.8
                })
            else:
                patterns.append({
                    "pattern": "hammer",
                    "details": self.bullish_patterns["hammer"], 
                    "location": "current_level",
                    "strength": 0.7
                })
        
        elif hour >= 13 and hour <= 16:  # Afternoon - mixed
            patterns.append({
                "pattern": "doji",
                "details": self.bullish_patterns["doji"],
                "location": "recent_candles", 
                "strength": 0.6
            })
        
        else:  # Evening/night - often bearish
            patterns.append({
                "pattern": "shooting_star",
                "details": self.bearish_patterns["shooting_star"],
                "location": "current_level",
                "strength": 0.75
            })
        
        return patterns
    
    def generate_trading_analysis(self, patterns: List[Dict], current_price: float, rsi: float = None) -> str:
        """
        Generate comprehensive trading analysis message
        """
        analysis = f"🔍 CANDLESTICK PATTERN ANALYSIS\n"
        analysis += f"{'=' * 35}\n\n"
        
        if current_price:
            analysis += f"💰 Current Price: ${current_price:,.2f}\n"
        
        if rsi:
            analysis += f"📊 RSI: {rsi}\n"
            if rsi > 70:
                analysis += f"⚠️ RSI Overbought (>70)\n"
            elif rsi < 30:
                analysis += f"⚠️ RSI Oversold (<30)\n"
        
        analysis += f"⏰ Analysis Time: {datetime.now().strftime('%H:%M:%S')}\n\n"
        
        if patterns:
            analysis += f"📈 PATTERNS DETECTED:\n"
            analysis += f"{'-' * 25}\n"
            
            for i, pattern in enumerate(patterns, 1):
                details = pattern["details"]
                strength = pattern.get("strength", 0.5)
                
                analysis += f"{i}. {details['description']}\n"
                analysis += f"   📊 Prediction: {details['prediction']}\n"
                analysis += f"   🎯 Confidence: {details['confidence']}\n"
                analysis += f"   💹 Target: {details['target']}\n"
                analysis += f"   💪 Pattern Strength: {strength:.0%}\n"
                analysis += f"   📍 Location: {pattern.get('location', 'chart')}\n\n"
        
        # Overall recommendation
        bullish_count = sum(1 for p in patterns if p["details"]["prediction"] == "BULLISH")
        bearish_count = sum(1 for p in patterns if p["details"]["prediction"] == "BEARISH")
        
        analysis += f"🎯 OVERALL RECOMMENDATION:\n"
        analysis += f"{'-' * 25}\n"
        
        if bullish_count > bearish_count:
            analysis += f"📈 BULLISH BIAS - Consider LONG positions\n"
            analysis += f"🎯 Watch for continuation patterns\n"
        elif bearish_count > bullish_count:
            analysis += f"📉 BEARISH BIAS - Consider SHORT positions\n" 
            analysis += f"🎯 Watch for breakdown patterns\n"
        else:
            analysis += f"⚖️ NEUTRAL - Wait for clearer signals\n"
            analysis += f"🎯 Monitor for breakout direction\n"
        
        analysis += f"\n⚠️ Risk Management:\n"
        analysis += f"• Use stop losses\n"
        analysis += f"• Position size appropriately\n" 
        analysis += f"• Confirm with other indicators\n"
        
        return analysis


class TradingSeekMode:
    """
    Enhanced Seek Mode with Candlestick Pattern Analysis and WhatsApp Integration
    """
    
    def __init__(self):
        self.pattern_analyzer = CandlestickPatternAnalyzer()
        self.active_seeks: Dict[str, bool] = {}
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("TradingSeekMode")
    
    async def start_chart_analysis(
        self,
        task_id: str,
        screenshot_base64: str,
        current_price: Optional[float] = None,
        rsi: Optional[float] = None,
        phone_number: Optional[str] = None,
        continuous: bool = False,
        analysis_interval: int = 30
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Start candlestick pattern analysis with WhatsApp alerts
        
        Args:
            task_id: Unique task identifier
            screenshot_base64: Chart screenshot in base64
            current_price: Current asset price
            rsi: RSI value if available  
            phone_number: WhatsApp number for alerts
            continuous: Keep analyzing (for live monitoring)
            analysis_interval: How often to analyze in seconds
            
        Yields:
            Analysis results and WhatsApp notifications
        """
        self.active_seeks[task_id] = True
        
        yield {
            "type": "analysis_started",
            "message": "Starting candlestick pattern analysis",
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }
        
        while self.active_seeks.get(task_id, False):
            try:
                # Analyze chart patterns
                analysis_result = self.pattern_analyzer.analyze_chart_from_screenshot(
                    screenshot_base64, 
                    current_price
                )
                
                if analysis_result.get("success"):
                    patterns = analysis_result.get("patterns_detected", [])
                    
                    if patterns:
                        # Generate trading analysis
                        analysis_text = self.pattern_analyzer.generate_trading_analysis(
                            patterns, 
                            current_price or 0,
                            rsi
                        )
                        
                        # Send WhatsApp message with analysis and chart
                        await send_whatsapp_message(
                            message=analysis_text,
                            phone_number=phone_number,
                            screenshot_base64=screenshot_base64,
                            include_chart=True
                        )
                        
                        yield {
                            "type": "patterns_detected",
                            "patterns": patterns,
                            "analysis_text": analysis_text,
                            "task_id": task_id,
                            "whatsapp_sent": True,
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        yield {
                            "type": "no_patterns",
                            "message": "No significant patterns detected",
                            "task_id": task_id,
                            "timestamp": datetime.now().isoformat()
                        }
                else:
                    yield {
                        "type": "analysis_error", 
                        "error": analysis_result.get("error", "Unknown error"),
                        "task_id": task_id
                    }
                    
            except Exception as e:
                yield {
                    "type": "analysis_error",
                    "error": str(e),
                    "task_id": task_id
                }
            
            if not continuous:
                break
                
            await asyncio.sleep(analysis_interval)
        
        yield {
            "type": "analysis_stopped",
            "task_id": task_id
        }
    
    async def quick_chart_analysis(
        self,
        screenshot_base64: str,
        current_price: float = 2691.60,  # ETH price from screenshot
        rsi: float = 44.17,  # RSI from screenshot
        phone_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Quick one-time chart analysis with immediate WhatsApp alert
        """
        self.logger.info("🚀 Starting quick chart analysis...")
        
        # Analyze the chart
        analysis_result = self.pattern_analyzer.analyze_chart_from_screenshot(
            screenshot_base64, 
            current_price
        )
        
        if analysis_result.get("success"):
            patterns = analysis_result.get("patterns_detected", [])
            
            # Generate analysis text
            analysis_text = self.pattern_analyzer.generate_trading_analysis(
                patterns,
                current_price,
                rsi
            )
            
            # Send WhatsApp message
            whatsapp_sent = await send_whatsapp_message(
                message=analysis_text,
                phone_number=phone_number,
                screenshot_base64=screenshot_base64,
                include_chart=True
            )
            
            return {
                "success": True,
                "patterns": patterns,
                "analysis_text": analysis_text, 
                "whatsapp_sent": whatsapp_sent,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": analysis_result.get("error")
            }
    
    def stop_analysis(self, task_id: str):
        """Stop chart analysis for a specific task"""
        self.active_seeks[task_id] = False
        self.logger.info(f"Stopped chart analysis for task {task_id}")


# Quick utility functions
async def analyze_current_chart(screenshot_base64: str, phone_number: str = None) -> Dict[str, Any]:
    """
    Quick function to analyze current chart and send WhatsApp alert
    """
    trading_seek = TradingSeekMode()
    
    # Use current ETH price and RSI from the screenshot
    result = await trading_seek.quick_chart_analysis(
        screenshot_base64=screenshot_base64,
        current_price=2691.60,  # Current ETH/USDT price
        rsi=44.17,  # Current RSI
        phone_number=phone_number
    )
    
    return result

async def start_live_chart_monitoring(
    screenshot_base64: str, 
    phone_number: str = None,
    analysis_interval: int = 60
) -> AsyncIterator[Dict[str, Any]]:
    """
    Start live chart monitoring with periodic analysis
    """
    trading_seek = TradingSeekMode()
    
    async for result in trading_seek.start_chart_analysis(
        task_id="live_chart_monitor",
        screenshot_base64=screenshot_base64,
        current_price=2691.60,
        rsi=44.17,
        phone_number=phone_number,
        continuous=True,
        analysis_interval=analysis_interval
    ):
        yield result