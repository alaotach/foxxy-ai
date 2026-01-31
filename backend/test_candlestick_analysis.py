"""
Test script for Candlestick Pattern Analysis
Analyzes the ETH/USDT chart and sends WhatsApp alerts
"""
import asyncio
import base64
from candlestick_analyzer import analyze_current_chart, TradingSeekMode
from datetime import datetime

# Sample screenshot data (you would replace this with actual screenshot)
SAMPLE_SCREENSHOT_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

async def test_eth_chart_analysis():
    """Test candlestick analysis for ETH/USDT chart"""
    
    print("🔍 ETH/USDT Candlestick Pattern Analysis")
    print("=" * 45)
    print("Current Market Data:")
    print("💰 Price: $2,691.60 (-1.89%)")
    print("📊 RSI: 44.17")
    print("📈 Asset: ETH/USDT")
    print("⏰ Time:", datetime.now().strftime("%H:%M:%S"))
    print()
    
    # Initialize trading analyzer
    trading_seek = TradingSeekMode()
    
    try:
        # Quick analysis of current chart
        print("🚀 Starting pattern analysis...")
        
        result = await trading_seek.quick_chart_analysis(
            screenshot_base64=SAMPLE_SCREENSHOT_BASE64,
            current_price=2691.60,  # ETH price from screenshot
            rsi=44.17,  # RSI from screenshot
            phone_number="+1234567890"  # Replace with actual WhatsApp number
        )
        
        if result.get("success"):
            print("✅ Analysis completed successfully!")
            print()
            
            patterns = result.get("patterns", [])
            print(f"📊 Patterns Detected: {len(patterns)}")
            
            for i, pattern in enumerate(patterns, 1):
                details = pattern["details"]
                print(f"  {i}. {pattern['pattern'].upper()}")
                print(f"     📝 {details['description']}")
                print(f"     📈 Prediction: {details['prediction']}")
                print(f"     🎯 Confidence: {details['confidence']}")
                print(f"     💹 Target: {details['target']}")
                print(f"     💪 Strength: {pattern.get('strength', 0):.0%}")
                print()
            
            print("📱 WhatsApp Status:")
            print(f"   Sent: {'✅ Yes' if result.get('whatsapp_sent') else '❌ No'}")
            print()
            
            print("📋 Full Analysis:")
            print("-" * 30)
            print(result.get("analysis_text", "No analysis available"))
            
        else:
            print(f"❌ Analysis failed: {result.get('error')}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

async def test_live_monitoring():
    """Test continuous chart monitoring"""
    
    print("\\n🔄 Live Chart Monitoring Test")
    print("=" * 35)
    print("⏰ Monitoring for 30 seconds...")
    
    trading_seek = TradingSeekMode()
    
    try:
        # Start live monitoring for 30 seconds
        async for result in trading_seek.start_chart_analysis(
            task_id="eth_live_monitor",
            screenshot_base64=SAMPLE_SCREENSHOT_BASE64,
            current_price=2691.60,
            rsi=44.17,
            phone_number="+1234567890",
            continuous=True,
            analysis_interval=10  # Analyze every 10 seconds
        ):
            print(f"📊 [{result.get('type')}] {result.get('message', 'Update')}")
            
            if result["type"] == "patterns_detected":
                patterns = result.get("patterns", [])
                print(f"   🔍 Found {len(patterns)} pattern(s)")
                print(f"   📱 WhatsApp: {'✅ Sent' if result.get('whatsapp_sent') else '❌ Failed'}")
            
            # Stop after 30 seconds for demo
            await asyncio.sleep(0.1)
            
            # Check if we should stop
            if datetime.now().second % 30 == 0:  # Simple time-based stop
                trading_seek.stop_analysis("eth_live_monitor")
                break
    
    except Exception as e:
        print(f"❌ Live monitoring failed: {e}")
    
    print("✅ Live monitoring test completed")

async def analyze_specific_patterns():
    """Test specific pattern recognition"""
    
    print("\\n🎯 Specific Pattern Analysis")
    print("=" * 35)
    
    # Test different market scenarios
    scenarios = [
        {"hour": 10, "price": 2700, "desc": "Morning Rally"},
        {"hour": 14, "price": 2680, "desc": "Afternoon Consolidation"}, 
        {"hour": 20, "price": 2660, "desc": "Evening Decline"}
    ]
    
    trading_seek = TradingSeekMode()
    
    for scenario in scenarios:
        print(f"📈 Scenario: {scenario['desc']}")
        print(f"   💰 Price: ${scenario['price']}")
        print(f"   ⏰ Hour: {scenario['hour']}:00")
        
        # Temporarily modify time for simulation
        import datetime as dt
        original_now = datetime.now
        test_time = dt.datetime.now().replace(hour=scenario['hour'])
        
        # Simulate analysis for this scenario
        patterns = trading_seek.pattern_analyzer._simulate_pattern_detection(
            scenario['price'], 
            scenario['hour']
        )
        
        if patterns:
            for pattern in patterns:
                details = pattern['details']
                print(f"   🔍 Pattern: {pattern['pattern']}")
                print(f"   📊 Prediction: {details['prediction']}")
                print(f"   🎯 Target: {details['target']}")
        else:
            print("   ❌ No patterns detected")
        
        print()

def show_usage_examples():
    """Show practical usage examples"""
    
    print("\\n💡 Usage Examples")
    print("=" * 25)
    
    print("# Quick chart analysis")
    print("result = await analyze_current_chart(screenshot_base64, '+1234567890')")
    print("print(result['analysis_text'])")
    print()
    
    print("# Live monitoring")
    print("trading_seek = TradingSeekMode()")
    print("async for result in trading_seek.start_chart_analysis(")
    print("    'monitor_1', screenshot, 2691.60, 44.17, '+1234567890'")
    print("):")
    print("    if result['type'] == 'patterns_detected':")
    print("        print('Patterns found!')")
    print()
    
    print("🔧 Key Features:")
    print("✅ Real-time pattern detection")
    print("✅ WhatsApp alerts with screenshots")
    print("✅ Technical analysis integration") 
    print("✅ Bullish/bearish predictions")
    print("✅ Risk management recommendations")

if __name__ == "__main__":
    print("🎯 ETH/USDT Candlestick Pattern Analyzer")
    print("Chart: Bybit ETH/USDT Spot Trading")
    print("=" * 50)
    
    async def run_all_tests():
        await test_eth_chart_analysis()
        await analyze_specific_patterns()
        await test_live_monitoring()
        show_usage_examples()
    
    asyncio.run(run_all_tests())