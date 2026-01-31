"""
Seek Mode API Endpoints for FastAPI
Add these to your main.py or create a separate router
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from agent.agent_loop import agent_loop
from agent.seek_mode import seek_mode
import uuid

router = APIRouter(prefix="/api/seek", tags=["seek"])


class SeekRequest(BaseModel):
    """Request to start a seek operation"""
    query: str
    seek_type: Literal["text", "element", "vision", "percentage", "dom", "auto", "stock"] = "auto"
    action: Literal["highlight", "extract", "click", "monitor", "alert"] = "highlight"
    continuous: bool = False
    screenshot_base64: Optional[str] = None
    # Stock monitoring specific fields
    stock_symbol: Optional[str] = None
    whatsapp_number: Optional[str] = None
    screenshot_interval: Optional[int] = 10


class StockMonitorRequest(BaseModel):
    """Request to start stock monitoring"""
    analysis_prompt: str
    stock_symbol: Optional[str] = None
    whatsapp_number: Optional[str] = None
    screenshot_interval: int = 10
    screenshot_base64: Optional[str] = None


class QuickSeekRequest(BaseModel):
    """Quick one-shot seek request"""
    query: str
    seek_type: Literal["text", "element", "vision", "percentage", "dom", "auto", "stock"] = "auto"
    screenshot_base64: Optional[str] = None


@router.websocket("/stock/ws/{task_id}")
async def stock_monitoring_websocket(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for stock monitoring with real-time analysis
    
    Usage:
        ws = new WebSocket('ws://localhost:8000/api/seek/stock/ws/stock-task-123')
        ws.send(JSON.stringify({
            analysis_prompt: "RSI below 30 and price breaks support",
            stock_symbol: "AAPL",
            whatsapp_number: "+1234567890",
            screenshot_interval: 10,
            screenshot_base64: "..."
        }))
    """
    await websocket.accept()
    
    try:
        # Receive stock monitoring request
        data = await websocket.receive_json()
        request = StockMonitorRequest(**data)
        
        # Start stock monitoring and stream updates
        async for update in agent_loop.start_stock_monitoring(
            task_id=task_id,
            analysis_prompt=request.analysis_prompt,
            stock_symbol=request.stock_symbol,
            whatsapp_number=request.whatsapp_number,
            screenshot_interval=request.screenshot_interval
        ):
            await websocket.send_json(update)
            
    except WebSocketDisconnect:
        print(f"Client disconnected from stock monitoring: {task_id}")
        # Stop monitoring if client disconnects
        await agent_loop.stop_seek_mode(task_id)
    except Exception as e:
        await websocket.send_json({
            "type": "stock_monitoring_error",
            "error": str(e),
            "task_id": task_id
        })
