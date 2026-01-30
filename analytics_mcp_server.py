from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import numpy as np
import os
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Analytics MCP Server",
    description="ArmorIQ-compatible MCP server for analytics",
    version="1.0.0"
)

# CORS middleware for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication configuration
API_KEY = os.getenv("MCP_API_KEY", "mcp_analytics_key_12345")  # Set via environment variable

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Verify API key authentication"""
    if not x_api_key:
        logger.warning("Missing API key in request")
        raise HTTPException(status_code=401, detail="Missing API key")
    
    if x_api_key != API_KEY:
        logger.warning(f"Invalid API key attempted: {x_api_key[:10]}...")
        raise HTTPException(status_code=403, detail="Invalid API key")
    
    return x_api_key

# Define available tools for this MCP
TOOLS = [
    {
        "name": "calculate_risk",
        "description": "Calculate credit risk score from financial data",
        "inputSchema": {
            "type": "object",
            "properties": {
                "data": {
                    "type": "array",
                    "description": "Array of numerical data points",
                    "items": {"type": "number"}
                },
                "metrics": {
                    "type": "array",
                    "description": "List of metrics to calculate (mean, std, variance, median)",
                    "items": {"type": "string"}
                }
            },
            "required": ["data", "metrics"]
        }
    },
    {
        "name": "analyze",
        "description": "Perform statistical analysis on dataset",
        "inputSchema": {
            "type": "object",
            "properties": {
                "data": {
                    "type": "array",
                    "description": "Dataset to analyze",
                    "items": {"type": "number"}
                },
                "metrics": {
                    "type": "array",
                    "description": "Metrics to compute",
                    "items": {"type": "string"}
                }
            },
            "required": ["data", "metrics"]
        }
    }
]

def sse_response(data):
    """Format response as SSE (Server-Sent Events)"""
    json_str = json.dumps(data)
    return f"event: message\ndata: {json_str}\n\n"

def calculate_metrics(data, metrics):
    """Calculate statistical metrics from data with error handling"""
    try:
        results = {}
        data_array = np.array(data)
        
        if len(data_array) == 0:
            raise ValueError("Empty data array provided")
        
        for metric in metrics:
            if metric == "mean":
                results["mean"] = float(np.mean(data_array))
            elif metric == "std":
                results["std"] = float(np.std(data_array))
            elif metric == "variance":
                results["variance"] = float(np.var(data_array))
            elif metric == "median":
                results["median"] = float(np.median(data_array))
            elif metric == "min":
                results["min"] = float(np.min(data_array))
            elif metric == "max":
                results["max"] = float(np.max(data_array))
            else: with production error handling"""
    try:
        method = request_data.get("method")
        msg_id = request_data.get("id")
        
        logger.info(f"Received JSON-RPC request: method={method}, id={msg_id}
        return results
    except Exception as e:
        logger.error(f"Error calculating metrics: {str(e)}")
        raise ValueError(f"Metric calculation failed: {str(e)}")

async def handle_jsonrpc(request_data):
    """Handle JSON-RPC 2.0 requests"""
    method = request_data.get("method")
    msg_id = request_data.get("id")
    
    # Method 1: Initialize handshake
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {
                    "name": "analytics-mcp",
                    "version": "1.0.0"
                }
            }
        }
    
    # Method 2: List available tools
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": TOOLS}
        }
    
    # Method 3: Execute tool
    elif method == "tools/call":
        tool_name = request_data["params"]["name"]
        arguments = request_data["params"]["arguments"]
        
        # Execute tool logic based on tool name
        if tool_name == "calculate_risk":
            data = arguments.get("data", [])
            metrics = arguments.get("metrics", ["mean", "std"])
            
            analysis_results = calculate_metrics(data, metrics)
            
            # Calculate risk score (simple example: higher std = higher risk)
            risk_score = analysis_results.get("std", 0) / (analysis_results.get("mean", 1) + 0.01)
            
            result_data = {
                "risk_score": round(risk_score, 4),
                "analysis": analysis_results,
                "risk_level": "high" if risk_score > 0.5 else "medium" if risk_score > 0.2 else "low"
            }
        
        elif tool_name == "analyze":
            data = arguments.get("data", [])
            metrics = arguments.get("metrics", ["mean", "std", "median"])
            
            result_data = calculate_metrics(data, metrics)
        
        else:
            result_data = {"error": f"Unknown tool: {tool_name}"}
        
        # Return response in MCP format
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result_data)  # Must be JSON string
                    }
                ]
        # Unknown method
        else:
            logger.warning(f"Unknown method requested: {method}")
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }
    
    except Exception as e:
        logger.error(f"Error handling JSON-RPC request: {str(e)}", exc_info=True)
        return {
            "jsonrpc": "2.0",, api_key: str = Header(None, alias="X-API-Key")):
    """Main MCP endpoint - handles all JSON-RPC requests with authentication"""
    try:
        # Verify API key
        verify_api_key(api_key)
        
        # Parse request
        request_data = await request.json()
        logger.info(f"Processing MCP request from authenticated client")
        
        # Handle JSON-RPC
        response_data = await handle_jsonrpc(request_data)
        
        async def stream():
            yield sse_response(response_data)
        
        return StreamingResponse(
            stream(),
            media_type="text/event-stream"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in MCP endpoint: {str(e)}", exc_info=True)
    
    # Configuration from environment variables
    HOST = os.getenv("MCP_HOST", "0.0.0.0")
    PORT = int(os.getenv("MCP_PORT", "8001"))
    SSL_KEYFILE = os.getenv("SSL_KEYFILE")  # Path to SSL key file
    SSL_CERTFILE = os.getenv("SSL_CERTFILE")  # Path to SSL certificate file
    
    print("=" * 60)
    print("🚀 Analytics MCP Server")
    print("=" * 60)
    print(f"Host: {HOST}")
    print(f"Port: {PORT}")
    print(f"API Key: {'✓ Configured' if API_KEY else '✗ Not set'}")
    print(f"SSL: {'✓ Enabled' if SSL_KEYFILE and SSL_CERTFILE else '✗ Disabled (use reverse proxy)'}")
    print("=" * 60)
    
    # Run server with optional SSL
    if SSL_KEYFILE and SSL_CERTFILE:
        logger.info("Starting server with SSL enabled")
        uvicorn.run(
            app,
            host=HOST,
            port=PORT,
            ssl_keyfile=SSL_KEYFILE,
            ssl_certfile=SSL_CERTFILE,
            log_level="info"
        )
    else:
        logger.info("Starting server without SSL (use nginx/caddy reverse proxy for HTTPS)")
        uvicorn.run(
            app,
            host=HOST,
            port=PORT,
            log_level="info"
        
async def mcp_endpoint(request: Request):
    """Main MCP endpoint - handles all JSON-RPC requests"""
    request_data = await request.json()
    response_data = await handle_jsonrpc(request_data)
    
    async def stream():
        yield sse_response(response_data)
    
    return StreamingResponse(
        stream(),
        media_type="text/event-stream"
    )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "name": "analytics-mcp",
        "version": "1.0.0",
        "tools": len(TOOLS)
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Analytics MCP Server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
