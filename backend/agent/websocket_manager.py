from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, task_id: str = "default"):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        self.active_connections[task_id].add(websocket)
        print(f"✅ WebSocket connected for task: {task_id}")
    
    def disconnect(self, websocket: WebSocket, task_id: str = "default"):
        """Remove a WebSocket connection"""
        if task_id in self.active_connections:
            self.active_connections[task_id].discard(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
        print(f"🔌 WebSocket disconnected for task: {task_id}")
    
    async def send_message(self, message: dict, task_id: str = "default"):
        """Send message to all connections for a task"""
        if task_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending to connection: {e}")
                    disconnected.add(connection)
            
            # Clean up disconnected connections
            for conn in disconnected:
                self.disconnect(conn, task_id)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connections"""
        for task_id in list(self.active_connections.keys()):
            await self.send_message(message, task_id)
    
    async def stream_planning(self, prompt: str, task_id: str):
        """Stream planning progress"""
        await self.send_message({
            "type": "planning_start",
            "prompt": prompt,
            "task_id": task_id
        }, task_id)
    
    async def stream_step(self, step: dict, step_num: int, total: int, task_id: str):
        """Stream individual step execution"""
        await self.send_message({
            "type": "step_executing",
            "step": step,
            "step_num": step_num,
            "total": total,
            "task_id": task_id
        }, task_id)
    
    async def stream_result(self, result: dict, task_id: str):
        """Stream step result"""
        await self.send_message({
            "type": "step_result",
            "result": result,
            "task_id": task_id
        }, task_id)
    
    async def stream_complete(self, summary: dict, task_id: str):
        """Stream completion summary"""
        await self.send_message({
            "type": "execution_complete",
            "summary": summary,
            "task_id": task_id
        }, task_id)
    
    async def stream_error(self, error: str, task_id: str):
        """Stream error message"""
        await self.send_message({
            "type": "error",
            "error": error,
            "task_id": task_id
        }, task_id)

# Global instance
manager = ConnectionManager()
