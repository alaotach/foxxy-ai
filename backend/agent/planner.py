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
        full_prompt = f"{prompt}\n\nContext from previous attempt:\n{json.dumps(context, indent=2)}"
    
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
