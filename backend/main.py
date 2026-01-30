from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from agent.planner import plan_task, replan_with_feedback
from agent.schema import TaskPlan, ExecutionFeedback, TaskMemory
from agent.memory import memory_manager
from agent.websocket_manager import manager as ws_manager
from agent.vision import VisionAutomation
from agent.pure_vision import PureVisionAgent
from agent.agent_loop import agent_loop
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
import json
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

# PERFORMANCE: Create singleton instances to avoid repeated initialization
vision_automation = VisionAutomation(provider="hackclub")
pure_vision_agent = PureVisionAgent()
print("✅ Vision agents initialized")

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

@app.post("/plan/vision")
async def create_vision_plan(request: dict):
    """
    Create plan using vision - AI sees screenshot first
    
    Example:
    {
        "prompt": "Click the search button and search for laptops",
        "screenshot": "base64...",
        "viewport": {"url": "...", "title": "...", "width": 1920, "height": 1080}
    }
    """
    try:
        from agent.planner import plan_task_with_vision
        
        prompt = request.get("prompt")
        screenshot = request.get("screenshot")
        viewport = request.get("viewport", {})
        
        if not prompt or not screenshot:
            raise HTTPException(status_code=400, detail="prompt and screenshot required")
        
        plan = plan_task_with_vision(prompt, screenshot, viewport)
        
        # Store in memory
        memory_manager.create_memory(
            task_id=plan.task_id,
            prompt=prompt,
            plan=plan
        )
        
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/next_step")
async def agent_next_step(request: dict):
    """
    Autonomous agent - decides next step based on current state
    Returns next action to take or indicates completion
    
    {
        "goal": "create foxy ai ppt in canva",
        "screenshot": "base64...",
        "viewport": {"url": "...", "title": "..."},
        "history": ["navigated to canva", "clicked create button", ...]
    }
    """
    try:
        from agent.planner import get_llm
        
        goal = request.get("goal")
        screenshot = request.get("screenshot")
        viewport = request.get("viewport", {})
        history = request.get("history", [])
        
        if not goal or not screenshot:
            raise HTTPException(status_code=400, detail="goal and screenshot required")
        
        llm = get_llm()
        
        # Create decision prompt
        history_text = "\n".join([f"{i+1}. {h}" for i, h in enumerate(history[-10:])]) if history else "No steps taken yet"
        
        decision_prompt = f"""You are an autonomous browser automation agent. 

GOAL: {goal}

**GOAL COMPLETION CRITERIA** (check ONLY if goal matches these keywords):
- If goal contains "play", "watch", or "open video": Task is COMPLETE when video player is visible and playing
- If goal contains "search for": Task is COMPLETE when search results are displayed
- If goal contains "find": Task is COMPLETE when the target item/page is visible
- If goal contains "create", "make", "design": Task is COMPLETE when final output is saved/downloaded
- If goal contains "navigate to", "go to": Task is COMPLETE when target page loads
- **IMPORTANT**: Only apply these criteria if the goal actually matches - don't mark complete just because a video is playing if the goal wasn't to play a video

CURRENT PAGE: {viewport.get('url', 'unknown')}
PAGE TITLE: {viewport.get('title', 'unknown')}

CRITICAL RULES:
- If current URL starts with 'about:', 'chrome:', 'moz-extension:' - IMMEDIATELY navigate away
- For Google searches: Use navigate action to https://www.google.com/search?q=YOUR_QUERY
- For specific sites: Use navigate action to the site directly (e.g., https://www.canva.com)
- NEVER use vision_click or type on 'about:' pages - they are restricted
- Example: Goal "search cat" on about:newtab → next_action: {{"type": "navigate", "url": "https://www.google.com/search?q=cat"}}

ACTIONS TAKEN SO FAR:
{history_text}

Look at the current screenshot and decide:
1. **VERIFY THE OUTCOME**: Did the last action achieve its intended result?
   - If clicked "Subscribe", did it actually subscribe OR did a login/error modal appear?
   - If clicked "Create", did the editor/form open OR is it still on the same page?
   - If typed search query, did results appear OR is the page unchanged?
   - If clicked a video, did the video player start playing OR is it still on search results?
2. **Check for blockers**: Login modals, error messages, permission requests
3. **Is the goal fully completed?** (Check current state against the GOAL, not just what's visible)
   - For "play/watch video" goals ONLY: Check if video player is visible and video is playing
   - For "search" goals ONLY: Check if search results are visible
   - For "create" goals: Check if editor/creation interface is open and content is being added
   - **Don't mark complete just because something is playing if that wasn't the goal**
4. If not, what is the SINGLE next action to take?

**CRITICAL COMPLETION RULES**:
- Only mark completed=true when the SPECIFIC GOAL is achieved
- If goal is "play video X" and video X is playing → completed=true
- If goal is "search for X" and search results for X are visible → completed=true  
- If goal is "create Y" and you're still working on Y → completed=false, continue
- Do NOT mark complete just because a video player is visible if the goal wasn't to play a video
- If you see a login popup, permission modal, or error after an action - the action FAILED.
Do NOT mark task as completed if a modal/error is blocking progress.

Respond with JSON:
{{
  "completed": true/false,
  "reasoning": "Verification: Last action result. Current state: what's visible. Next: what to do.",
  "outcome_verified": true/false,
  "blocker": "login_modal|error_message|permission_request|none",
  "needs_user_input": false,
  "user_prompt": null,
  "next_action": {{
    "type": "navigate|vision_click|right_click|type|wait|scroll|download_image|prompt_user",
    "description": "what to click/do",
    "text": "text to type (if type action)",
    "x": 340,
    "y": 280,
    "url": "url (if navigate)",
    "timeout": milliseconds (if wait),
    "filename": "name.jpg (if download_image)",
    "prompt": "question to ask user (if prompt_user)",
    "input_type": "text|password|email (if prompt_user)"
  }}
}}

**CRITICAL - User Input Required:**
- **ONLY** ask for user input when you are BLOCKED and cannot proceed without it
- If you see a login page but user hasn't tried to login yet, DON'T ask for credentials yet
- If you see checkout page but haven't clicked "Proceed to Payment" yet, DON'T ask for payment details yet
- First try to proceed by clicking buttons (Add to Cart, Checkout, Continue as Guest, etc.)
- **ONLY** use prompt_user when:
  1. You clicked a required input field and it's focused/waiting for input
  2. You tried to submit a form but it failed because field is empty
  3. There is NO way to bypass the form (no "Guest Checkout", "Skip" button, etc.)
  
Examples of WHEN to ask:
- ✅ Clicked "Continue" but form validation says "Email required" → Ask for email
- ✅ On payment page with card number field focused → Ask for card details
- ❌ See login page but haven't tried "Guest Checkout" → DON'T ask, try guest first
- ❌ See checkout page with empty address fields → DON'T ask yet, look for "Use saved address" or continue button

Use: {{"type": "prompt_user", "prompt": "Please enter your Amazon email", "input_type": "email"}}
For passwords: {{"type": "prompt_user", "prompt": "Please enter your Amazon password", "input_type": "password"}}
After receiving user input, it will be in history as "User provided: [value]" - then type it into the field

If completed is true, next_action can be null.
If blocker exists, next_action should handle the blocker (e.g., close modal or navigate away).

Examples:
- If goal is "create ppt" and you see Canva editor open with slides, keep adding content
- If you see a login page, describe: "blue Login button in top-right corner"
- If you see a template gallery, describe: "large template card thumbnail in the center" (not vague "template")
- For search bars, describe: "search input field with placeholder text"
- For create buttons, describe: "Create a design button with plus icon"
- For downloading images from Google Images: use download_image action (finds largest visible image automatically)
- If download button not found: try right_click on the image then use vision_click for "Save image" menu item

IMPORTANT for TYPE actions:
- When using type action, you MUST look at the screenshot and provide the x,y coordinates of the input field
- Example: {{"type": "type", "x": 340, "y": 280, "text": "Valentine's Day", "description": "search input field"}}
- The coordinates should point to the CENTER of the input field you see in the screenshot
- This is more reliable than clicking first - it uses coordinate-based input setter

IMPORTANT for vision_click descriptions:
- Be SPECIFIC about visual appearance (color, size, position)
- Mention if it's a button, link, card, icon, or input field
- Describe location (top-right, center, sidebar, etc.)
- Include text if visible on the element
- DO NOT escape apostrophes - write "Valentine's Day" not "Valentine\'s Day"

Return ONLY valid JSON (no escaped apostrophes in strings)."""
        
        response = llm.invoke(decision_prompt)
        result_text = response.content
        
        # Parse JSON with better error handling
        import re
        # Match JSON object, handling multiline
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', result_text, re.DOTALL)
        if json_match:
            try:
                # Get the JSON string and strip any BOM or leading whitespace
                json_str = json_match.group().strip()
                # Remove BOM if present
                if json_str.startswith('\ufeff'):
                    json_str = json_str[1:]
                
                # FIX: Remove invalid escape sequences like \'
                # In JSON, apostrophes don't need escaping
                json_str = json_str.replace(r"\'", "'")
                
                # Parse directly
                decision = json.loads(json_str)
                
                # OPTIMIZATION: Cache screenshot and vision calls
                # Store screenshot hash to avoid redundant vision calls
                import hashlib
                screenshot_hash = hashlib.md5(screenshot.encode()).hexdigest()[:8]
                
                # CRITICAL FIX: Handle invalid action types and fix common issues
                next_action = decision.get("next_action")
                if next_action:
                    # Fix 1: Convert invalid 'type' without selector to vision_click on input
                    # BUT: If coordinates (x, y) are provided, keep it as 'type' (coordinate-based typing)
                    if next_action.get("type") == "type" and not next_action.get("selector"):
                        # Check if coordinates are provided (new coordinate-based typing)
                        has_coordinates = next_action.get("x") is not None and next_action.get("y") is not None
                        
                        if not has_coordinates:
                            print(f"⚠️ Converting invalid 'type' action to 'vision_click' (no selector)")
                            # First, click on the search/input field
                            next_action["type"] = "vision_click"
                            next_action["description"] = next_action.get("description", "search input field")
                            # Text will be typed in next iteration after click succeeds
                        else:
                            print(f"✅ Type action with coordinates ({next_action['x']}, {next_action['y']}) - using coordinate-based typing")
                    
                    # Fix 2: Resolve vision_click coordinates NOW to reduce round trips
                    if next_action.get("type") == "vision_click":
                        description = next_action.get("description")
                        if description and screenshot:
                            print(f"🔍 Resolving coordinates for vision_click: {description}")
                            
                            # Get viewport dimensions from request or use defaults
                            vp_width = viewport.get("width", 1920)
                            vp_height = viewport.get("height", 1080)
                            
                            # OPTIMIZATION: Cache vision calls per screenshot
                            print(f"📸 Screenshot hash: {screenshot_hash}")
                            
                            # Find element coordinates
                            coords = vision_automation.find_element_coordinates(
                                screenshot,
                                description,
                                vp_width,
                                vp_height
                            )
                            
                            if coords:
                                # Add coordinates to the action
                                next_action["x"] = coords[0]
                                next_action["y"] = coords[1]
                                print(f"✅ Coordinates resolved: ({coords[0]}, {coords[1]})")
                            else:
                                print(f"⚠️ Could not find element: {description}, keeping action to retry")
                                # Keep the original action - it will retry
                    
                    # Fix 3: Add timeout to wait actions
                    if next_action.get("type") == "wait" and not next_action.get("timeout"):
                        next_action["timeout"] = 3000
                    
                    # Fix 4: Validate navigation URLs
                    if next_action.get("type") == "navigate" and next_action.get("url"):
                        url = next_action["url"]
                        # Ensure proper URL format
                        if not url.startswith("http"):
                            if url.startswith("www."):
                                next_action["url"] = "https://" + url
                            else:
                                next_action["url"] = "https://www.google.com/search?q=" + url
                
                return decision
            except json.JSONDecodeError as je:
                print(f"❌ JSON parse error: {je}")
                print(f"Raw JSON string: {json_str[:500]}")
                print(f"Full response: {result_text}")
                return {"completed": False, "reasoning": f"JSON parse error: {str(je)}", "next_action": None}
        else:
            print(f"❌ No JSON found in response: {result_text[:500]}")
            return {"completed": False, "reasoning": "No JSON in response", "next_action": None}
            
    except Exception as e:
        print(f"❌ Agent next_step error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vision/find_element")
