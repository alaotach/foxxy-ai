"""
Agent Loop - BrowserOS-inspired agent execution system
Integrates LLM with tool calling and streaming execution
"""
from typing import Dict, List, Any, Optional, AsyncIterator
from agent.schema import TaskPlan, Step
from agent.planner import plan_task
from agent.websocket_manager import manager as ws_manager
from agent.seek_mode import seek_mode
import asyncio
import json
import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from dotenv import load_dotenv

load_dotenv()

class AgentLoop:
    """
    Main agent execution loop
    Similar to BrowserOS's GeminiAgent
    """
    
    def __init__(self):
        self.llm = self.get_llm()
        self.current_task = None
        self.execution_state = "idle"
        self.seek_mode = seek_mode  # Integrate seek mode
        
    def get_llm(self):
        """Get configured LLM"""
        provider = os.getenv("LLM_PROVIDER", "hackclub")
        
        if provider == "hackclub":
            return ChatOpenAI(
                model=os.getenv("HACKCLUB_MODEL", "qwen/qwen3-32b"),
                temperature=0.1,
                openai_api_key=os.getenv("HACKCLUB_API_KEY"),
                openai_api_base="https://ai.hackclub.com/proxy/v1",
                streaming=True
            )
        elif provider == "openai":
            return ChatOpenAI(
                model=os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview"),
                temperature=0.1,
                streaming=True
            )
        elif provider == "anthropic":
            return ChatAnthropic(
                model=os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229"),
                temperature=0.1,
                streaming=True
            )
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")
    
    async def execute_task(
        self,
        prompt: str,
        task_id: str,
        stream: bool = True
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task with streaming updates
        
        Args:
            prompt: User's natural language request
            task_id: Unique task identifier
            stream: Whether to stream responses
            
        Yields:
            Status updates and results
        """
        self.current_task = task_id
        self.execution_state = "planning"
        
        try:
            # Send message to show automation aura
            await self.websocket_manager.send_to_extension({
                "action": "startAutomation"
            })
            
            # Step 1: Planning phase
            yield {
                "type": "status",
                "status": "planning",
                "message": "Creating execution plan...",
                "task_id": task_id
            }
            
            # Get plan from LLM
            plan = plan_task(prompt)
            
            yield {
                "type": "plan_created",
                "plan": plan.dict(),
                "task_id": task_id,
                "step_count": len(plan.steps)
            }
            
            # Step 2: Execution phase
            self.execution_state = "executing"
            
            for step_num, step in enumerate(plan.steps, 1):
                yield {
                    "type": "step_start",
                    "step": step.dict(),
                    "step_num": step_num,
                    "total": len(plan.steps),
                    "task_id": task_id
                }
                
                # Execute step via tool
                result = await self.execute_step(step, task_id)
                
                yield {
                    "type": "step_complete",
                    "step": step.dict(),
                    "result": result,
                    "step_num": step_num,
                    "total": len(plan.steps),
                    "task_id": task_id
                }
                
                # If step failed and critical, stop
                if not result.get("success") and step.type in ["navigate", "wait"]:
                    yield {
                        "type": "error",
                        "error": f"Critical step failed: {result.get('error')}",
                        "step_num": step_num,
                        "task_id": task_id
                    }
                    break
            
            # Step 3: Completion
            self.execution_state = "completed"
            
            # Hide automation aura
            await self.websocket_manager.send_to_extension({
                "action": "stopAutomation"
            })
            
            yield {
                "type": "task_complete",
                "task_id": task_id,
                "steps_executed": len(plan.steps),
                "message": "Task completed successfully"
            }
            
        except Exception as e:
            self.execution_state = "failed"
            
            # Hide automation aura on error too
            await self.websocket_manager.send_to_extension({
                "action": "stopAutomation"
            })
            
            yield {
                "type": "error",
                "error": str(e),
                "task_id": task_id
            }
        
        finally:
            self.current_task = None
            self.execution_state = "idle"
    
    async def execute_step(self, step: Step, task_id: str) -> Dict[str, Any]:
        """
        Execute a single step by sending tool request to extension
        
        Args:
            step: Step to execute
            task_id: Task identifier
            
        Returns:
            Execution result
        """
        # Map step type to tool name
        tool_map = {
            "navigate": "navigate",
            "click": "click",
            "type": "type",
            "scroll": "scroll",
            "wait": "wait_for_element",
            "extract_text": "extract_text"
        }
        
        tool_name = tool_map.get(step.type, step.type)
        
        # Prepare tool parameters from step
        params = {
            "selector": step.selector,
            "text": step.text,
            "url": step.url,
            "amount": step.amount,
            "timeout": step.timeout or 10000
        }
        
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        # Send tool request via WebSocket
        tool_request = {
            "id": f"{task_id}_{step.id}",
            "type": "tool_request",
            "tool": tool_name,
            "params": params,
            "task_id": task_id
        }
        
        # Broadcast to WebSocket clients
        await ws_manager.send_message(tool_request, task_id)
        
        # In real implementation, we would wait for response
        # For now, return simulated result
        return {
            "success": True,
            "tool": tool_name,
            "params": params,
            "duration_ms": 0
        }

    
    async def execute_with_reflection(
        self,
        prompt: str,
        task_id: str,
        max_retries: int = 2
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute task with reflection and retry capability
        Similar to BrowserOS's reflection loop
        
        Args:
            prompt: User request
            task_id: Task ID
            max_retries: Maximum retry attempts
            
        Yields:
            Status updates and results
        """
        context = {}
        
        for attempt in range(max_retries + 1):
            if attempt > 0:
                yield {
                    "type": "status",
                    "status": "replanning",
                    "message": f"Replanning (attempt {attempt + 1}/{max_retries + 1})...",
                    "task_id": task_id
                }
            
            # Execute task
            async for update in self.execute_task(prompt, task_id):
                yield update
                
                # Collect context for reflection
                if update["type"] == "step_complete":
                    if not update["result"].get("success"):
                        context[f"step_{update['step_num']}_error"] = update["result"].get("error")
                
                # Check if task completed successfully
                if update["type"] == "task_complete":
                    return
                
                # Check if error occurred
                if update["type"] == "error":
                    if attempt >= max_retries:
                        yield {
                            "type": "task_failed",
                            "message": "Max retries exceeded",
                            "task_id": task_id
                        }
                        return
                    break
    
    def get_state(self) -> Dict[str, Any]:
        """Get current agent state"""
        return {
            "execution_state": self.execution_state,
            "current_task": self.current_task,
            "llm_provider": os.getenv("LLM_PROVIDER", "hackclub"),
            "seek_active": self.seek_mode.is_seeking(self.current_task) if self.current_task else False
        }
    
    async def start_seek_mode(
        self,
        task_id: str,
        query: str,
        seek_type: str = "auto",
        action: str = "highlight",
        continuous: bool = False,
        screenshot_base64: Optional[str] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Start seek mode to search for elements on the page
        
        Args:
            task_id: Unique task identifier
            query: What to search for
            seek_type: Type of seek (text, element, vision, auto)
            action: What to do when found (highlight, extract, click, monitor)
            continuous: Keep seeking until stopped
            screenshot_base64: Current page screenshot
            
        Yields:
            Seek updates and results
        """
        self.current_task = task_id
        self.execution_state = "seeking"
        
        try:
            # Send visual feedback to extension
            await ws_manager.send_message({
                "action": "startSeekMode",
                "query": query,
                "seek_type": seek_type
            }, task_id)
            
            # Start seek operation
            async for update in self.seek_mode.start_seek(
                task_id=task_id,
                seek_type=seek_type,
                query=query,
                action=action,
                continuous=continuous,
                screenshot_base64=screenshot_base64
            ):
                # Forward updates to WebSocket clients
                await ws_manager.send_message(update, task_id)
                yield update
            
            # Stop seek mode visual feedback
            await ws_manager.send_message({
                "action": "stopSeekMode"
            }, task_id)
            
        except Exception as e:
            yield {
                "type": "seek_error",
                "error": str(e),
                "task_id": task_id
            }
        finally:
            self.execution_state = "idle"
            self.current_task = None
    
    async def stop_seek_mode(self, task_id: str):
        """Stop seek mode for a task"""
        stopped = self.seek_mode.stop_seek(task_id)
        
        if stopped:
            await ws_manager.send_message({
                "action": "stopSeekMode",
                "task_id": task_id
            }, task_id)
        
        return stopped
    
    async def start_stock_monitoring(
        self,
        task_id: str,
        analysis_prompt: str,
        stock_symbol: Optional[str] = None,
        whatsapp_number: Optional[str] = None,
        screenshot_interval: int = 10,
        get_screenshot_func: Optional[callable] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Start stock chart monitoring with technical analysis
        
        Args:
            task_id: Unique task identifier
            analysis_prompt: What to analyze (e.g., "RSI below 30 and MACD bullish")
            stock_symbol: Stock symbol being monitored
            whatsapp_number: Phone number for WhatsApp alerts
            screenshot_interval: Screenshot frequency in seconds (default: 10)
            get_screenshot_func: Function to get fresh screenshots
            
        Yields:
            Stock analysis updates and signal alerts
        """
        self.current_task = task_id
        self.execution_state = "stock_monitoring"
        
        try:
            # Send visual feedback to extension
            await ws_manager.send_message({
                "action": "startStockMonitoring",
                "stock_symbol": stock_symbol,
                "analysis_prompt": analysis_prompt,
                "screenshot_interval": screenshot_interval
            }, task_id)
            
            # Start stock monitoring
            async for update in self.seek_mode.start_stock_monitoring(
                task_id=task_id,
                analysis_prompt=analysis_prompt,
                stock_symbol=stock_symbol,
                phone_number=whatsapp_number,
                screenshot_interval=screenshot_interval,
                get_screenshot_func=get_screenshot_func
            ):
                # Forward updates to WebSocket clients
                await ws_manager.send_message(update, task_id)
                yield update
            
            # Stop monitoring visual feedback
            await ws_manager.send_message({
                "action": "stopStockMonitoring"
            }, task_id)
            
        except Exception as e:
            yield {
                "type": "stock_monitoring_error",
                "error": str(e),
                "task_id": task_id
            }
        finally:
            self.execution_state = "idle"
            self.current_task = None
    
    async def update_stock_screenshot(self, task_id: str, screenshot_base64: str):
        """
        Update screenshot for stock monitoring task
        """
        from datetime import datetime
        
        self.seek_mode.update_screenshot(task_id, screenshot_base64)
        
        await ws_manager.send_message({
            "action": "screenshotUpdated",
            "task_id": task_id,
            "timestamp": datetime.now().isoformat()
        }, task_id)


# Global agent loop instance
agent_loop = AgentLoop()
