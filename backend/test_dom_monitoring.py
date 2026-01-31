"""
Test script for DOM-based threshold monitoring
Demonstrates monitoring CSS class elements for value changes
"""
import asyncio
import json
from agent.seek_mode import SeekMode
from datetime import datetime

async def test_dom_threshold_monitoring():
    """Test the DOM threshold monitoring functionality"""
    
    print("🔍 Testing DOM Threshold Monitoring")
    print("=" * 50)
    
    # Initialize seek mode
    seek_mode = SeekMode()
    
    # Test scenarios for the specified CSS class: _change_1dqlt_76 _colorSell_1dqlt_8
    test_scenarios = [
        {
            "name": "Price Change Greater Than 10%",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|10|>",
            "description": "Alert when price change > 10%"
        },
        {
            "name": "Price Change Less Than -5%",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|-5|<", 
            "description": "Alert when price change < -5%"
        },
        {
            "name": "Absolute Change Greater Than 3%",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|3|>=",
            "description": "Alert when |price change| >= 3%"
        }
    ]
    
    print("📊 Testing DOM Monitoring Scenarios:")
    print("Target CSS Class: ._change_1dqlt_76._colorSell_1dqlt_8 span")
    print("This monitors span elements within the specified trading interface class")
    print()
    
    # Test each scenario
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"📈 Test {i}: {scenario['name']}")
        print(f"   Query: {scenario['query']}")
        print(f"   Description: {scenario['description']}")
        print("-" * 40)
        
        task_id = f"dom_test_{i}"
        
        try:
            # Start DOM threshold monitoring (non-continuous for demo)
            results = []
            async for result in seek_mode.start_seek(
                task_id=task_id,
                seek_type="dom",
                query=scenario["query"],
                action="alert",
                continuous=False,  # Set to True for continuous monitoring
                screenshot_interval=2
            ):
                results.append(result)
                
                print(f"📋 Result Type: {result['type']}")
                
                if result["type"] == "dom_monitoring_started":
                    print(f"✅ Started monitoring: {result['message']}")
                    config = result.get('config', {})
                    print(f"   CSS Selector: {config.get('css_selector')}")
                    print(f"   Threshold: {config.get('operator')} {config.get('threshold')}")
                    
                elif result["type"] == "threshold_crossed":
                    print(f"🚨 THRESHOLD ALERT!")
                    element = result.get('element', {})
                    print(f"   Current Value: {element.get('current_value')}")
                    print(f"   Threshold: {element.get('operator')} {element.get('threshold')}")
                    print(f"   Text Content: '{element.get('text_content')}'")
                    print(f"   Time: {result.get('timestamp')}")
                    
                elif result["type"] == "dom_status":
                    element = result.get('element', {})
                    print(f"📊 Current Status:")
                    print(f"   Value: {element.get('current_value')}")
                    print(f"   Text: '{element.get('text_content')}'")
                    print(f"   Threshold Met: {element.get('threshold_crossed')}")
                    
                elif result["type"] == "dom_element_not_found":
                    print(f"❌ Element not found: {result['message']}")
                    
                elif result["type"] == "dom_error":
                    print(f"❌ Error: {result['error']}")
            
            print(f"📋 Test {i} completed with {len(results)} results\\n")
            
        except Exception as e:
            print(f"❌ Test {i} failed: {e}\\n")

