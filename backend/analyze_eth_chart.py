"""
Quick ETH/USDT Chart Analysis
Analyzes the current chart and sends WhatsApp alert
"""
import asyncio
from candlestick_analyzer import TradingSeekMode
from datetime import datetime

async def analyze_eth_chart_now():
    """Analyze the current ETH/USDT chart from the screenshot"""
    
    print("🔍 ETH/USDT Chart Analysis - Live Trading Signal")
    print("=" * 55)
    
    # Current market data from the screenshot
    current_price = 2691.60
    price_change = -1.89  # -1.89%
    rsi = 44.17
    volume_sma = "2.24K"
    
    print(f"📊 Current Market Status:")
    print(f"   💰 ETH/USDT: ${current_price:,.2f} ({price_change:+.2f}%)")
    print(f"   📈 RSI: {rsi}")
    print(f"   📊 Volume SMA: {volume_sma}")
    print(f"   ⏰ Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Initialize analyzer
    trading_seek = TradingSeekMode()
    
    # Simulate screenshot (in real usage, you'd capture the actual chart)
    fake_screenshot = "chart_screenshot_base64_data_here"
    
    try:
        print("🚀 Running candlestick pattern analysis...")
        
        result = await trading_seek.quick_chart_analysis(
            screenshot_base64=fake_screenshot,
            current_price=current_price,
            rsi=rsi,
            phone_number="+1234567890"  # Replace with your WhatsApp number
        )
        
        if result.get("success"):
            print("✅ Analysis Complete!")
            print()
            
            patterns = result.get("patterns", [])
            
            print(f"🔍 PATTERNS DETECTED: {len(patterns)}")
            print("-" * 30)
            
            for i, pattern in enumerate(patterns, 1):
                details = pattern["details"]
                strength = pattern.get("strength", 0.5)
                
                print(f"{i}. {pattern['pattern'].replace('_', ' ').title()}")
                print(f"   📝 Description: {details['description']}")
                print(f"   📊 Prediction: {details['prediction']}")
                print(f"   🎯 Confidence: {details['confidence']}")
                print(f"   💹 Price Target: {details['target']}")
                print(f"   💪 Pattern Strength: {strength:.0%}")
                print(f"   📍 Location: {pattern.get('location', 'recent candles')}")
                print()
            
            # Market Context Analysis
            print("🧠 MARKET CONTEXT ANALYSIS:")
            print("-" * 30)
            
            if rsi < 30:
                print("📉 RSI OVERSOLD (< 30) - Potential bounce incoming")
            elif rsi > 70:
                print("📈 RSI OVERBOUGHT (> 70) - Potential correction")
            elif 40 <= rsi <= 60:
                print("⚖️ RSI NEUTRAL (40-60) - No extreme conditions")
            else:
                print(f"📊 RSI at {rsi} - Moderate trend conditions")
            
            if price_change < -2:
                print("📉 Significant daily decline - Watch for reversal patterns")
            elif price_change > 2:
                print("📈 Strong daily gain - Watch for continuation")
            else:
                print("⚖️ Modest price movement - Range-bound action")
            
            print()
            
            # Trading Recommendation
            print("🎯 TRADING RECOMMENDATION:")
            print("-" * 30)
            
            bullish_signals = 0
            bearish_signals = 0
            
            for pattern in patterns:
                if pattern["details"]["prediction"] == "BULLISH":
                    bullish_signals += 1
                elif pattern["details"]["prediction"] == "BEARISH": 
                    bearish_signals += 1
            
            if rsi < 35:
                bullish_signals += 1
            elif rsi > 65:
                bearish_signals += 1
            
            if price_change < -2:
                bullish_signals += 0.5  # Oversold bounce potential
            
            if bullish_signals > bearish_signals:
                print("📈 BULLISH OUTLOOK - Consider LONG positions")
                print(f"   🎯 Entry: ${current_price:,.2f}")
                print(f"   🔴 Stop Loss: ${current_price * 0.97:,.2f} (-3%)")
                print(f"   🟢 Take Profit: ${current_price * 1.05:,.2f} (+5%)")
            elif bearish_signals > bullish_signals:
                print("📉 BEARISH OUTLOOK - Consider SHORT positions")
                print(f"   🎯 Entry: ${current_price:,.2f}")
                print(f"   🔴 Stop Loss: ${current_price * 1.03:,.2f} (+3%)")
                print(f"   🟢 Take Profit: ${current_price * 0.95:,.2f} (-5%)")
            else:
                print("⚖️ NEUTRAL - Wait for clearer directional signals")
                print("   🎯 Watch for breakout above resistance or below support")
            
            print()
            print("⚠️ RISK MANAGEMENT:")
            print("   • Use appropriate position sizing (1-2% risk per trade)")
            print("   • Set stop losses before entering")
            print("   • Monitor volume for confirmation")
            print("   • Consider market news and events")
            
            print()
            print("📱 WhatsApp Alert Status:")
            if result.get("whatsapp_sent"):
                print("   ✅ Analysis sent to WhatsApp successfully!")
                print("   📊 Screenshot included with technical details")
            else:
                print("   ❌ WhatsApp sending failed (check configuration)")
            
        else:
            print(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()

async def start_continuous_monitoring():
    """Start continuous monitoring of ETH chart"""
    
    print("\\n🔄 Starting Continuous Chart Monitoring")
    print("=" * 45)
    print("⏰ Will analyze chart every 60 seconds...")
    print("📱 WhatsApp alerts will be sent when patterns change")
    print("🛑 Press Ctrl+C to stop monitoring")
    print()
    
    trading_seek = TradingSeekMode()
    fake_screenshot = "chart_screenshot_base64_data_here"
    
    try:
        async for result in trading_seek.start_chart_analysis(
            task_id="eth_continuous_monitor",
            screenshot_base64=fake_screenshot,
            current_price=2691.60,
            rsi=44.17,
            phone_number="+1234567890",  # Replace with your number
            continuous=True,
            analysis_interval=60  # Analyze every 60 seconds
        ):
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            if result["type"] == "patterns_detected":
                patterns = result.get("patterns", [])
                print(f"📊 [{timestamp}] New patterns detected: {len(patterns)}")
                
                for pattern in patterns:
                    prediction = pattern["details"]["prediction"]
                    emoji = "📈" if prediction == "BULLISH" else "📉" if prediction == "BEARISH" else "⚖️"
                    print(f"   {emoji} {pattern['pattern']} - {prediction}")
                
                if result.get("whatsapp_sent"):
                    print(f"   📱 WhatsApp alert sent successfully")
                
            elif result["type"] == "no_patterns":
                print(f"📊 [{timestamp}] No significant patterns - monitoring continues...")
                
            elif result["type"] == "analysis_error":
                print(f"❌ [{timestamp}] Analysis error: {result.get('error')}")
            
            print()
            
    except KeyboardInterrupt:
        print("\\n🛑 Monitoring stopped by user")
        trading_seek.stop_analysis("eth_continuous_monitor")
    except Exception as e:
        print(f"❌ Monitoring error: {e}")

if __name__ == "__main__":
    print("🎯 ETH/USDT Live Chart Analysis & WhatsApp Alerts")
    print("Current Chart: Bybit ETH/USDT Spot")
    print("=" * 60)
    
    # Run immediate analysis
    asyncio.run(analyze_eth_chart_now())
    
    # Ask user if they want continuous monitoring
    print("\\n" + "=" * 60)
    response = input("Start continuous monitoring? (y/n): ").lower().strip()
    
    if response == 'y':
        try:
            asyncio.run(start_continuous_monitoring())
        except KeyboardInterrupt:
            print("\\n👋 Monitoring stopped. Goodbye!")
    else:
        print("👋 Analysis complete. Goodbye!")