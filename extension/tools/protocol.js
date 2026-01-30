/**
 * Protocol Types and Utilities
 * Defines the communication protocol between backend and extension
 * Based on BrowserOS protocol design
 */

// Connection status
const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// Message types
const MessageType = {
  // Client -> Server
  TOOL_REQUEST: 'tool_request',
  PING: 'ping',
  REGISTER: 'register',
  
  // Server -> Client
  TOOL_RESPONSE: 'tool_response',
  PONG: 'pong',
  AGENT_STATUS: 'agent_status',
  STREAM_CHUNK: 'stream_chunk',
  ERROR: 'error',
  
  // Bidirectional
  HEARTBEAT: 'heartbeat'
};

// Agent status types
const AgentStatus = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Create a protocol request
 */
function createRequest(type, data = {}) {
  return {
    id: generateRequestId(),
    type,
    timestamp: Date.now(),
    ...data
  };
}

/**
 * Create a protocol response
 */
function createResponse(requestId, data = {}, error = null) {
  return {
    id: requestId,
    type: MessageType.TOOL_RESPONSE,
    timestamp: Date.now(),
    success: !error,
    error,
    ...data
  };
}

/**
 * Create a tool request
 */
function createToolRequest(toolName, params = {}) {
  return createRequest(MessageType.TOOL_REQUEST, {
    tool: toolName,
    params
  });
}

/**
 * Create an agent status update
 */
function createStatusUpdate(status, details = {}) {
  return {
    type: MessageType.AGENT_STATUS,
    status,
    timestamp: Date.now(),
    ...details
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate protocol message
 */
function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }
  
  if (!message.type) {
    return { valid: false, error: 'Message type required' };
  }
  
  if (!Object.values(MessageType).includes(message.type)) {
    return { valid: false, error: `Unknown message type: ${message.type}` };
  }
  
  return { valid: true };
}

/**
 * Request tracker - tracks pending requests with timeout
 */
class RequestTracker {
  constructor() {
    this.pending = new Map();
    this.defaultTimeout = 30000; // 30 seconds
  }
  
  /**
   * Track a new request
   */
  track(requestId, callback, timeout = this.defaultTimeout) {
    const timeoutId = setTimeout(() => {
      this.timeout(requestId);
    }, timeout);
    
    this.pending.set(requestId, {
      callback,
      timeoutId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Resolve a request
   */
  resolve(requestId, response) {
    const request = this.pending.get(requestId);
    if (!request) {
      console.warn(`No pending request found: ${requestId}`);
      return false;
    }
    
    clearTimeout(request.timeoutId);
    this.pending.delete(requestId);
    
    request.callback(null, response);
    return true;
  }
  
  /**
   * Reject a request with error
   */
  reject(requestId, error) {
    const request = this.pending.get(requestId);
    if (!request) {
      console.warn(`No pending request found: ${requestId}`);
      return false;
    }
    
    clearTimeout(request.timeoutId);
    this.pending.delete(requestId);
    
    request.callback(error, null);
    return true;
  }
  
  /**
   * Handle request timeout
   */
  timeout(requestId) {
    const request = this.pending.get(requestId);
    if (!request) return;
    
    this.pending.delete(requestId);
    request.callback(new Error(`Request timeout: ${requestId}`), null);
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      pending: this.pending.size,
      oldest: this.getOldestRequestAge()
    };
  }
  
  getOldestRequestAge() {
    if (this.pending.size === 0) return 0;
    
    let oldest = Infinity;
    for (const [_, request] of this.pending) {
      const age = Date.now() - request.timestamp;
      if (age < oldest) oldest = age;
    }
    
    return oldest;
  }
  
  /**
   * Clear all pending requests
   */
  clear() {
    for (const [requestId, request] of this.pending) {
      clearTimeout(request.timeoutId);
      request.callback(new Error('Tracker cleared'), null);
    }
    this.pending.clear();
  }
}

/**
 * Message queue for handling bursts
 */
class MessageQueue {
  constructor(maxSize = 100) {
    this.queue = [];
    this.maxSize = maxSize;
    this.processing = false;
  }
  
  /**
   * Add message to queue
   */
  enqueue(message) {
    if (this.queue.length >= this.maxSize) {
      console.warn('Message queue full, dropping oldest message');
      this.queue.shift();
    }
    
    this.queue.push(message);
  }
  
  /**
   * Process queue with handler
   */
  async process(handler) {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const message = this.queue.shift();
      try {
        await handler(message);
      } catch (error) {
        console.error('Error processing queued message:', error);
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }
  
  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.processing = false;
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Protocol = {
    ConnectionStatus,
    MessageType,
    AgentStatus,
    createRequest,
    createResponse,
    createToolRequest,
    createStatusUpdate,
    validateMessage,
    RequestTracker,
    MessageQueue
  };
}
