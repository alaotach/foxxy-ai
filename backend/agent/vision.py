import base64
import json
from typing import Dict, Tuple, Optional
import anthropic
import os
import requests
from PIL import Image, ImageDraw, ImageFont
import io
from datetime import datetime
from pathlib import Path

class VisionAutomation:
    """Vision-based automation using screenshots and AI"""
    
    def __init__(self, provider: str = "hackclub"):
        self.provider = provider
        self.api_key = os.getenv("HACKCLUB_API_KEY")
        self.model = "nvidia/nemotron-nano-12b-v2-vl"
        self.save_screenshots = os.getenv("SAVE_SCREENSHOTS", "false").lower() == "true"
        
        # Create screenshots directory if saving is enabled
        if self.save_screenshots:
            self.screenshot_dir = Path(__file__).parent.parent / "screenshots"
            self.screenshot_dir.mkdir(exist_ok=True)
    
    def add_grid_overlay(
        self, 
        screenshot_base64: str, 
        grid_spacing: int = 50
    ) -> Tuple[str, int, int]:
        """Add numbered grid overlay to screenshot for precise coordinate reference
        
        Args:
            screenshot_base64: Base64 encoded PNG screenshot
            grid_spacing: Spacing between grid lines in pixels (default: 50)
            
        Returns:
            Tuple of (base64 image with grid, width, height)
        """
        try:
            # Decode base64 image
            img_data = base64.b64decode(screenshot_base64)
            img = Image.open(io.BytesIO(img_data))
            width, height = img.size
            
            # Create drawing context
            draw = ImageDraw.Draw(img)
            
            # Try to load a font, fallback to default if not available
            try:
                font = ImageFont.truetype("arial.ttf", 14)
            except:
                font = ImageFont.load_default()
            
            # Draw vertical grid lines (X-axis)
            for x in range(0, width, grid_spacing):
                # Draw line
                draw.line([(x, 0), (x, height)], fill=(255, 0, 0, 128), width=1)
                # Draw X coordinate label at top
                label = str(x)
                draw.text((x + 2, 2), label, fill=(255, 0, 0), font=font)
            
            # Draw horizontal grid lines (Y-axis)
            for y in range(0, height, grid_spacing):
                # Draw line
                draw.line([(0, y), (width, y)], fill=(0, 255, 0, 128), width=1)
                # Draw Y coordinate label at left
                label = str(y)
                draw.text((2, y + 2), label, fill=(0, 255, 0), font=font)
            
            # Add corner label showing dimensions
            dim_label = f"{width}x{height}"
            draw.text((width - 100, height - 20), dim_label, fill=(255, 255, 0), font=font)
            
            # Save if enabled
            if self.save_screenshots:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"hybrid_grid_{timestamp}.png"
                filepath = self.screenshot_dir / filename
                img.save(filepath)
                print(f"💾 Saved hybrid screenshot: {filepath}")
            
            # Convert back to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            grid_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            print(f"✅ Added grid overlay: {width}x{height}, spacing={grid_spacing}px")
            return grid_base64, width, height
            
        except Exception as e:
            print(f"⚠️ Grid overlay failed: {e}, using original image")
            # Return original if grid fails
            img_data = base64.b64decode(screenshot_base64)
            img = Image.open(io.BytesIO(img_data))
            return screenshot_base64, img.size[0], img.size[1]
    
    def find_element_coordinates(
        self, 
        screenshot_base64: str, 
        description: str,
        viewport_width: int = 1920,
        viewport_height: int = 1080
    ) -> Optional[Tuple[int, int]]:
        """Find coordinates of an element in a screenshot using vision AI"""
        
        # Add grid overlay for precise coordinates
        grid_screenshot, actual_width, actual_height = self.add_grid_overlay(screenshot_base64)
        viewport_width = actual_width
        viewport_height = actual_height
        
        prompt = f"""You are a precision web automation assistant analyzing a webpage screenshot with coordinate grid.

COORDINATE GRID:
- RED vertical lines = X-axis (labeled with X coordinates every 100px)
- GREEN horizontal lines = Y-axis (labeled with Y coordinates every 100px)
- Image dimensions: {viewport_width}x{viewport_height} pixels
- USE THE GRID NUMBERS to determine exact coordinates

TASK: Find and locate "{description}"

VISUAL ANALYSIS GUIDE:
1. Input Fields/Textboxes: White or light-colored rectangles with borders, often with placeholder text
   - Look for comment boxes, search bars, text areas
   - YouTube comment: usually says "Add a comment..." or "Add a public comment..."
   - Click the CENTER of the input field
2. Templates/Cards: Large rectangular areas with images/thumbnails (usually 200-400px wide)
   - Click the CENTER of the card/thumbnail image
3. Buttons: Colored rectangles with text (usually <150px wide)
   - Common colors: blue, green, orange, white with borders
   - Click the center of the button
4. Links: Underlined or colored text (smaller than buttons)
5. Icons: Small circular or square graphics (20-60px)

COORDINATE PRECISION:
- Count grid lines to determine exact position
- Red numbers (top) = X coordinate
- Green numbers (left) = Y coordinate
- Return the GEOMETRIC CENTER of the element
- For element between X:200-300 and Y:300-400 → return {{"x": 250, "y": 350}}

RESPOND WITH VALID JSON ONLY:
{{
  "x": 340,
  "y": 280,
  "reasoning": "Found blue 'Create' button centered between X:300-400 and Y:260-300 grid lines"
}}

If not found:
{{
  "x": null,
  "y": null,
  "reasoning": "No matching element visible in current view"
}}"""
        
        try:
            print(f"🤖 Calling vision model: {self.model}")
            print(f"📝 Looking for: {description}")
            
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
                                "image_url": {
                                    "url": f"data:image/png;base64,{grid_screenshot}"
                                }
                            }
                        ]
                    }]
                }
            )
            
            result = response.json()
            result_text = result["choices"][0]["message"]["content"]
            print(f"🔍 AI Response: {result_text}")
            
            # Parse JSON response - handle malformed responses
            json_start = result_text.find('{')
            json_end = result_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_text = result_text[json_start:json_end]
                # Fix common AI mistakes
                json_text = json_text.replace('"x":', '"x":').replace('"y":', '"y":')
                # Fix missing "y" key when AI writes "x": 340, 917,
                import re
                json_text = re.sub(r'"x"\s*:\s*(\d+)\s*,\s*(\d+)\s*,', r'"x": \1, "y": \2,', json_text)
                result = json.loads(json_text)
            else:
                result = json.loads(result_text)
            
            if result.get("x") and result.get("y"):
                confidence = result.get('confidence', 'unknown')
                element_type = result.get('element_type', 'unknown')
                print(f"✅ Found {element_type} at ({result['x']}, {result['y']}) - confidence: {confidence}")
                print(f"   Reasoning: {result.get('reasoning', 'N/A')}")
                return (result["x"], result["y"])
            else:
                print(f"❌ Not found - {result.get('reasoning')}")
                return None
                
        except Exception as e:
            print(f"❌ Vision error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def find_element_hybrid(
        self,
        screenshot_base64: str,
        description: str,
        dom_snapshot: dict,
        viewport_width: int = 1920,
        viewport_height: int = 1080
    ) -> dict:
        """Find element using BOTH vision and DOM data for maximum accuracy"""
        
        # Add grid overlay for coordinate precision
        grid_screenshot, actual_width, actual_height = self.add_grid_overlay(screenshot_base64)
        viewport_width = actual_width
        viewport_height = actual_height
        
        # Extract DOM elements
        dom_elements = dom_snapshot.get('elements', [])
        
        if not dom_elements:
            # No DOM data, fallback to vision only
            coords = self.find_element_coordinates(
                screenshot_base64, description, viewport_width, viewport_height
            )
            if coords:
                return {
                    "success": True,
                    "x": coords[0],
                    "y": coords[1],
                    "method": "vision_fallback"
                }
            return {"success": False, "error": "Element not found"}
        
        # Build enhanced prompt with DOM context
        dom_context = self._build_dom_context(dom_elements, description)
        
        prompt = f"""You are analyzing a webpage using BOTH visual screenshot with coordinate grid and DOM structure.

COORDINATE GRID:
- RED vertical lines = X-axis (labeled with X coordinates every 50px)
- GREEN horizontal lines = Y-axis (labeled with Y coordinates every 50px)
- Image dimensions: {viewport_width}x{viewport_height} pixels
- USE THE GRID NUMBERS to verify DOM element positions

TASK: Find "{description}"

DOM ELEMENTS DETECTED ({len(dom_elements)} clickable elements):
{dom_context}

HYBRID ANALYSIS STRATEGY:
1. First, try to find "{description}" in the DOM elements list by matching text/label/className
2. If DOM match found: Use coordinate GRID to verify the position and return DOM centerX/centerY
3. **IF NO DOM MATCH**: Use VISUAL ANALYSIS ONLY - look at the screenshot and find the element visually
4. Count grid lines to determine the visual element's center coordinates
5. ALWAYS return coordinates if you can see the element in the screenshot

COORDINATE PRECISION:
- Red grid numbers (top edge) = X coordinates
- Green grid numbers (left edge) = Y coordinates
- Count grid lines to find center of visual element
- **CRITICAL**: X must be < {viewport_width}, Y must be < {viewport_height}
- If element is outside viewport or not visible, then return null

RESPOND WITH JSON:
{{
  "matched_element_index": <index from DOM list or null if using visual only>,
  "x": <center x coordinate from grid>,
  "y": <center y coordinate from grid>,
  "confidence": "high/medium/low",
  "reasoning": "DOM match: element #X verified at grid X:200-300, Y:300-400..." OR "No DOM match, visual analysis: found element at grid X:400, Y:400"
}}

**IMPORTANT**: Only return null coordinates if element is completely invisible or outside viewport.
If you can SEE the element in the screenshot, you MUST return x/y coordinates using the grid, even if it's not in the DOM list."""
        
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
                                "image_url": {
                                    "url": f"data:image/png;base64,{grid_screenshot}"
                                }
                            }
                        ]
                    }]
                }
            )
            
            result = response.json()
            result_text = result["choices"][0]["message"]["content"]
            print(f"🤖 Hybrid AI response: {result_text}")
            
            # Parse JSON
            json_start = result_text.find('{')
            json_end = result_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_text = result_text[json_start:json_end]
                decision = json.loads(json_text)
                
                if decision.get('x') and decision.get('y'):
                    x, y = decision['x'], decision['y']
                    
                    # CRITICAL: Validate coordinates are within viewport
                    if x < 0 or y < 0 or x >= viewport_width or y >= viewport_height:
                        print(f"⚠️ VLM returned invalid coords ({x},{y}) for viewport {viewport_width}x{viewport_height}")
                        # If DOM element was matched, try to use its viewport-relative coordinates
                        matched_idx = decision.get('matched_element_index')
                        if matched_idx is not None and matched_idx < len(dom_elements):
                            element = dom_elements[matched_idx]
                            elem_x = element['rect']['centerX']
                            elem_y = element['rect']['centerY']
                            
                            # Check if element is in viewport
                            if 0 <= elem_x < viewport_width and 0 <= elem_y < viewport_height:
                                print(f"✅ Using DOM element viewport coords instead: ({elem_x},{elem_y})")
                                x, y = elem_x, elem_y
                            else:
                                print(f"❌ DOM element also outside viewport: ({elem_x},{elem_y})")
                                print(f"🎯 Trying pure vision fallback...")
                                # Try pure vision as last resort
                                vision_coords = self.find_element_coordinates(
                                    screenshot_base64, description, viewport_width, viewport_height
                                )
                                if vision_coords:
                                    print(f"✅ Pure vision found coordinates: {vision_coords}")
                                    return {
                                        "success": True,
                                        "x": vision_coords[0],
                                        "y": vision_coords[1],
                                        "method": "pure_vision_fallback"
                                    }
                                return {"success": False, "error": f"Element not visible in viewport. Try scrolling."}
                        else:
                            print(f"🎯 Trying pure vision fallback for out-of-viewport element...")
                            # Try pure vision as fallback
                            vision_coords = self.find_element_coordinates(
                                screenshot_base64, description, viewport_width, viewport_height
                            )
                            if vision_coords:
                                print(f"✅ Pure vision found coordinates: {vision_coords}")
                                return {
                                    "success": True,
                                    "x": vision_coords[0],
                                    "y": vision_coords[1],
                                    "method": "pure_vision_fallback"
                                }
                            return {"success": False, "error": f"Element not found in viewport. Try scrolling."}
                    
                    matched_idx = decision.get('matched_element_index')
                    element_info = dom_elements[matched_idx] if matched_idx is not None and matched_idx < len(dom_elements) else None
                    confidence = decision.get('confidence', 'unknown').upper()
                    
                    # Log confidence prominently
                    confidence_emoji = {"HIGH": "🎯", "MEDIUM": "✓", "LOW": "⚠️", "UNKNOWN": "❓"}
                    print(f"{confidence_emoji.get(confidence, '•')} CONFIDENCE: {confidence} - Clicking at ({x}, {y})")
                    
                    return {
                        "success": True,
                        "x": x,
                        "y": y,
                        "method": "hybrid_vision_dom",
                        "confidence": decision.get('confidence', 'unknown'),
                        "element_info": element_info
                    }
                else:
                    # Hybrid returned null - use pure vision fallback
                    print(f"⚠️ Hybrid analysis returned null coordinates")
                    print(f"🎯 Falling back to pure vision analysis...")
                    vision_coords = self.find_element_coordinates(
                        screenshot_base64, description, viewport_width, viewport_height
                    )
                    if vision_coords:
                        print(f"✅ Pure vision found coordinates: {vision_coords}")
                        print(f"✓ CONFIDENCE: MEDIUM (visual fallback) - Clicking at ({vision_coords[0]}, {vision_coords[1]})")
                        return {
                            "success": True,
                            "x": vision_coords[0],
                            "y": vision_coords[1],
                            "method": "pure_vision_fallback",
                            "confidence": "medium",
                            "reasoning": decision.get('reasoning', 'Hybrid failed, used pure vision')
                        }
                    return {"success": False, "error": "Element not found by hybrid or vision analysis"}
            else:
                return {"success": False, "error": "Failed to parse AI response"}
                
        except Exception as e:
            print(f"❌ Hybrid vision error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    def _build_dom_context(self, elements: list, description: str) -> str:
        """Build concise DOM context focusing on likely matches"""
        # Pre-filter elements by relevance
        desc_lower = description.lower()
        desc_words = set(desc_lower.split())
        
        scored_elements = []
        for elem in elements:
            score = 0
            text = elem.get('text', '').lower()
            label = elem.get('ariaLabel', '').lower()
            className = elem.get('className', '').lower()
            
            # Score based on text matching
            for word in desc_words:
                if word in text: score += 3
                if word in label: score += 2
                if word in className: score += 1
            
            # Boost buttons/links
            if elem.get('tag') in ['button', 'a']: score += 1
            
            scored_elements.append((score, elem))
        
        # Sort by score and take top 20
        scored_elements.sort(reverse=True, key=lambda x: x[0])
        top_elements = [e[1] for e in scored_elements[:20]]
        
        lines = []
        for i, elem in enumerate(top_elements):
            rect = elem['rect']
            text_preview = elem.get('text', '')[:50]
            label = elem.get('ariaLabel', '')
            lines.append(
                f"[{i}] {elem['tag']} at ({rect['centerX']},{rect['centerY']}) "
                f"size:{rect['width']}x{rect['height']} "
                f"text:\"{text_preview}\" label:\"{label}\""
            )
        
        return '\n'.join(lines) if lines else "No relevant elements found"
    
    def analyze_screenshot(
        self,
        screenshot_base64: str,
        question: str
    ) -> str:
        """Analyze a screenshot and answer a question about it"""
        
        try:
            # If using text-only model, skip vision and use text prompt only
            if hasattr(self, 'is_vision') and not self.is_vision:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{
                        "role": "user",
                        "content": question + "\n\nNote: Answer based on the question assuming a typical web page layout."
                    }],
                    max_tokens=1000
                )
                return response.choices[0].message.content
            
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
            print(f"Vision error: {e}")
            return f"Error: {e}"
