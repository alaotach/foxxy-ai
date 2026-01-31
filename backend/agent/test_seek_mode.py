"""
Seek Mode Demo and Test Script
Run this to test the seek mode functionality
"""
import asyncio
import base64
from agent.agent_loop import agent_loop
from agent.seek_mode import seek_mode


async def demo_text_seek():
    """Demo: Search for text on the page"""
    print("\n" + "="*60)
    print("DEMO 1: Text Seek")
    print("="*60)
    
    async for update in agent_loop.start_seek_mode(
        task_id="demo-text-seek",
        query="Login",
        seek_type="text",
        action="highlight",
        continuous=False
    ):
        print(f"[{update['type']}] {update}")
        
        if update['type'] in ['seek_result', 'seek_not_found', 'seek_error']:
            break


async def demo_element_seek():
    """Demo: Search for element by selector"""
    print("\n" + "="*60)
    print("DEMO 2: Element Seek (CSS Selector)")
    print("="*60)
    
    async for update in agent_loop.start_seek_mode(
        task_id="demo-element-seek",
        query="button.primary",
        seek_type="element",
        action="highlight",
        continuous=False
    ):
        print(f"[{update['type']}] {update}")
        
        if update['type'] in ['seek_result', 'seek_not_found', 'seek_error']:
            break


async def demo_vision_seek():
    """Demo: Search using AI vision (requires screenshot)"""
    print("\n" + "="*60)
    print("DEMO 3: Vision Seek")
    print("="*60)
    
    # In production, get screenshot from browser
    # For demo, use a placeholder
    screenshot_base64 = "placeholder_screenshot"
    
    async for update in agent_loop.start_seek_mode(
        task_id="demo-vision-seek",
        query="the blue subscribe button in the top right corner",
        seek_type="vision",
        action="highlight",
        continuous=False,
        screenshot_base64=screenshot_base64
    ):
        print(f"[{update['type']}] {update}")
        
        if update['type'] in ['seek_result', 'seek_not_found', 'seek_error']:
            break


async def demo_continuous_seek():
    """Demo: Continuous monitoring"""
    print("\n" + "="*60)
    print("DEMO 4: Continuous Seek (stops after 3 seconds)")
    print("="*60)
    
    task_id = "demo-continuous-seek"
    
    # Start continuous seek
    seek_task = asyncio.create_task(
        _run_continuous_seek(task_id)
    )
    
    # Let it run for 3 seconds
    await asyncio.sleep(3)
    
    # Stop it
    print("\n⏹️  Stopping continuous seek...")
    await agent_loop.stop_seek_mode(task_id)
    
    # Wait for task to complete
    await seek_task


async def _run_continuous_seek(task_id):
    """Helper to run continuous seek"""
    async for update in agent_loop.start_seek_mode(
        task_id=task_id,
        query="Loading spinner",
        seek_type="element",
        action="monitor",
        continuous=True
    ):
        print(f"[{update['type']}] {update.get('message', update)}")


async def demo_quick_seek():
    """Demo: Quick one-shot seek"""
    print("\n" + "="*60)
    print("DEMO 5: Quick Seek")
    print("="*60)
    
    result = await seek_mode.quick_seek(
        query="Subscribe",
        seek_type="auto"
    )
    
    print(f"Result: {result}")


async def demo_seek_history():
    """Demo: Seek history tracking"""
    print("\n" + "="*60)
    print("DEMO 6: Seek History")
    print("="*60)
    
    task_id = "demo-history"
    
    # Perform a few seeks
    for i in range(3):
        async for update in agent_loop.start_seek_mode(
            task_id=task_id,
            query=f"Button {i+1}",
            seek_type="text",
            continuous=False
        ):
            if update['type'] in ['seek_result', 'seek_not_found']:
                break
    
    # Get history
    history = seek_mode.get_seek_history(task_id)
    print(f"\n📊 Seek History ({len(history)} results):")
    for i, result in enumerate(history, 1):
        print(f"  {i}. Found: {result.found} at {result.timestamp}")
    
    # Clear history
    seek_mode.clear_seek_history(task_id)
    print(f"\n🗑️  History cleared")


async def demo_agent_state():
    """Demo: Check agent state"""
    print("\n" + "="*60)
    print("DEMO 7: Agent State")
    print("="*60)
    
    state = agent_loop.get_state()
    print(f"\n🤖 Agent State:")
    for key, value in state.items():
        print(f"  {key}: {value}")


async def run_all_demos():
    """Run all demos in sequence"""
    print("\n🎯 Starting Seek Mode Demos")
    print("="*60)
    
    try:
        await demo_text_seek()
        await demo_element_seek()
        # await demo_vision_seek()  # Uncomment when you have a real screenshot
        await demo_continuous_seek()
        await demo_quick_seek()
        await demo_seek_history()
        await demo_agent_state()
        
        print("\n" + "="*60)
        print("✅ All demos completed!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Error during demos: {e}")
        import traceback
        traceback.print_exc()


async def interactive_seek():
    """Interactive seek mode for manual testing"""
    print("\n🔍 Interactive Seek Mode")
    print("="*60)
    print("Commands:")
    print("  text <query>     - Search for text")
    print("  element <query>  - Search for element")
    print("  vision <query>   - Vision search (requires screenshot)")
    print("  quick <query>    - Quick seek")
    print("  history          - Show history")
    print("  state            - Show agent state")
    print("  quit             - Exit")
    print("="*60)
    
    task_counter = 0
    
    while True:
        try:
            command = input("\n🔍 > ").strip()
            
            if not command:
                continue
            
            if command == "quit":
                break
            
            parts = command.split(" ", 1)
            cmd = parts[0].lower()
            query = parts[1] if len(parts) > 1 else ""
            
            if cmd == "text" and query:
                task_counter += 1
                async for update in agent_loop.start_seek_mode(
                    task_id=f"interactive-{task_counter}",
                    query=query,
                    seek_type="text"
                ):
                    print(update)
                    if update['type'] in ['seek_result', 'seek_not_found', 'seek_error']:
                        break
            
            elif cmd == "element" and query:
                task_counter += 1
                async for update in agent_loop.start_seek_mode(
                    task_id=f"interactive-{task_counter}",
                    query=query,
                    seek_type="element"
                ):
                    print(update)
                    if update['type'] in ['seek_result', 'seek_not_found', 'seek_error']:
                        break
            
            elif cmd == "quick" and query:
                result = await seek_mode.quick_seek(query)
                print(result)
            
            elif cmd == "history":
                if task_counter > 0:
                    history = seek_mode.get_seek_history(f"interactive-{task_counter}")
                    print(f"History ({len(history)} results): {history}")
                else:
                    print("No history yet")
            
            elif cmd == "state":
                state = agent_loop.get_state()
                print(f"Agent State: {state}")
            
            else:
                print("Invalid command or missing query")
        
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        asyncio.run(interactive_seek())
    else:
        asyncio.run(run_all_demos())
