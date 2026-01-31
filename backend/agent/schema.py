from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

class Step(BaseModel):
    """A single automation step"""
    id: str
    type: Literal["navigate", "click", "type", "scroll", "wait", "extract_text", "click_at", "screenshot", "vision_click", "seek", "seek_text", "seek_element", "seek_vision", "seek_percentage", "seek_dom", "stock_analysis", "stock_monitor"]
    selector: Optional[str] = None
    text: Optional[str] = None
    url: Optional[str] = None
    amount: Optional[int] = None
    timeout: Optional[int] = None
    x: Optional[int] = None  # X coordinate for click_at
    y: Optional[int] = None  # Y coordinate for click_at
    description: Optional[str] = None  # Description for vision-based clicks
    seek_query: Optional[str] = None  # What to seek (text, element, or visual description)
    seek_action: Optional[Literal["highlight", "extract", "click", "monitor"]] = "highlight"  # What to do when found
    continuous: Optional[bool] = False  # Whether to keep seeking
    # Stock analysis fields
    stock_symbol: Optional[str] = None  # Stock symbol for analysis
    analysis_prompt: Optional[str] = None  # Technical analysis prompt
    screenshot_interval: Optional[int] = 10  # Screenshot frequency for stock monitoring
    whatsapp_number: Optional[str] = None  # WhatsApp number for alerts

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
    
class SeekResult(BaseModel):
    """Result of a seek operation"""
    found: bool
    elements: Optional[List[Dict[str, Any]]] = None  # Found elements with coordinates
    text_content: Optional[str] = None  # Extracted text if found
    screenshot: Optional[str] = None  # Screenshot with highlights
    timestamp: datetime = Field(default_factory=datetime.now)

class TaskMemory(BaseModel):
    """Memory of task execution for reflection"""
    task_id: str
    original_prompt: str
    plan: TaskPlan
    feedback: Optional[ExecutionFeedback] = None
    retry_count: int = 0
    status: Literal["pending", "in_progress", "completed", "failed", "seeking"] = "pending"
    seek_mode: bool = False  # Whether task is in seek mode
    seek_results: List[SeekResult] = []  # History of seek findings
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
