from agent.schema import TaskPlan, Step
import uuid
import os
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from dotenv import load_dotenv
import json

load_dotenv()

# Initialize LLM based on provider
def get_llm():
    provider = os.getenv("LLM_PROVIDER", "hackclub")
    
    if provider == "hackclub":
        # HackClub AI proxy - OpenAI compatible
        return ChatOpenAI(
            model=os.getenv("HACKCLUB_MODEL", "qwen/qwen3-32b"),
            temperature=0.1,
            openai_api_key=os.getenv("HACKCLUB_API_KEY"),
            openai_api_base="https://ai.hackclub.com/proxy/v1"
        )
    elif provider == "openai":
        return ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview"),
            temperature=0.1
        )
    elif provider == "anthropic":
        return ChatAnthropic(
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229"),
            temperature=0.1
        )
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")

# Prompt template for browser automation
PLANNING_PROMPT = """You are an expert browser automation planner. Convert the user's intent into a precise sequence of browser actions.

Available action types:
- navigate: Go to a URL
- click: Click on an element (requires selector)
- type: Type text into an input (requires selector and text)
- scroll: Scroll the page (amount in pixels)
- wait: Wait for an element to appear (requires selector)
- extract_text: Extract text from an element (requires selector)

Rules:
1. Be specific with selectors (prefer text selectors like 'text=Login' or CSS selectors)
2. Always navigate before other actions
3. Add waits when elements might take time to load
4. Keep steps atomic and simple
5. Return valid JSON matching the schema

User Request: {prompt}

Return a JSON object with this exact structure:
{{
  "task_id": "unique-id",
  "steps": [
    {{
      "id": "step-1",
      "type": "navigate|click|type|scroll|wait|extract_text",
      "selector": "optional css or text selector",
      "text": "optional text to type",
      "url": "optional url for navigate",
      "amount": "optional pixels for scroll",
      "timeout": "optional milliseconds"
    }}
  ]
}}

Return ONLY valid JSON, no explanations."""

def plan_task(prompt: str, context: Dict[str, Any] = None) -> TaskPlan:
    """
    Convert a natural language prompt into a structured browser automation plan.
    
    Args:
        prompt: User's intent (e.g., "login to example.com with my credentials")
        context: Optional context from previous steps (failures, observations)
    
    Returns:
        TaskPlan with structured steps
    """
    llm = get_llm()
    
    # Add context to prompt if provided
    full_prompt = prompt
    if context:
        try:
            # Safely serialize context, escaping any problematic characters
            context_str = json.dumps(context, indent=2, ensure_ascii=True)
            full_prompt = f"{prompt}\n\nContext from previous attempt:\n{context_str}"
        except Exception as e:
            print(f"⚠️ Failed to serialize context: {e}")
            full_prompt = f"{prompt}\n\nContext: (serialization failed)"
    
    # Create the planning chain
    planning_chain = ChatPromptTemplate.from_template(PLANNING_PROMPT) | llm | JsonOutputParser()
    
    try:
        # Get LLM response
        result = planning_chain.invoke({"prompt": full_prompt})
        
        # Parse into TaskPlan
        steps = [Step(**step) for step in result["steps"]]
        
        return TaskPlan(
            task_id=result.get("task_id", str(uuid.uuid4())),
            steps=steps
        )
    except Exception as e:
        # Fallback to a simple plan on error
        print(f"Error planning task: {e}")
        return TaskPlan(
            task_id=str(uuid.uuid4()),
            steps=[
                Step(
                    id="error-step",
                    type="navigate",
                    url="about:blank"
                )
            ]
        )


def replan_with_feedback(
    original_prompt: str,
    failed_step: Dict[str, Any],
    error_message: str,
    observations: Dict[str, Any] = None
) -> TaskPlan:
    """
    Replan based on execution failure.
    
    Args:
        original_prompt: Original user request
        failed_step: The step that failed
        error_message: Error from automation core
        observations: DOM state, screenshots, etc.
    
    Returns:
        New TaskPlan attempting to recover
    """
    context = {
        "failed_step": failed_step,
        "error": error_message,
        "observations": observations or {}
    }
    
    return plan_task(original_prompt, context=context)


def plan_task_with_vision(prompt: str, screenshot_base64: str, viewport_info: dict, context: Any = None) -> TaskPlan:
    """
    Plan a task using vision - AI sees the screenshot and creates visual descriptions
    instead of guessing CSS selectors
    """
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    
    # Use LLM to create intelligent plan
    llm = get_llm()
    
    planning_prompt = f"""You are a browser automation planner. Create a step-by-step plan for: "{prompt}"

Current page: {viewport_info.get('url', 'unknown')}
Current title: {viewport_info.get('title', 'unknown')}

Rules:
1. If the task requires a specific website (like Canva, YouTube, etc.) and we're not already there, add a navigate step first
2. If you don't know the exact URL, add a navigate to https://www.google.com and then search for the website
3. Use vision_click for all clicking (describe what to click, like "login button" or "create new presentation")
4. Use type for entering text
5. Add wait steps (1-2 seconds) after navigation or important actions
6. The system will handle login screens automatically if vision sees them

Available step types:
- navigate: Go to URL
- vision_click: Click element (describe it visually)
- type: Type text into focused field
- wait: Wait milliseconds
- scroll: Scroll pixels

Respond with JSON array of steps:
[
  {{"id": "step-1", "type": "navigate", "url": "https://www.canva.com"}},
  {{"id": "step-2", "type": "wait", "timeout": 2000}},
  {{"id": "step-3", "type": "vision_click", "description": "create button or plus icon"}},
  {{"id": "step-4", "type": "vision_click", "description": "presentation template"}}
]

Return ONLY the JSON array, nothing else."""
    
    try:
        response = llm.invoke(planning_prompt)
        steps_json = response.content
        
        # Extract JSON array
        import re
        json_match = re.search(r'\[.*\]', steps_json, re.DOTALL)
        if json_match:
            steps_data = json.loads(json_match.group())
            steps = [Step(**step) for step in steps_data]
        else:
            # Fallback to simple plan
            steps = [Step(id="step-1", type="vision_click", description=prompt)]
    except Exception as e:
        print(f"Planning error: {e}, using fallback")
        # Fallback simple plan
        steps = [Step(id="step-1", type="vision_click", description=prompt)]
    
    return TaskPlan(task_id=task_id, steps=steps)

