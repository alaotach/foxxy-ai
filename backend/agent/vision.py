import base64
import json
from typing import Dict, Tuple, Optional
import anthropic
import os
from openai import OpenAI

class VisionAutomation:
    """Vision-based automation using screenshots and AI"""
    
    def __init__(self, provider: str = "hackclub"):
        self.provider = provider
        if provider == "hackclub":
            self.client = OpenAI(
                api_key=os.getenv("HACKCLUB_API_KEY"),
                base_url="https://api.hackclub.app/v1"
            )
            self.model = "nvidia/nemotron-nano-12b-v2-vl"
        elif provider == "anthropic":
            self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            self.model = "claude-3-5-sonnet-20241022"
        elif provider == "openai":
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.model = "gpt-4o"
    
    def find_element_coordinates(
        self, 
        screenshot_base64: str, 
        description: str,
        viewport_width: int = 1920,
        viewport_height: int = 1080
    ) -> Optional[Tuple[int, int]]:
        """Find coordinates of an element in a screenshot using vision AI"""
        
        prompt = f"""You are helping automate browser interactions. Look at this screenshot and find the element described as: "{description}"

Provide the X,Y coordinates where I should click (in pixels from top-left corner).
Viewport size: {viewport_width}x{viewport_height}

Respond ONLY with JSON in this format:
{{
  "x": 123,
  "y": 456,
  "confidence": "high",
  "reasoning": "The search button is located at..."
}}

If you cannot find the element, respond with:
{{
  "x": null,
  "y": null,
  "confidence": "none",
  "reasoning": "Element not found because..."
}}"""
        
        try:
            if self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=500,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": screenshot_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }]
                )
                result_text = response.content[0].text
            else:  # OpenAI or HackClub
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{screenshot_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }],
                    max_tokens=500
                )
                result_text = response.choices[0].message.content
            
            # Parse JSON response
            result = json.loads(result_text.strip())
            
            if result.get("x") and result.get("y"):
                print(f"✅ Found element at ({result['x']}, {result['y']}) - {result.get('reasoning')}")
                return (result["x"], result["y"])
            else:
                print(f"❌ Element not found - {result.get('reasoning')}")
                return None
                
        except Exception as e:
            print(f"❌ Vision error: {e}")
            return None
    
    def analyze_screenshot(
        self,
        screenshot_base64: str,
        question: str
    ) -> str:
        """Analyze a screenshot and answer a question about it"""
        
        try:
            if self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1000,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": screenshot_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": question
                            }
                        ]
                    }]
                )
                return response.content[0].text
            else:  # OpenAI or HackClub
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{screenshot_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": question
                            }
                        ]
                    }],
                    max_tokens=1000
                )
                return response.choices[0].message.content
        except Exception as e:
            return f"Error: {e}"
