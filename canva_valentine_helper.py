"""
Simple Canva Valentine's PPT Automation
Uses direct tool calls instead of vision
"""

# Simple plan for Canva Valentine's Day PPT
CANVA_VALENTINE_PLAN = [
    {
        "step": 1,
        "action": "navigate",
        "url": "https://www.canva.com/search/templates?q=valentine%20presentation",
        "description": "Navigate directly to Valentine's templates"
    },
    {
        "step": 2,
        "action": "wait",
        "duration": 3000,
        "description": "Wait for templates to load"
    },
    {
        "step": 3,
        "action": "click",
        "selector": "a[href*='valentine'], div[data-test*='template']:first-child, .template-card:first-child",
        "description": "Click first Valentine template"
    },
    {
        "step": 4,
        "action": "wait",
        "duration": 2000,
        "description": "Wait for editor to load"
    }
]

# To execute this plan:
# 1. Open browser console on Canva
# 2. Run each step using the tool registry

print("Copy and paste these commands in your browser console (F12):")
print()

for step in CANVA_VALENTINE_PLAN:
    if step["action"] == "navigate":
        print(f"// Step {step['step']}: {step['description']}")
        print(f"await toolRegistry.execute('navigate', {{ url: '{step['url']}' }});")
        print()
    elif step["action"] == "wait":
        print(f"// Step {step['step']}: {step['description']}")
        print(f"await toolRegistry.execute('wait', {{ duration: {step['duration']} }});")
        print()
    elif step["action"] == "click":
        print(f"// Step {step['step']}: {step['description']}")
        print(f"await toolRegistry.execute('click', {{ selector: '{step['selector']}', timeout: 10000 }});")
        print()

print("\n=== OR USE THIS ALL-IN-ONE SCRIPT ===\n")
print("""
async function createValentinePPT() {
  console.log('🎨 Creating Valentine PPT on Canva...');
  
  // Step 1: Navigate to Valentine templates
  console.log('1️⃣ Navigating to templates...');
  await toolRegistry.execute('navigate', { 
    url: 'https://www.canva.com/search/templates?q=valentine%20presentation' 
  });
  
  // Step 2: Wait for page load
  console.log('2️⃣ Waiting for templates...');
  await toolRegistry.execute('wait', { duration: 3000 });
  
  // Step 3: Click first template
  console.log('3️⃣ Selecting template...');
  try {
    await toolRegistry.execute('click', { 
      selector: 'a[href*="design"]',
      timeout: 10000 
    });
  } catch (e) {
    console.log('Trying alternative selector...');
    await toolRegistry.execute('click', { 
      selector: 'div[role="link"]',
      timeout: 10000 
    });
  }
  
  console.log('✅ Template selected! Customize it and download.');
}

// Run it!
createValentinePPT();
""")
