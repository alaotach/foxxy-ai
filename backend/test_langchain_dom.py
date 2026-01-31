"""
Test script for Simple DOM threshold monitoring
Demonstrates monitoring the hardcoded CSS class: ._change_1dqlt_76._colorSell_1dqlt_8 span
No external dependencies - uses BeautifulSoup only
"""
import asyncio
import logging
from typing import Dict, Any
from agent.seek_mode_simple import SeekMode, run_parallel_monitors

# Sample HTML content that includes the target CSS class
SAMPLE_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Trading Interface</title>
</head>
<body>
    <div class="trading-dashboard">
        <div class="_change_1dqlt_76 _colorSell_1dqlt_8">
            <span>-2.45%</span>
        </div>
        <div class="_change_1dqlt_76 _colorBuy_1dqlt_9">
            <span>+1.23%</span>
        </div>
        <div class="price-display">
            <span>$156.78</span>
        </div>
        <div class="volume-indicator">
            <span>1,234,567</span>
        </div>
    </div>
</body>
</html>
"""

async def test_hardcoded_trading_monitor():
    """Test the hardcoded trading element monitoring"""
    
    print("🔍 Testing Hardcoded Trading Element Monitor")
    print("=" * 50)
    print("Hardcoded CSS Class: ._change_1dqlt_76 _colorSell_1dqlt_8 span")
    print("No configuration required - just specify threshold!")
    print()
    
    # Initialize seek mode
    seek_mode = SeekMode()
    
    # Test scenarios with simple threshold values
    test_scenarios = [
        {
            "name": "Price Drop Alert",
            "threshold": -2.0,
            "operator": "<",
            "description": "Alert when price drops below -2%"
        },
        {
            "name": "Big Drop Alert",
            "threshold": -5.0,
            "operator": "<",
            "description": "Alert when price drops below -5%"
        },
        {
            "name": "Small Rise Alert",
            "threshold": 1.0,
            "operator": ">", 
            "description": "Alert when price rises above 1%"
        }
    ]
    
    print("📊 Testing Hardcoded Trading Monitor:")
    print()
    
    # Test each scenario
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"📈 Test {i}: {scenario['name']}")
        print(f"   Threshold: {scenario['operator']} {scenario['threshold']}%")
        print(f"   Description: {scenario['description']}")
        print("-" * 40)
        
        task_id = f"trading_test_{i}"
        
        try:
            # Start trading monitoring with hardcoded element
            results = []
            async for result in seek_mode.start_trading_monitor(
                task_id=task_id,
                threshold=scenario["threshold"],
                operator=scenario["operator"],
                continuous=False  # Single check for demo
            ):
                results.append(result)
                
                print(f"📋 Result: {result['type']}")
                
                if result["type"] == "dom_monitoring_started":
                    print(f"✅ Started: {result['message']}")
                    print(f"   CSS Selector: {result.get('css_selector')}")
                    
                elif result["type"] == "threshold_crossed":
                    print(f"🚨 TRADING ALERT!")
                    element = result.get('element', {})
                    print(f"   Current Value: {element.get('current_value')}%")
                    print(f"   Threshold: {element.get('operator')} {element.get('threshold')}%")
                    print(f"   Display Text: '{element.get('text_content')}'")
                    
                elif result["type"] == "dom_status":
                    element = result.get('element', {})
                    print(f"📊 Status: {element.get('current_value')}% | Alert: {'Yes' if element.get('threshold_crossed') else 'No'}")
                    
                elif result["type"] == "dom_error":
                    print(f"❌ Error: {result['error']}")
            
            print(f"📋 Test {i} completed\\n")
            
        except Exception as e:
            print(f"❌ Test {i} failed: {e}\\n")

async def test_parallel_trading_monitors():
    """Test multiple trading monitors running in parallel"""
    
    print("🔄 Parallel Trading Monitors Demo")
    print("=" * 50)
    
    seek_mode = SeekMode()
    
    # Multiple trading alert configurations
    monitor_configs = [
        {
            "task_id": "drop_alert",
            "threshold": -3.0,
            "operator": "<",
            "name": "Drop Alert (-3%)",
        },
        {
            "task_id": "big_drop_alert", 
            "threshold": -10.0,
            "operator": "<",
            "name": "Big Drop Alert (-10%)",
        },
        {
            "task_id": "rise_alert",
            "threshold": 2.0,
            "operator": ">",
            "name": "Rise Alert (+2%)",
        }
    ]
    
    print("🚀 Starting parallel trading monitors...")
    print("⏰ Running for 8 seconds...")
    
    # Create parallel tasks
    tasks = []
    for config in monitor_configs:
        task = asyncio.create_task(
            run_trading_monitor(seek_mode, config),
            name=config["name"]
        )
        tasks.append(task)
    
    # Run parallel monitoring with timeout
    try:
        await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=8.0
        )
    except asyncio.TimeoutError:
        print("\\n⏰ Parallel trading monitoring completed")
        
        # Stop all monitors
        for config in monitor_configs:
            seek_mode.stop_seek(config["task_id"])
    
    print("✅ Parallel trading monitoring finished")

async def run_trading_monitor(seek_mode: SeekMode, config: Dict[str, Any]):
    """Run a single trading monitor"""
    task_id = config["task_id"]
    threshold = config["threshold"]
    operator = config["operator"]
    name = config["name"]
    
    print(f"📊 Started {name}")
    
    async for result in seek_mode.start_trading_monitor(
        task_id=task_id,
        threshold=threshold,
        operator=operator,
        continuous=True
    ):
        if result["type"] == "threshold_crossed":
            element = result.get("element", {})
            print(f"🚨 [{name}] TRADING ALERT: {element.get('current_value')}% crossed {operator}{threshold}%!")
            
        elif result["type"] == "dom_status":
            element = result.get("element", {})
            print(f"📈 [{name}] Current: {element.get('current_value')}%")

async def test_dom_threshold_monitoring():
    """Test the LangChain DOM threshold monitoring"""
    
    print("🔍 Testing LangChain DOM Threshold Monitoring")
    print("=" * 50)
    print("Target CSS Class: ._change_1dqlt_76._colorSell_1dqlt_8 span")
    print("Sample HTML includes elements with percentage values")
    print()
    
    # Initialize seek mode
    seek_mode = SeekMode()
    
    # Test scenarios for the specified CSS class
    test_scenarios = [
        {
            "name": "Price Drop Alert",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|-2|<",
            "description": "Alert when price change < -2%"
        },
        {
            "name": "Price Rise Alert",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|1|>",
            "description": "Alert when price change > 1%"
        },
        {
            "name": "Exact Value Monitor",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|-2.45|==",
            "description": "Alert when price change exactly equals -2.45%"
        }
    ]
    
    print("📊 Testing DOM Monitoring Scenarios:")
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
            async for result in seek_mode.start_dom_seek(
                task_id=task_id,
                query=scenario["query"],
                html_content=SAMPLE_HTML,
                continuous=False,  # Set to True for continuous monitoring
                check_interval=1
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
                    print(f"   Elements Found: {element.get('elements_found')}")
                    print(f"   Time: {result.get('timestamp')}")
                    
                elif result["type"] == "dom_status":
                    element = result.get('element', {})
                    print(f"📊 Current Status:")
                    print(f"   Value: {element.get('current_value')}")
                    print(f"   Text: '{element.get('text_content')}'")
                    print(f"   Threshold Met: {element.get('threshold_crossed')}")
                    print(f"   Elements Found: {element.get('elements_found')}")
                    
                elif result["type"] == "dom_element_not_found":
                    print(f"❌ Element not found: {result['message']}")
                    print(f"   Error: {result.get('error')}")
                    
                elif result["type"] == "dom_no_value":
                    print(f"⚠️  No numerical value: {result['message']}")
                    print(f"   Text Found: '{result.get('text_found')}'")
                    
                elif result["type"] == "dom_error":
                    print(f"❌ Error: {result['error']}")
            
            print(f"📋 Test {i} completed with {len(results)} results\\n")
            
        except Exception as e:
            print(f"❌ Test {i} failed: {e}\\n")

async def test_parallel_monitoring():
    """Test parallel monitoring of multiple elements"""
    
    print("🔄 Parallel LangChain DOM Monitoring Demo")
    print("=" * 50)
    
    seek_mode = SeekMode()
    
    # Multiple parallel monitoring configurations
    monitor_configs = [
        {
            "task_id": "sell_monitor",
            "query": "._change_1dqlt_76._colorSell_1dqlt_8 span|-2|<",
            "html_content": SAMPLE_HTML,
            "name": "Sell Alert Monitor",
            "check_interval": 1
        },
        {
            "task_id": "buy_monitor", 
            "query": "._change_1dqlt_76._colorBuy_1dqlt_9 span|1|>",
            "html_content": SAMPLE_HTML,
            "name": "Buy Alert Monitor",
            "check_interval": 1
        },
        {
            "task_id": "volume_monitor",
            "query": ".volume-indicator span|1000000|>",
            "html_content": SAMPLE_HTML,
            "name": "Volume Monitor",
            "check_interval": 1
        }
    ]
    
    print("🚀 Starting parallel monitoring tasks...")
    print("⏰ Running for 10 seconds...")
    
    # Run parallel monitoring with timeout
    try:
        await asyncio.wait_for(
            run_parallel_monitors(seek_mode, monitor_configs),
            timeout=10.0
        )
    except asyncio.TimeoutError:
        print("\\n⏰ Parallel monitoring demo completed after 10 seconds")
        
        # Stop all active seeks
        for config in monitor_configs:
            seek_mode.stop_seek(config["task_id"])
    
    print("✅ Parallel monitoring demo finished")

async def test_dynamic_html():
    """Test with changing HTML content to simulate real-time updates"""
    
    print("\\n🔄 Dynamic HTML Content Testing")
    print("=" * 50)
    
    seek_mode = SeekMode()
    
    # Simulate different HTML states
    html_states = [
        # State 1: Price down -2.45%
        '''<div class="_change_1dqlt_76 _colorSell_1dqlt_8"><span>-2.45%</span></div>''',
        # State 2: Price down more -3.67%
        '''<div class="_change_1dqlt_76 _colorSell_1dqlt_8"><span>-3.67%</span></div>''',
        # State 3: Price up +1.23%
        '''<div class="_change_1dqlt_76 _colorSell_1dqlt_8"><span>+1.23%</span></div>''',
        # State 4: Big drop -5.89%
        '''<div class="_change_1dqlt_76 _colorSell_1dqlt_8"><span>-5.89%</span></div>'''
    ]
    
    query = "._change_1dqlt_76._colorSell_1dqlt_8 span|-3|<"  # Alert when < -3%
    
    print(f"📊 Testing threshold: < -3%")
    print(f"🔍 CSS Selector: ._change_1dqlt_76._colorSell_1dqlt_8 span")
    print()
    
    for i, html_state in enumerate(html_states, 1):
        print(f"📈 State {i}: Testing HTML state")
        
        # Test this HTML state
        task_id = f"dynamic_test_{i}"
        
        async for result in seek_mode.start_dom_seek(
            task_id=task_id,
            query=query,
            html_content=html_state,
            continuous=False,
            check_interval=1
        ):
            if result["type"] == "threshold_crossed":
                element = result.get('element', {})
                print(f"🚨 THRESHOLD TRIGGERED! Value: {element.get('current_value')} < -3%")
                
            elif result["type"] == "dom_status":
                element = result.get('element', {})
                value = element.get('current_value')
                text = element.get('text_content')
                crossed = element.get('threshold_crossed')
                print(f"   Current: {value} | Text: '{text}' | Alert: {'Yes' if crossed else 'No'}")
        
        print()

def show_hardcoded_integration():
    """Show hardcoded integration details"""
    
    print("\\n🔗 Hardcoded Trading Integration")
    print("=" * 50)
    
    print("📋 Hardcoded Features:")
    print("✅ CSS Selector: ._change_1dqlt_76 _colorSell_1dqlt_8 span")
    print("✅ No configuration required")  
    print("✅ Simple threshold-based alerts")
    print("✅ Automatic percentage extraction")
    print("✅ Real-time monitoring")
    print("✅ Parallel monitoring support")
    print()
    
    print("🎯 Simplified Usage:")
    print("seek_mode = SeekMode()")
    print()
    print("# Start monitoring for drops below -5%")
    print("async for result in seek_mode.start_trading_monitor('task1', -5.0, '<'):")
    print("    if result['type'] == 'threshold_crossed':")
    print("        print('Price dropped below -5%!')")
    print()
    print("# Start monitoring for rises above 3%") 
    print("async for result in seek_mode.start_trading_monitor('task2', 3.0, '>'):")
    print("    if result['type'] == 'threshold_crossed':")
    print("        print('Price rose above 3%!')")
    print()
    
    print("🔧 Available Operators:")
    print("• '>' - Greater than (price increases)")
    print("• '<' - Less than (price drops)")  
    print("• '>=' - Greater than or equal")
    print("• '<=' - Less than or equal")
    print("• '==' - Equals (exact match)")
    print("• '!=' - Not equals")
    print()
    
    print("📊 Common Use Cases:")
    print("• Drop Alert: threshold=-5.0, operator='<' (alert on drops below -5%)")
    print("• Rise Alert: threshold=3.0, operator='>' (alert on rises above 3%)")
    print("• Stop Loss: threshold=-10.0, operator='<=' (alert at -10% or worse)")
    print("• Take Profit: threshold=15.0, operator='>=' (alert at 15% or better)")

if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("🎯 Hardcoded Trading Element Monitor Test Suite")
    print("Element: ._change_1dqlt_76 _colorSell_1dqlt_8 span")
    print("Engine: BeautifulSoup (No external dependencies)")
    print("=" * 60)
    
    async def run_all_tests():
        await test_hardcoded_trading_monitor()
        await test_parallel_trading_monitors()
        show_hardcoded_integration()
    
    asyncio.run(run_all_tests())