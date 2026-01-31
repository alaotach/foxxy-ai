"""
Simple Trading Monitor - Hardcoded Implementation
Monitors ._change_1dqlt_76 _colorSell_1dqlt_8 span for percentage changes
"""
import asyncio
from agent.seek_mode_simple import SeekMode

async def quick_trading_monitor():
    """Quick start trading monitor example"""
    
    print("🚀 Quick Trading Monitor")
    print("=" * 30)
    print("Monitoring: ._change_1dqlt_76 _colorSell_1dqlt_8 span")
    print()
    
    # Initialize monitor
    seek_mode = SeekMode()
    
    # Start monitoring for price drops below -3%
    print("📉 Starting drop alert (< -3%)...")
    
    async for result in seek_mode.start_trading_monitor(
        task_id="drop_alert",
        threshold=-3.0,
        operator="<",
        continuous=False  # Single check
    ):
        if result["type"] == "threshold_crossed":
            element = result["element"]
            print(f"🚨 ALERT: Price dropped to {element['current_value']}%!")
            print(f"   Display: '{element['text_content']}'")
            
        elif result["type"] == "dom_status":
            element = result["element"]
            current = element['current_value']
            threshold = element['threshold']
            operator = element['operator']
            
            print(f"📊 Current: {current}% | Threshold: {operator} {threshold}%")
            
            if element['threshold_crossed']:
                print("✅ Threshold condition met!")
            else:
                print("⏳ Waiting for threshold...")

async def parallel_trading_alerts():
    """Run multiple trading alerts in parallel"""
    
    print("\\n🔄 Parallel Trading Alerts")
    print("=" * 30)
    
    seek_mode = SeekMode()
    
    # Define multiple alert conditions
    alerts = [
        {"task": "small_drop", "threshold": -2.0, "op": "<", "name": "Small Drop"},
        {"task": "big_drop", "threshold": -5.0, "op": "<", "name": "Big Drop"}, 
        {"task": "rise", "threshold": 1.0, "op": ">", "name": "Rise Alert"}
    ]
    
    # Create tasks for parallel execution
    tasks = []
    for alert in alerts:
        task = asyncio.create_task(
            single_alert_monitor(seek_mode, alert),
            name=alert["name"]
        )
        tasks.append(task)
    
    print("🚀 Starting parallel monitors...")
    
    # Run for 5 seconds
    try:
        await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=5.0
        )
    except asyncio.TimeoutError:
        print("\\n⏰ Monitoring completed")
        
        # Stop all alerts
        for alert in alerts:
            seek_mode.stop_seek(alert["task"])

async def single_alert_monitor(seek_mode, alert_config):
    """Run a single alert monitor"""
    
    name = alert_config["name"]
    print(f"📊 [{name}] Started monitoring...")
    
    async for result in seek_mode.start_trading_monitor(
        task_id=alert_config["task"],
        threshold=alert_config["threshold"],
        operator=alert_config["op"],
        continuous=True
    ):
        if result["type"] == "threshold_crossed":
            element = result["element"]
            print(f"🚨 [{name}] ALERT! {element['current_value']}% crossed {alert_config['op']}{alert_config['threshold']}%")

def show_usage_examples():
    """Show practical usage examples"""
    
    print("\\n💡 Usage Examples")
    print("=" * 30)
    
    print("# Basic drop alert")
    print("seek_mode = SeekMode()")
    print("async for result in seek_mode.start_trading_monitor('drop', -5.0, '<'):")
    print("    print(result)")
    print()
    
    print("# Basic rise alert") 
    print("async for result in seek_mode.start_trading_monitor('rise', 3.0, '>'):")
    print("    print(result)")
    print()
    
    print("# Stop loss at -10%")
    print("async for result in seek_mode.start_trading_monitor('stop_loss', -10.0, '<='):")
    print("    if result['type'] == 'threshold_crossed':")
    print("        print('STOP LOSS TRIGGERED!')")
    print("        # Execute stop loss logic here")
    print()
    
    print("# Take profit at +15%")
    print("async for result in seek_mode.start_trading_monitor('take_profit', 15.0, '>='):")
    print("    if result['type'] == 'threshold_crossed':")
    print("        print('TAKE PROFIT TRIGGERED!')")
    print("        # Execute take profit logic here")

async def main():
    """Main execution"""
    await quick_trading_monitor()
    await parallel_trading_alerts()
    show_usage_examples()

if __name__ == "__main__":
    asyncio.run(main())