async def vision_find_element(request: dict):
    """Find element coordinates using hybrid vision + DOM analysis"""
    screenshot = request.get("screenshot")
    description = request.get("description")
    viewport_width = request.get("viewport_width", 1920)
    viewport_height = request.get("viewport_height", 1080)
    dom_snapshot = request.get("dom_snapshot")  # NEW: DOM data
    
    print(f"🔍 Hybrid request: {description}")
    print(f"📸 Screenshot size: {len(screenshot) if screenshot else 0} chars")
    print(f"📐 Viewport: {viewport_width}x{viewport_height}")
    if dom_snapshot:
        print(f"🌳 DOM elements: {len(dom_snapshot.get('elements', []))}")
    
    if not screenshot or not description:
        return {"error": "screenshot and description are required"}
    
    # Use hybrid approach if DOM snapshot available
    if dom_snapshot:
        result = vision_automation.find_element_hybrid(
            screenshot,
            description,
            dom_snapshot,
            viewport_width,
            viewport_height
        )
    else:
        # Fallback to vision-only
        coords = vision_automation.find_element_coordinates(
            screenshot, 
            description,
            viewport_width,
            viewport_height
        )
        if coords:
            result = {
                "success": True,
                "x": coords[0],
                "y": coords[1],
                "method": "vision_only"
            }
        else:
            result = {
                "success": False,
                "error": "Element not found"
            }
    
    return result

