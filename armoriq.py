import os
from armoriq_sdk import ArmorIQClient

# Custom configuration
client = ArmorIQClient(
    api_key="ak_live_185bb59a76ab18e8d7e845096460ece1f135eec8f001cfa423ae2fdc6aedce06",
    user_id="alaotach",
    agent_id=f"agent_aloo",
    max_retries=5
)

# Step 1: Capture the plan
captured = client.capture_plan(
    llm="gpt-4",
    prompt="Calculate credit risk for loan application",
    plan={
        "steps": [
            {
                "action": "calculate_risk",
                "mcp": "analytics-mcp",
                "description": "Calculate credit risk score",
                "metadata": {"priority": "high"}
            }
        ]
    },
    metadata={
        "purpose": "credit_assessment",
        "version": "1.2.0",
        "tags": ["finance", "risk"]
    }
)
print(f"Plan captured: {captured}")

# Step 2: Get intent token
intent_token = client.get_intent_token(captured)
print(f"Intent token obtained: {intent_token}")

# Step 3: Invoke the action with cryptographic verification
try:
    result = client.invoke(
        mcp="analytics-mcp",
        action="calculate_risk",
        intent_token=intent_token,
        params={
            "data": [1, 2, 3, 4, 5],
            "metrics": ["mean", "std"]
        }
    )
    
    if result["success"]:
        print(f"Results: {result['data']}")
        print(f"Execution time: {result['execution_time_ms']}ms")
    else:
        print(f"Error: {result['error']}")
        
except Exception as e:
    print(f"Invocation failed: {e}")