async def demo_parallel_monitoring():
    """Demonstrate parallel monitoring of multiple DOM elements"""
    
    print("🔄 Parallel DOM Monitoring Demo")
    print("=" * 50)
    
    seek_mode = SeekMode()
    
    # Multiple parallel monitoring tasks
    monitoring_tasks = [
        {
            "task_id": "price_monitor_1",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|5|>",
            "name": "Price > 5%"
        },
        {
            "task_id": "price_monitor_2", 
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|-3|<",
            "name": "Price < -3%"
        },
        {
            "task_id": "volume_monitor",
            "query": ".volume-indicator span|1000000|>",
            "name": "Volume > 1M"
        }
    ]
    
    print("🚀 Starting parallel monitoring tasks...")
    
    # Create parallel monitoring tasks
    tasks = []
    for monitor in monitoring_tasks:
        task = asyncio.create_task(
            run_single_monitor(seek_mode, monitor),
            name=monitor["name"]
        )
        tasks.append(task)
    
    # Run all monitors in parallel for 30 seconds
    try:
        await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=30.0
        )
    except asyncio.TimeoutError:
        print("⏰ Parallel monitoring demo completed after 30 seconds")
        
        # Stop all active seeks
        for monitor in monitoring_tasks:
            seek_mode.active_seeks[monitor["task_id"]] = False
    
    print("✅ Parallel monitoring demo finished")

async def run_single_monitor(seek_mode: SeekMode, monitor_config: dict):
    """Run a single DOM monitor"""
    task_id = monitor_config["task_id"]
    query = monitor_config["query"]
    name = monitor_config["name"]
    
    print(f"📊 Started {name} (Task: {task_id})")
    
    async for result in seek_mode.start_seek(
        task_id=task_id,
        seek_type="dom",
        query=query,
        action="alert",
        continuous=True,
        screenshot_interval=3
    ):
        if result["type"] == "threshold_crossed":
            element = result.get('element', {})
            print(f"🚨 [{name}] ALERT: Value {element.get('current_value')} crossed threshold!")
            
        elif result["type"] == "dom_status":
            element = result.get('element', {})
            print(f"📈 [{name}] Current: {element.get('current_value')} | Text: '{element.get('text_content')}'")

async def show_integration_examples():
    """Show how to integrate DOM monitoring with other systems"""
    
    print("\\n🔗 Integration Examples")
    print("=" * 50)
    
    examples = [
        {
            "title": "Trading Alert System",
            "css_selector": "._change_1dqlt_76._colorSell_1dqlt_8 span",
            "threshold": "5|>",
            "use_case": "Monitor stock price changes and send WhatsApp alerts when > 5%",
            "integration": "Combine with WhatsApp API for instant notifications"
        },
        {
            "title": "Portfolio Risk Monitoring", 
            "css_selector": ".portfolio-total .percentage",
            "threshold": "-10|<",
            "use_case": "Alert when portfolio drops below -10%",
            "integration": "Integrate with risk management systems"
        },
        {
            "title": "Volatility Tracking",
            "css_selector": ".volatility-indicator span",
            "threshold": "20|>=", 
            "use_case": "Monitor market volatility for trading opportunities",
            "integration": "Connect to automated trading systems"
        }
    ]
    
    for example in examples:
        print(f"📊 {example['title']}")
        print(f"   CSS Selector: {example['css_selector']}")
        print(f"   Threshold: {example['threshold']}")
        print(f"   Use Case: {example['use_case']}")
        print(f"   Integration: {example['integration']}")
        print()
    
    print("🔧 API Usage Examples:")
    print()
    
    # WebSocket example
    print("📡 WebSocket Real-time Monitoring:")
    print("ws://localhost:8000/api/seek/ws/{task_id}")
    print("Send: {")
    print('  "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|10|>",')
    print('  "seek_type": "dom",')
    print('  "action": "alert",')
    print('  "continuous": true')
    print("}")
    print()
    
    # REST API example
    print("🌐 REST API One-shot Check:")
    print("POST /api/seek/start")
    print("{")
    print('  "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|5|<",')
    print('  "seek_type": "dom",')
    print('  "action": "alert",')
    print('  "continuous": false')
    print("}")

if __name__ == "__main__":
    print("🎯 DOM Threshold Monitoring Test Suite")
    print("Target: ._change_1dqlt_76._colorSell_1dqlt_8 span elements")
    print("=" * 60)
    
    asyncio.run(test_dom_threshold_monitoring())
    asyncio.run(demo_parallel_monitoring()) 
    asyncio.run(show_integration_examples())