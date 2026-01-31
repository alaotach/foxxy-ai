"""
Stock Monitoring Demo - Test stock chart analysis and WhatsApp alerts
"""
import asyncio
import base64
from agent.agent_loop import agent_loop
from agent.seek_mode import seek_mode, send_whatsapp_message
from pathlib import Path


async def demo_stock_monitoring():
    """Demo: Monitor stock chart for technical signals"""
    print("\n" + "="*70)
    print("📈 STOCK MONITORING DEMO")
    print("="*70)
    
    task_id = "stock-monitor-demo"
    
    # Example analysis prompts
    analysis_prompts = [
        "RSI below 30 oversold condition",
        "MACD bullish crossover above signal line",
        "Price breaks above 20-day moving average with volume",
        "Support level breach with high volume",
        "Breakout above resistance with RSI above 70"
    ]
    
    print(f"🎯 Analysis Prompt: {analysis_prompts[0]}")
    print(f"📱 WhatsApp: +1234567890 (demo)")
    print(f"📸 Screenshot Interval: 10 seconds")
    print(f"📊 Stock Symbol: AAPL (demo)")
    print("\n⏳ Starting monitoring... (will run for 30 seconds)")
    
    # Start stock monitoring
    monitor_task = asyncio.create_task(
        _run_stock_monitoring(
            task_id,
            analysis_prompts[0],
            stock_symbol="AAPL",
            whatsapp_number="+1234567890"
        )
    )
    
    # Let it run for 30 seconds
    await asyncio.sleep(30)
    
    # Stop monitoring
    print(f"\n⏹️  Stopping stock monitoring...")
    await agent_loop.stop_seek_mode(task_id)
    
    # Wait for task to complete
    await monitor_task


async def _run_stock_monitoring(task_id, analysis_prompt, stock_symbol, whatsapp_number):
    """Helper to run stock monitoring"""
    signal_count = 0
    
    async for update in agent_loop.start_stock_monitoring(
        task_id=task_id,
        analysis_prompt=analysis_prompt,
        stock_symbol=stock_symbol,
        whatsapp_number=whatsapp_number,
        screenshot_interval=10
    ):
        update_type = update.get('type')
        
        if update_type == "stock_monitoring_started":
            print(f"✅ Started monitoring {stock_symbol}")
            
        elif update_type == "analyzing_chart":
            print(f"🔍 {update.get('message')}")
            
        elif update_type == "analysis_complete":
            analysis = update.get('analysis', {})
            signal_triggered = update.get('signal_triggered', False)
            
            print(f"📊 Analysis #{update.get('screenshot_count', 0)}:")
            print(f"   Signal: {'🚨 TRIGGERED' if signal_triggered else '⚪ No signal'}")
            print(f"   Price: {analysis.get('current_price', 'N/A')}")
            print(f"   Recommendation: {analysis.get('recommendation', 'N/A').upper()}")
            print(f"   Confidence: {analysis.get('confidence', 'N/A')}")
            
        elif update_type == "signal_alert":
            signal_count += 1
            print(f"\n🚨 SIGNAL ALERT #{signal_count}!")
            print(f"📱 WhatsApp sent: {update.get('whatsapp_sent')}")
            print(f"💬 Message: {update.get('message', '')[:100]}...")
            
        elif update_type == "screenshot_needed":
            print(f"📸 Screenshot needed - simulating...")
            # In production, take screenshot and update
            # await agent_loop.update_stock_screenshot(task_id, screenshot_base64)
            
        elif update_type in ["analysis_error", "monitoring_error"]:
            print(f"❌ Error: {update.get('error')}")
            
        elif update_type == "stock_monitoring_stopped":
            total = update.get('total_screenshots', 0)
            print(f"\n✅ Monitoring stopped. Total screenshots: {total}")
            break


async def demo_whatsapp_message():
    """Demo: Test WhatsApp message formatting"""
    print("\n" + "="*70)
    print("📱 WHATSAPP MESSAGE DEMO")
    print("="*70)
    
    # Example analysis data
    analysis_data = {
        "current_price": "$142.50",
        "recommendation": "buy",
        "confidence": "high",
        "reason": "RSI dropped to 28 (oversold) with bullish divergence",
        "technical_indicators": {
            "rsi": "28 (oversold)",
            "macd": "bullish crossover",
            "moving_averages": "price above 50-day SMA",
            "volume": "above average",
            "support_resistance": "bouncing off $140 support"
        }
    }
    
    # Test message formatting
    message = seek_mode._format_signal_message(
        stock_symbol="AAPL",
        analysis_prompt="RSI below 30 oversold condition",
        analysis_data=analysis_data
    )
    
    print("📱 Generated WhatsApp Message:")
    print("-" * 50)
    print(message)
    print("-" * 50)
    
    # Test sending
    print("\n📤 Testing message send...")
    success = await send_whatsapp_message(message, "+1234567890")
    print(f"✅ Send success: {success}")


