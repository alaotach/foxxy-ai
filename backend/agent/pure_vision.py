"""
Pure VLM Automation - Direct vision-to-action without LLM complexity
Uses only the vision model to see and act on the page
"""

import base64
import json
from typing import Dict, Optional, Tuple
import requests
import os
from PIL import Image, ImageDraw, ImageFont
import io
from datetime import datetime
from pathlib import Path


class PureVisionAgent:
    """Pure vision-based automation - VLM sees, decides, and acts"""
    
    def __init__(self):
        self.api_key = os.getenv("HACKCLUB_API_KEY")
        self.model = "qwen/qwen3-vl-235b-a22b-instruct"
        self.save_screenshots = os.getenv("SAVE_SCREENSHOTS", "false").lower() == "true"
        
        # Create screenshots directory if saving is enabled
        if self.save_screenshots:
            self.screenshot_dir = Path(__file__).parent.parent / "screenshots"
            self.screenshot_dir.mkdir(exist_ok=True)
            print(f"📁 Screenshot saving enabled: {self.screenshot_dir}")
        
    def add_coordinate_grid(self, screenshot_base64: str, grid_size: int = 50) -> Tuple[str, int, int]:
        """Add precise coordinate grid to screenshot"""
        try:
            img_data = base64.b64decode(screenshot_base64)
            img = Image.open(io.BytesIO(img_data))
            width, height = img.size
            
            draw = ImageDraw.Draw(img)
            
            # Load font
            try:
                font = ImageFont.truetype("arial.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            # Draw grid
            for x in range(0, width, grid_size):
                # Red vertical lines for X-axis
                draw.line([(x, 0), (x, height)], fill=(255, 0, 0, 100), width=1)
                if x % 100 == 0:  # Label every 100px
                    draw.text((x + 2, 2), str(x), fill=(255, 0, 0), font=font)
            
            for y in range(0, height, grid_size):
                # Green horizontal lines for Y-axis
                draw.line([(0, y), (width, y)], fill=(0, 255, 0, 100), width=1)
                if y % 100 == 0:  # Label every 100px
                    draw.text((2, y + 2), str(y), fill=(0, 255, 0), font=font)
            
            # Dimension label
            draw.text((width - 120, height - 25), f"{width}x{height}px", 
                     fill=(255, 255, 0), font=font)
            
            # Save if enabled
            if self.save_screenshots:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"grid_overlay_{timestamp}.png"
                filepath = self.screenshot_dir / filename
                img.save(filepath)
                print(f"💾 Saved screenshot: {filepath}")
            
            # Convert back to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8'), width, height
            
        except Exception as e:
            print(f"⚠️ Grid failed: {e}")
            img_data = base64.b64decode(screenshot_base64)
            img = Image.open(io.BytesIO(img_data))
            return screenshot_base64, img.size[0], img.size[1]
    
    def execute_task(self, screenshot_base64: str, task: str, context: str = "") -> Dict:
        """
        Execute a task using pure vision
        
        Args:
            screenshot_base64: Screenshot of current page
            task: What to do (e.g., "Click the first Valentine's Day template")
            context: Additional context about the goal
            
        Returns:
            Action to take: {type: 'click', x: int, y: int} or {type: 'type', text: str}
        """
        
        # Add grid overlay
        grid_img, width, height = self.add_coordinate_grid(screenshot_base64)
        
        prompt = f"""You are controlling a web browser. You can SEE the current page and must decide what action to take.

CURRENT GOAL: {task}
{f"CONTEXT: {context}" if context else ""}

COORDINATE SYSTEM:
- RED vertical lines = X-axis (numbers at top show X coordinates)
- GREEN horizontal lines = Y-axis (numbers at left show Y coordinates)
- Screen size: {width}x{height} pixels
- Grid spacing: 50px (labeled every 100px)

IMPORTANT RULES:
1. Coordinates MUST be within viewport: X < {width}, Y < {height}
2. If element is outside viewport, return {{"action": "scroll", "amount": 500}}
3. Count grid lines carefully - don't guess!
4. Click CENTER of elements, not edges

AVAILABLE ACTIONS:
1. Click: {{"action": "click", "x": 340, "y": 280, "reasoning": "Clicked blue button at grid X:300-400, Y:250-300"}}
2. Type: {{"action": "type", "text": "Valentine's Day", "reasoning": "Typed search query"}}
3. Scroll: {{"action": "scroll", "amount": 500, "reasoning": "Scrolling down to see more templates"}}
4. Wait: {{"action": "wait", "duration": 2000, "reasoning": "Waiting for page to load"}}
5. Done: {{"action": "done", "reasoning": "Task completed successfully"}}

TASK ANALYSIS:
- Look at the screenshot carefully
- Identify the element you need to interact with
- Use grid lines to determine EXACT coordinates
- If element not visible, scroll first
- Return ONE action as JSON

RESPOND WITH VALID JSON ONLY:
{{"action": "click", "x": 340, "y": 280, "reasoning": "Description of what you see and why"}}
"""
        
        try:
            print(f"🎯 Pure VLM task: {task}")
            
            response = requests.post(
                "https://ai.hackclub.com/proxy/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{grid_img}"}
                            }
                        ]
                    }],
                    "temperature": 0.3  # Lower temperature for more precise coordinates
                }
            )
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON response
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                action_json = content[json_start:json_end]
                action = json.loads(action_json)
                
                # Validate coordinates
                if action.get("action") == "click":
                    x, y = action.get("x", 0), action.get("y", 0)
                    
                    if x >= width or y >= height or x < 0 or y < 0:
                        print(f"⚠️ Invalid coords ({x},{y}) for viewport {width}x{height}, scrolling instead")
                        action = {
                            "action": "scroll",
                            "amount": 500,
                            "reasoning": f"Coordinates {x},{y} outside viewport, scrolling to find element"
                        }
                    else:
                        print(f"✅ VLM action: Click at ({x}, {y})")
                
                print(f"🧠 VLM reasoning: {action.get('reasoning', 'N/A')}")
                return action
            else:
                print(f"❌ Failed to parse VLM response: {content}")
                return {"action": "error", "reasoning": "Failed to parse VLM response"}
                
        except Exception as e:
            print(f"❌ Pure VLM error: {e}")
            import traceback
            traceback.print_exc()
            return {"action": "error", "reasoning": str(e)}
    
    def analyze_page(self, screenshot_base64: str, question: str) -> str:
        """Ask the VLM a question about what it sees"""
        
        grid_img, width, height = self.add_coordinate_grid(screenshot_base64)
        
        prompt = f"""Analyze this webpage screenshot and answer the question.

Screen size: {width}x{height} pixels
Question: {question}

Provide a clear, concise answer based on what you see."""
        
        try:
            response = requests.post(
                "https://ai.hackclub.com/proxy/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{grid_img}"}
                            }
                        ]
                    }]
                }
            )
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except Exception as e:
            return f"Error: {e}"