@app.post("/vision/pure_action")
async def pure_vision_action(request: dict):
    """
    PURE VLM AUTOMATION - VLM sees page and decides action directly
    No LLM, no hybrid complexity - just vision-to-action
    
    Request:
    {
        "screenshot": "base64...",
        "task": "Click the first Valentine's Day template",
        "context": "Making a Valentine's Day PPT on Canva"
    }
    
    Response:
    {
        "action": "click",
        "x": 340,
        "y": 280,
        "reasoning": "Clicked the pink Valentine template at grid coordinates X:300-400, Y:250-300"
    }
    """
    screenshot = request.get("screenshot")
    task = request.get("task")
    context = request.get("context", "")
    
    print(f"🎯 Pure VLM: {task}")
    
    if not screenshot or not task:
        return {"action": "error", "reasoning": "screenshot and task required"}
    
    action = pure_vision_agent.execute_task(screenshot, task, context)
    
    return action

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
    
    Message types from client (extension):
    - tool_response: Result from tool execution
    - ping: Keep-alive
    - register: Client registration
    
    Message types to client:
    - tool_request: Request to execute tool
    - agent_status: Agent state updates
    - stream_chunk: Streaming execution updates
    """
    task_id = "default"
    await ws_manager.connect(websocket, task_id)
    
    try:
        while True:
            # Receive messages from extension
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "tool_response":
                # Handle tool execution result from extension
                print(f"✅ Tool response received: {message.get('tool')}")
                # Store result for agent loop to process
                
            elif message_type == "ping":
                # Respond to ping
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": message.get("timestamp")
                })
                
            elif message_type == "register":
                # Client registration
                print(f"✅ Client registered: {message.get('client_type')}")
                await websocket.send_json({
                    "type": "registered",
                    "status": "connected"
                })
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, task_id)
        print(f"Client disconnected from WebSocket")
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket, task_id)

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

@app.post("/vision/analyze")
async def vision_analyze(request: dict):
    """Analyze screenshot and answer questions"""
    screenshot = request.get("screenshot")
    question = request.get("question")
    
    if not screenshot or not question:
        return {"error": "screenshot and question are required"}
    
    answer = vision_automation.analyze_screenshot(screenshot, question)
    
    return {"answer": answer}

@app.post("/agent/execute")
async def agent_execute_streaming(request: dict):
    """
    Execute task with streaming updates (Server-Sent Events style)
    
    Example:
    {
        "prompt": "Go to example.com and click the login button",
        "task_id": "task-123"
    }
    
    Returns: Stream of execution updates
    """
    prompt = request.get("prompt")
    task_id = request.get("task_id") or f"task_{int(asyncio.get_event_loop().time())}"
    
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt required")
    
    async def generate_stream():
        """Generate SSE stream of execution updates"""
        try:
            async for update in agent_loop.execute_task(prompt, task_id):
                # Format as SSE
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            error_update = {
                "type": "error",
                "error": str(e),
                "task_id": task_id
            }
            yield f"data: {json.dumps(error_update)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    )

@app.get("/agent/status")
def agent_status():
    """Get current agent status"""
    return agent_loop.get_state()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🦊 Starting Foxy AI Backend on {host}:{port}")
    print(f"🧠 LLM Provider: {os.getenv('LLM_PROVIDER', 'openai')}")
    
    uvicorn.run(app, host=host, port=port)