async def demo_stock_analysis():
    """Demo: Test stock chart analysis without monitoring"""
    print("\n" + "="*70)
    print("🔬 STOCK ANALYSIS DEMO")
    print("="*70)
    
    from agent.seek_mode import StockAnalyzer
    
    analyzer = StockAnalyzer()
    
    # Example analysis prompts
    prompts = [
        "Check if RSI is below 30",
        "Look for MACD bullish crossover",
        "Identify support and resistance levels",
        "Analyze volume patterns",
        "Check for breakout patterns"
    ]
    
    # Mock screenshot (in production, use real chart screenshot)
    mock_screenshot = "mock_chart_screenshot_base64"
    
    for i, prompt in enumerate(prompts, 1):
        print(f"\n📊 Analysis {i}: {prompt}")
        
        result = await analyzer.analyze_stock_chart(
            screenshot_base64=mock_screenshot,
            analysis_prompt=prompt,
            stock_symbol="TSLA"
        )
        
        if result["success"]:
            analysis = result["analysis"]
            print(f"   ✅ Signal: {analysis.get('signal_triggered', False)}")
            print(f"   📈 Recommendation: {analysis.get('recommendation', 'N/A')}")
            print(f"   🎯 Confidence: {analysis.get('confidence', 'N/A')}")
            print(f"   💭 Reason: {analysis.get('reason', 'N/A')}")
        else:
            print(f"   ❌ Error: {result.get('error')}")


async def demo_screenshot_frequency():
    """Demo: Test different screenshot frequencies"""
    print("\n" + "="*70)
    print("📸 SCREENSHOT FREQUENCY DEMO")
    print("="*70)
    
    frequencies = [5, 10, 15, 30]  # seconds
    
    for freq in frequencies:
        print(f"\n⏱️  Testing {freq}-second interval:")
        
        task_id = f"freq-test-{freq}"
        
        # Start brief monitoring
        count = 0
        async for update in agent_loop.start_stock_monitoring(
            task_id=task_id,
            analysis_prompt="Test frequency",
            screenshot_interval=freq
        ):
            if update.get('type') == "analyzing_chart":
                count += 1
                print(f"   📸 Screenshot #{count} at {freq}s interval")
                
                if count >= 3:  # Stop after 3 screenshots
                    await agent_loop.stop_seek_mode(task_id)
                    break


async def interactive_stock_demo():
    """Interactive demo for manual testing"""
    print("\n" + "="*70)
    print("🎮 INTERACTIVE STOCK MONITORING")
    print("="*70)
    print("Commands:")
    print("  start <symbol> <prompt>  - Start monitoring")
    print("  screenshot <task_id>     - Update screenshot")
    print("  stop <task_id>          - Stop monitoring")
    print("  status                   - Show active tasks")
    print("  quit                     - Exit")
    print("="*70)
    
    active_tasks = {}
    
    while True:
        try:
            command = input("\n📈 > ").strip()
            
            if not command:
                continue
                
            if command == "quit":
                # Stop all active tasks
                for task_id in list(active_tasks.keys()):
                    await agent_loop.stop_seek_mode(task_id)
                break
            
            parts = command.split(" ", 2)
            cmd = parts[0].lower()
            
            if cmd == "start" and len(parts) >= 3:
                symbol = parts[1].upper()
                prompt = parts[2]
                task_id = f"interactive-{symbol.lower()}"
                
                print(f"🚀 Starting monitoring for {symbol}...")
                active_tasks[task_id] = symbol
                
                # Start monitoring in background
                asyncio.create_task(_monitor_stock_interactive(task_id, symbol, prompt))
                
            elif cmd == "screenshot" and len(parts) >= 2:
                task_id = parts[1]
                if task_id in active_tasks:
                    print(f"📸 Screenshot updated for {task_id}")
                    # In production: await agent_loop.update_stock_screenshot(task_id, screenshot)
                else:
                    print(f"❌ Task {task_id} not found")
                    
            elif cmd == "stop" and len(parts) >= 2:
                task_id = parts[1]
                if task_id in active_tasks:
                    await agent_loop.stop_seek_mode(task_id)
                    del active_tasks[task_id]
                    print(f"⏹️  Stopped monitoring {task_id}")
                else:
                    print(f"❌ Task {task_id} not found")
                    
            elif cmd == "status":
                if active_tasks:
                    print(f"📊 Active tasks:")
                    for task_id, symbol in active_tasks.items():
                        print(f"   • {task_id} ({symbol})")
                else:
                    print("📭 No active monitoring tasks")
            else:
                print("❌ Invalid command")
                
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}")


async def _monitor_stock_interactive(task_id, symbol, prompt):
    """Helper for interactive monitoring"""
    try:
        async for update in agent_loop.start_stock_monitoring(
            task_id=task_id,
            analysis_prompt=prompt,
            stock_symbol=symbol,
            screenshot_interval=15
        ):
            if update.get('type') == "signal_alert":
                print(f"\n🚨 {symbol} SIGNAL! {update.get('message', '')[:50]}...")
    except Exception as e:
        print(f"❌ Monitoring error for {symbol}: {e}")


async def run_all_demos():
    """Run all stock monitoring demos"""
    print("\n📈 Starting Stock Monitoring Demos")
    print("="*70)
    
    try:
        await demo_stock_analysis()
        await demo_whatsapp_message() 
        await demo_screenshot_frequency()
        # await demo_stock_monitoring()  # Uncomment for full 30-second test
        
        print("\n" + "="*70)
        print("✅ All demos completed!")
        print("="*70)
        print("\n💡 To test with real data:")
        print("   1. Navigate to a stock chart website")
        print("   2. Take a screenshot")
        print("   3. Use the screenshot in stock monitoring")
        print("   4. Set up WhatsApp API integration")
        
    except Exception as e:
        print(f"\n❌ Error during demos: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        asyncio.run(interactive_stock_demo())
    else:
        asyncio.run(run_all_demos())