async def seek_websocket(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for real-time seek updates
    
    Usage:
        ws = new WebSocket('ws://localhost:8000/api/seek/ws/task-123')
        ws.send(JSON.stringify({
            query: "Subscribe button",
            seek_type: "vision",
            action: "highlight",
            continuous: false,
            screenshot_base64: "..."
        }))
    """
    await websocket.accept()
    
    try:
        # Receive seek request
        data = await websocket.receive_json()
        request = SeekRequest(**data)
        
        # Special handling for stock monitoring
        if request.seek_type == "stock":
            # Start stock monitoring instead of regular seek
            async for update in agent_loop.start_stock_monitoring(
                task_id=task_id,
                analysis_prompt=request.query,
                stock_symbol=request.stock_symbol,
                whatsapp_number=request.whatsapp_number,
                screenshot_interval=request.screenshot_interval or 10
            ):
                await websocket.send_json(update)
        else:
            # Regular seek mode
            async for update in agent_loop.start_seek_mode(
                task_id=task_id,
                query=request.query,
                seek_type=request.seek_type,
                action=request.action,
                continuous=request.continuous,
                screenshot_base64=request.screenshot_base64
            ):
                await websocket.send_json(update)
            
    except WebSocketDisconnect:
        print(f"Client disconnected from seek websocket: {task_id}")
        # Stop seeking if client disconnects
        await agent_loop.stop_seek_mode(task_id)
    except Exception as e:
        await websocket.send_json({
            "type": "seek_error",
            "error": str(e),
            "task_id": task_id
        })


@router.post("/stock/start")
async def start_stock_monitoring(request: StockMonitorRequest):
    """
    Start stock chart monitoring (non-streaming)
    Returns immediately with task_id for status checking
    
    Example:
        POST /api/seek/stock/start
        {
            "analysis_prompt": "RSI below 30 and MACD bullish crossover",
            "stock_symbol": "TSLA",
            "whatsapp_number": "+1234567890",
            "screenshot_interval": 10
        }
    """
    task_id = f"stock-monitor-{uuid.uuid4().hex[:8]}"
    
    # Initialize with screenshot if provided
    if request.screenshot_base64:
        agent_loop.seek_mode.update_screenshot(task_id, request.screenshot_base64)
    
    return {
        "task_id": task_id,
        "status": "started",
        "analysis_prompt": request.analysis_prompt,
        "stock_symbol": request.stock_symbol,
        "screenshot_interval": request.screenshot_interval
    }


@router.post("/stock/screenshot/{task_id}")
async def update_stock_screenshot(task_id: str, screenshot_data: dict):
    """
    Update screenshot for active stock monitoring
    
    Example:
        POST /api/seek/stock/screenshot/stock-monitor-abc123
        {
            "screenshot_base64": "data:image/png;base64,..."
        }
    """
    screenshot_base64 = screenshot_data.get("screenshot_base64")
    
    if not screenshot_base64:
        raise HTTPException(status_code=400, detail="screenshot_base64 required")
    
    await agent_loop.update_stock_screenshot(task_id, screenshot_base64)
    
    return {
        "task_id": task_id,
        "status": "screenshot_updated",
        "timestamp": datetime.now().isoformat()
    }
async def start_seek(request: SeekRequest):
    """
    Start a seek operation (non-streaming)
    Returns immediately with task_id for status checking
    
    Example:
        POST /api/seek/start
        {
            "query": "Login button",
            "seek_type": "vision",
            "action": "highlight",
            "continuous": false
        }
    """
    task_id = f"seek-{uuid.uuid4().hex[:8]}"
    
    # Start seek in background
    # Note: In production, use background tasks or Celery
    # For now, return task_id immediately
    
    return {
        "task_id": task_id,
        "status": "started",
        "query": request.query,
        "seek_type": request.seek_type
    }


@router.post("/stop/{task_id}")
async def stop_seek(task_id: str):
    """
    Stop an active seek operation
    
    Example:
        POST /api/seek/stop/seek-abc123
    """
    stopped = await agent_loop.stop_seek_mode(task_id)
    
    if stopped:
        return {
            "task_id": task_id,
            "status": "stopped",
            "success": True
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No active seek found for task_id: {task_id}"
        )


@router.post("/quick")
async def quick_seek(request: QuickSeekRequest):
    """
    Quick one-shot seek (non-streaming)
    Returns result immediately
    
    Example:
        POST /api/seek/quick
        {
            "query": "Subscribe",
            "seek_type": "auto"
        }
    """
    result = await seek_mode.quick_seek(
        query=request.query,
        screenshot_base64=request.screenshot_base64,
        seek_type=request.seek_type
    )
    
    return result


@router.get("/history/{task_id}")
async def get_seek_history(task_id: str):
    """
    Get seek history for a task
    
    Example:
        GET /api/seek/history/seek-abc123
    """
    history = seek_mode.get_seek_history(task_id)
    
    return {
        "task_id": task_id,
        "results": [result.dict() for result in history],
        "count": len(history)
    }


@router.delete("/history/{task_id}")
async def clear_seek_history(task_id: str):
    """
    Clear seek history for a task
    
    Example:
        DELETE /api/seek/history/seek-abc123
    """
    seek_mode.clear_seek_history(task_id)
    
    return {
        "task_id": task_id,
        "status": "cleared"
    }


@router.get("/status/{task_id}")
async def get_seek_status(task_id: str):
    """
    Check if a seek is currently active
    
    Example:
        GET /api/seek/status/seek-abc123
    """
    is_active = seek_mode.is_seeking(task_id)
    history = seek_mode.get_seek_history(task_id)
    
    return {
        "task_id": task_id,
        "is_active": is_active,
        "results_count": len(history),
        "status": "seeking" if is_active else "idle"
    }


@router.get("/state")
async def get_agent_state():
    """
    Get current agent state including seek status
    
    Example:
        GET /api/seek/state
    """
    return agent_loop.get_state()


# Example usage in main.py:
"""
from fastapi import FastAPI
from agent.seek_api import router as seek_router

app = FastAPI()
app.include_router(seek_router)
"""
