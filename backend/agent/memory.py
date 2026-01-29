from agent.schema import TaskMemory, TaskPlan, ExecutionFeedback
from typing import Dict, Optional
from datetime import datetime

class MemoryManager:
    """
    Manages task memory for reflection and context.
    In production, this would use a database (Redis, PostgreSQL, etc.)
    """
    
    def __init__(self):
        self._memories: Dict[str, TaskMemory] = {}
    
    def create_memory(self, task_id: str, prompt: str, plan: TaskPlan) -> TaskMemory:
        """Create a new task memory"""
        memory = TaskMemory(
            task_id=task_id,
            original_prompt=prompt,
            plan=plan,
            status="pending"
        )
        self._memories[task_id] = memory
        return memory
    
    def update_status(self, task_id: str, status: str) -> Optional[TaskMemory]:
        """Update task status"""
        if task_id in self._memories:
            self._memories[task_id].status = status
            self._memories[task_id].updated_at = datetime.now()
            return self._memories[task_id]
        return None
    
    def add_feedback(self, task_id: str, feedback: ExecutionFeedback) -> Optional[TaskMemory]:
        """Add execution feedback to memory"""
        if task_id in self._memories:
            self._memories[task_id].feedback = feedback
            self._memories[task_id].updated_at = datetime.now()
            return self._memories[task_id]
        return None
    
    def increment_retry(self, task_id: str) -> Optional[TaskMemory]:
        """Increment retry count"""
        if task_id in self._memories:
            self._memories[task_id].retry_count += 1
            self._memories[task_id].updated_at = datetime.now()
            return self._memories[task_id]
        return None
    
    def get_memory(self, task_id: str) -> Optional[TaskMemory]:
        """Retrieve task memory"""
        return self._memories.get(task_id)
    
    def get_all_memories(self) -> Dict[str, TaskMemory]:
        """Get all task memories"""
        return self._memories.copy()
    
    def should_retry(self, task_id: str, max_retries: int = 3) -> bool:
        """Check if task should be retried"""
        memory = self.get_memory(task_id)
        if not memory:
            return False
        return memory.retry_count < max_retries
    
    def get_context_for_retry(self, task_id: str) -> Optional[Dict]:
        """Get context from previous attempts for replanning"""
        memory = self.get_memory(task_id)
        if not memory or not memory.feedback:
            return None
        
        return {
            "attempt": memory.retry_count,
            "last_plan": [step.model_dump() for step in memory.plan.steps],
            "feedback": memory.feedback.model_dump(),
            "failures": [
                result.model_dump() 
                for result in memory.feedback.completed_steps 
                if not result.success
            ]
        }

# Global memory manager instance
memory_manager = MemoryManager()
