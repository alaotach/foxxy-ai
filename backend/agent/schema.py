from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

class Step(BaseModel):
    """A single automation step"""
    id: str
    type: Literal["navigate", "click", "type", "scroll", "wait", "extract_text", "click_at", "screenshot", "vision_click"]
    selector: Optional[str] = None
    text: Optional[str] = None
    url: Optional[str] = None
    amount: Optional[int] = None
    timeout: Optional[int] = None
    x: Optional[int] = None  # X coordinate for click_at
    y: Optional[int] = None  # Y coordinate for click_at
    description: Optional[str] = None  # Description for vision-based clicks

class TaskPlan(BaseModel):
    """A complete automation plan"""
    task_id: str
    steps: List[Step]
    created_at: datetime = Field(default_factory=datetime.now)

class StepResult(BaseModel):
    """Result of executing a single step"""
    step_id: str
    success: bool
    error: Optional[str] = None
    observations: Optional[Dict[str, Any]] = None
    screenshot: Optional[str] = None  # Base64 encoded
    duration_ms: Optional[int] = None

class ExecutionFeedback(BaseModel):
    """Feedback from the automation core"""
    task_id: str
    completed_steps: List[StepResult]
    current_url: Optional[str] = None
    page_title: Optional[str] = None
    dom_summary: Optional[str] = None
    
class TaskMemory(BaseModel):
    """Memory of task execution for reflection"""
    task_id: str
    original_prompt: str
    plan: TaskPlan
    feedback: Optional[ExecutionFeedback] = None
    retry_count: int = 0
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
