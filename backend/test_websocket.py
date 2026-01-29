"""
WebSocket Integration Demo
Tests real-time streaming between backend and clients
"""
import asyncio
import websockets
import json
from agent.planner import plan_task
from agent.websocket_manager import manager

async def demo_streaming():
    """Demo WebSocket streaming"""
    
    # Simulate planning with streaming
    task_id = "demo-task-123"
    prompt = "Click the login button and fill the form"
    
    print("🎬 Starting WebSocket streaming demo...\n")
    
    # Stream planning start
    await manager.stream_planning(prompt, task_id)
    await asyncio.sleep(1)
    
    # Generate plan
    print("🧠 Generating plan...")
    plan = plan_task(prompt)
    
    # Stream each step
    for i, step in enumerate(plan.steps, 1):
        print(f"⚡ Step {i}/{len(plan.steps)}: {step.type}")
        
        await manager.stream_step(
            step.model_dump(),
            i,
            len(plan.steps),
            task_id
        )
        await asyncio.sleep(0.5)
        
        # Simulate execution result
        result = {
            "step_id": step.id,
            "success": True,
            "duration_ms": 500,
            "observations": {}
        }
        
        await manager.stream_result(result, task_id)
        await asyncio.sleep(0.5)
    
    # Stream completion
    summary = {
        "succeeded": len(plan.steps),
        "failed": 0,
        "total": len(plan.steps)
    }
    
    await manager.stream_complete(summary, task_id)
    
    print("\n✅ Demo complete!")

async def test_client():
    """Test WebSocket client connection"""
    uri = "ws://localhost:8000/ws"
    
    print(f"🔌 Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            
            # Listen for messages
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                print(f"📨 Received: {data['type']}")
                
                if data['type'] == 'execution_complete':
                    break
    
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("Make sure the backend is running: python main.py")

if __name__ == "__main__":
    print("=" * 60)
    print("🦊 Foxy AI - WebSocket Integration Demo")
    print("=" * 60)
    print("\nThis tests real-time streaming between backend and clients.")
    print("Run this AFTER starting the backend server.\n")
    
    # Run demo
    asyncio.run(demo_streaming())
