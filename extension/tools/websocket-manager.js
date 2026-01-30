/**
 * WebSocket Client for Extension
 * Handles bidirectional communication with Python backend
 * Based on BrowserOS WebSocketClient design
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.status = Protocol.ConnectionStatus.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.requestTracker = new Protocol.RequestTracker();
    this.messageQueue = new Protocol.MessageQueue();
    
    // Event listeners
    this.statusListeners = new Set();
    this.messageListeners = new Set();
    
    // Configuration
    this.config = {
      url: 'ws://localhost:8000/ws',
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 10000   // 10 seconds
    };
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.status === Protocol.ConnectionStatus.CONNECTED) {
      console.log('Already connected');
      return;
    }
    
    if (this.status === Protocol.ConnectionStatus.CONNECTING) {
      console.log('Connection in progress');
      return;
    }
    
    this.setStatus(Protocol.ConnectionStatus.CONNECTING);
    console.log(`🔌 Connecting to ${this.config.url}...`);
    
    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      
      // Wait for connection with timeout
      await this.waitForConnection();
      
    } catch (error) {
      console.error('Connection failed:', error);
      this.setStatus(Protocol.ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Wait for connection to be established
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);
      
      const checkConnection = () => {
        if (this.status === Protocol.ConnectionStatus.CONNECTED) {
          clearTimeout(timeout);
          resolve();
        } else if (this.status === Protocol.ConnectionStatus.ERROR) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    console.log('🔌 Disconnecting...');
    
    this.stopHeartbeat();
    this.requestTracker.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setStatus(Protocol.ConnectionStatus.DISCONNECTED);
  }
  
  /**
   * Send message to server
   */
  send(message) {
    if (this.status !== Protocol.ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to server');
    }
    
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }
    
    const serialized = JSON.stringify(message);
    this.ws.send(serialized);
    
    console.log('📤 Sent:', message.type, message.id);
  }
  
  /**
   * Send a tool request and wait for response
   */
  async sendToolRequest(toolName, params = {}, timeout = 30000) {
    const request = Protocol.createToolRequest(toolName, params);
    
    return new Promise((resolve, reject) => {
      // Track request
      this.requestTracker.track(request.id, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      }, timeout);
      
      // Send request
      try {
        this.send(request);
      } catch (error) {
        this.requestTracker.reject(request.id, error);
        reject(error);
      }
    });
  }
  
  /**
   * Send ping to check connection
   */
  sendPing() {
    try {
      this.send(Protocol.createRequest(Protocol.MessageType.PING));
    } catch (error) {
      console.error('Failed to send ping:', error);
    }
  }
  
  /**
   * Handle WebSocket open
   */
  handleOpen() {
    console.log('✅ WebSocket connected');
    this.reconnectAttempts = 0;
    this.setStatus(Protocol.ConnectionStatus.CONNECTED);
    this.startHeartbeat();
    
    // Send registration message
    this.send(Protocol.createRequest(Protocol.MessageType.REGISTER, {
      client_type: 'extension',
      version: '1.0.0'
    }));
  }
  
  /**
   * Handle incoming message
   */
  async handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Validate message
      const validation = Protocol.validateMessage(message);
      if (!validation.valid) {
        console.error('Invalid message:', validation.error, message);
        return;
      }
      
      console.log('📥 Received:', message.type, message.id);
      
      // Handle different message types
      switch (message.type) {
        case Protocol.MessageType.PONG:
          // Heartbeat response
          break;
          
        case Protocol.MessageType.TOOL_RESPONSE:
          // Resolve pending request
          if (message.id) {
            this.requestTracker.resolve(message.id, message);
          }
          break;
          
        case Protocol.MessageType.AGENT_STATUS:
          // Broadcast status update
          this.notifyMessageListeners(message);
          break;
          
        case Protocol.MessageType.STREAM_CHUNK:
          // Broadcast stream chunk
          this.notifyMessageListeners(message);
          break;
          
        case Protocol.MessageType.ERROR:
          // Handle error
          if (message.id) {
            this.requestTracker.reject(message.id, new Error(message.error));
          }
          this.notifyMessageListeners(message);
          break;
          
        default:
          // Unknown message type - broadcast
          this.notifyMessageListeners(message);
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error('❌ WebSocket error:', error);
    this.setStatus(Protocol.ConnectionStatus.ERROR);
  }
  
  /**
   * Handle WebSocket close
   */
  handleClose(event) {
    console.log('🔌 WebSocket closed:', event.code, event.reason);
    
    this.stopHeartbeat();
    this.setStatus(Protocol.ConnectionStatus.DISCONNECTED);
    
    // Attempt reconnection if not intentional
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.status === Protocol.ConnectionStatus.CONNECTED) {
        this.sendPing();
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Set connection status
   */
  setStatus(status) {
    if (this.status === status) return;
    
    this.status = status;
    console.log(`📡 Status: ${status}`);
    
    // Notify listeners
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    }
  }
  
  /**
   * Add status change listener
   */
  onStatusChange(listener) {
    this.statusListeners.add(listener);
  }
  
  /**
   * Remove status change listener
   */
  offStatusChange(listener) {
    this.statusListeners.delete(listener);
  }
  
  /**
   * Add message listener
   */
  onMessage(listener) {
    this.messageListeners.add(listener);
  }
  
  /**
   * Remove message listener
   */
  offMessage(listener) {
    this.messageListeners.delete(listener);
  }
  
  /**
   * Notify message listeners
   */
  notifyMessageListeners(message) {
    for (const listener of this.messageListeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    }
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return this.status;
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.status === Protocol.ConnectionStatus.CONNECTED;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      status: this.status,
      reconnectAttempts: this.reconnectAttempts,
      pendingRequests: this.requestTracker.getStats(),
      queueSize: this.messageQueue.size()
    };
  }
}

// Export singleton instance
const wsManager = new WebSocketManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.wsManager = wsManager;
}
