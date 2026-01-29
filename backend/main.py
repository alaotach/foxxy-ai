from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agent.planner import plan_task, replan_with_feedback
from agent.schema import TaskPlan, ExecutionFeedback, TaskMemory
from agent.memory import memory_manager
from agent.websocket_manager import manager as ws_manager
from agent.vision import VisionAutomation
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

app = FastAPI(title="Foxy AI Browser Automation Backend")

# CORS for TypeScript automation core
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanRequest(BaseModel):
    prompt: str
    context: Optional[dict] = None

class FeedbackRequest(BaseModel):
    task_id: str
    feedback: ExecutionFeedback

@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Foxy AI Backend",
        "llm_provider": os.getenv("LLM_PROVIDER", "openai")
    }

@app.post("/plan", response_model=TaskPlan)
def create_plan(request: PlanRequest):
    """
    Convert natural language prompt into structured automation plan.
    
    Example:
    {
        "prompt": "Go to example.com and click the login button"
    }
    """
    try:
        plan = plan_task(request.prompt, context=request.context)
        
        # Store in memory
        memory_manager.create_memory(
            task_id=plan.task_id,
            prompt=request.prompt,
            plan=plan
        )
        
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vision/find_element")
async def vision_find_element(request: dict):
    """Find element coordinates using vision AI"""
    screenshot = request.get("screenshot")
    description = request.get("description")
    viewport_width = request.get("viewport_width", 1920)
    viewport_height = request.get("viewport_height", 1080)
    
    if not screenshot or not description:
        return {"error": "screenshot and description are required"}
    
    vision = VisionAutomation(provider="hackclub")
    coords = vision.find_element_coordinates(
        screenshot, 
        description,
        viewport_width,
        viewport_height
    )
    
    if coords:
        return {
            "success": True,
            "x": coords[0],
            "y": coords[1]
        }
    else:
        return {
            "success": False,
            "error": "Element not found"
        }

@app.post("/feedback")
def submit_feedback(request: FeedbackRequest):
    """
    Submit execution feedback from automation core.
    Backend can use this for reflection and replanning.
    """
    try:
        memory = memory_manager.add_feedback(request.task_id, request.feedback)
        
        if not memory:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check if any steps failed
        has_failures = any(
            not result.success 
            for result in request.feedback.completed_steps
        )
        
        if has_failures:
            memory_manager.update_status(request.task_id, "failed")
        else:
            memory_manager.update_status(request.task_id, "completed")
        
        return {
            "task_id": request.task_id,
            "status": memory.status,
            "retry_count": memory.retry_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/replan/{task_id}", response_model=TaskPlan)
def replan_task(task_id: str):
    """
    Replan a failed task using feedback and memory.
    """
    try:
        memory = memory_manager.get_memory(task_id)
        
        if not memory:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if not memory_manager.should_retry(task_id):
            raise HTTPException(status_code=400, detail="Max retries reached")
        
        # Get context from previous attempts
        context = memory_manager.get_context_for_retry(task_id)
        
        # Increment retry counter
        memory_manager.increment_retry(task_id)
        
        # Create new plan with context
        new_plan = plan_task(memory.original_prompt, context=context)
        
        # Update memory with new plan
        memory.plan = new_plan
        memory_manager.update_status(task_id, "pending")
        
        return new_plan
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/{task_id}", response_model=TaskMemory)
def get_task_memory(task_id: str):
    """Get memory for a specific task"""
    memory = memory_manager.get_memory(task_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Task not found")
    return memory

@app.get("/memory")
def get_all_memories():
    """Get all task memories"""
    return {
        "tasks": memory_manager.get_all_memories()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.
    
    Connect to receive live updates during task execution:
    - Planning progress
    - Step-by-step execution
    - Results and errors
    """
    task_id = "default"
    await ws_manager.connect(websocket, task_id)
    
    try:
        while True:
            # Keep connection alive and listen for messages
            data = await websocket.receive_text()
            
            # Echo back for testing
            await websocket.send_json({
                "type": "ping",
                "message": "Connection alive"
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, task_id)
        print(f"Client disconnected from WebSocket")

@app.websocket("/ws/{task_id}")
async def websocket_task_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for specific task updates"""
    await ws_manager.connect(websocket, task_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, task_id)

@app.post("/vision/find_element")
async def vision_find_element(request: dict):
    """Find element coordinates using vision AI"""
    screenshot = request.get("screenshot")
    description = request.get("description")
    viewport_width = request.get("viewport_width", 1920)
    viewport_height = request.get("viewport_height", 1080)
    
    if not screenshot or not description:
        return {"error": "screenshot and description are required"}
    
    vision = VisionAutomation(provider="hackclub")
    coords = vision.find_element_coordinates(
        screenshot, 
        description,
        viewport_width,
        viewport_height
    )
    
    if coords:
        return {
            "success": True,
            "x": coords[0],
            "y": coords[1]
        }
    else:
        return {
            "success": False,
            "error": "Element not found"
        }

@app.post("/vision/analyze")
async def vision_analyze(request: dict):
    """Analyze screenshot and answer questions"""
    screenshot = request.get("screenshot")
    question = request.get("question")
    
    if not screenshot or not question:
        return {"error": "screenshot and question are required"}
    
    vision = VisionAutomation(provider="hackclub")
    answer = vision.analyze_screenshot(screenshot, question)
    
    return {"answer": answer}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🦊 Starting Foxy AI Backend on {host}:{port}")
    print(f"🧠 LLM Provider: {os.getenv('LLM_PROVIDER', 'openai')}")
    
    uvicorn.run(app, host=host, port=port)

