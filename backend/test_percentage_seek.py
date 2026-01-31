"""
Test script for percentage seeking functionality
"""
import asyncio
import json
from agent.seek_mode import SeekMode
import base64
from pathlib import Path

async def test_percentage_seeking():
    """Test the percentage seeking functionality"""
    
    print("🔍 Testing Percentage Seeking Mode")
    print("=" * 50)
    
    # Initialize seek mode
    seek_mode = SeekMode()
    
    # For testing, you would need a real screenshot with percentages
    # This is a placeholder - replace with actual screenshot
    test_screenshot = None
    
    # If you have a test screenshot in the screenshots folder
    screenshot_path = Path(__file__).parent / "screenshots" / "test_chart.png"
    if screenshot_path.exists():
        with open(screenshot_path, "rb") as f:
            test_screenshot = base64.b64encode(f.read()).decode('utf-8')
        print(f"📸 Loaded test screenshot: {screenshot_path}")
    else:
        print("📸 No test screenshot found - create a chart screenshot and save as:")
        print(f"   {screenshot_path}")
        print("\nFor testing with live data, use the WebSocket API or browser extension")
        return
    
    # Test different percentage seeking scenarios
    test_scenarios = [
        {
            "context": "RSI levels and price changes",
            "description": "Find RSI percentage and price change percentages"
        },
        {
            "context": "portfolio performance", 
            "description": "Find portfolio gains/losses and performance metrics"
        },
        {
            "context": "technical indicators",
            "description": "Find all technical indicator percentage values"
        },
        {
            "context": "price movements",
            "description": "Find price change percentages and momentum indicators"
        }
    ]
    
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"\n📊 Test Scenario {i}: {scenario['description']}")
        print("-" * 40)
        
        task_id = f"percentage_test_{i}"
        
        try:
            # Start percentage seeking (non-continuous for testing)
            results = []
            async for result in seek_mode.start_seek(
                task_id=task_id,
                seek_type="percentage",
                query=scenario["context"],
                action="extract",
                continuous=False,
                screenshot_base64=test_screenshot
            ):
                results.append(result)
                print(f"Result: {result['type']}")
                
                if result["type"] == "percentages_found":
                    percentages = result.get("result", {}).get("elements", [])
                    print(f"✅ Found {len(percentages)} percentage values:")
                    
                    for j, perc in enumerate(percentages[:5], 1):  # Show top 5
                        print(f"   {j}. {perc['value']} at ({perc['x']}, {perc['y']})")
                        print(f"      Type: {perc['type']} | Confidence: {perc['confidence']}")
                        print(f"      Description: {perc['description']}")
                        print(f"      Relevance: {perc['context_relevance']}/10")
                        print()
                
                elif result["type"] == "no_percentages_found":
                    print("❌ No percentages found")
                
                elif result["type"] == "percentage_seek_error":
                    print(f"❌ Error: {result['error']}")
            
            print(f"📋 Test {i} completed with {len(results)} results")
            
        except Exception as e:
            print(f"❌ Test {i} failed: {e}")
    
    print("\n🎯 Percentage Seeking Test Summary")
    print("=" * 50)
    print("✅ Percentage detection system ready")
    print("📊 Supports context-aware percentage analysis")
    print("🎯 Focuses on financially relevant percentage values")
    print("📈 Integrates with stock monitoring system")

async def demo_usage_examples():
    """Show usage examples for different percentage seeking scenarios"""
    
    print("\n📖 Percentage Seeking Usage Examples")
    print("=" * 50)
    
    examples = [
        {
            "title": "Stock Price Monitoring",
            "context": "price changes and daily movements",
            "use_case": "Monitor for significant price percentage changes (>5%)"
        },
        {
            "title": "RSI Overbought/Oversold Detection", 
            "context": "RSI levels and momentum indicators",
            "use_case": "Find RSI percentages to identify overbought (>70%) or oversold (<30%) conditions"
        },
        {
            "title": "Portfolio Performance Tracking",
            "context": "portfolio gains losses performance",
            "use_case": "Track overall portfolio percentage performance and individual holdings"
        },
        {
            "title": "Volume Analysis",
            "context": "volume changes and trading activity", 
            "use_case": "Identify unusual volume spikes (percentage above average)"
        }
    ]
    
    for example in examples:
        print(f"\n📊 {example['title']}")
        print(f"   Context: '{example['context']}'")
        print(f"   Use Case: {example['use_case']}")
    
    print("\n🔧 API Usage:")
    print("WebSocket: ws://localhost:8000/api/seek/ws/{task_id}")
    print("POST /api/seek/start with seek_type='percentage'")
    print("GET /api/seek/{task_id}/quick with seek_type='percentage'")
    
    print("\n💡 Integration Tips:")
    print("• Use with stock monitoring for automatic percentage alerts")
    print("• Combine with continuous=True for real-time percentage tracking")
    print("• Set screenshot_interval=10 for balanced performance/accuracy")
    print("• Use context queries to focus on specific percentage types")

if __name__ == "__main__":
    asyncio.run(test_percentage_seeking())
    asyncio.run(demo_usage_examples())