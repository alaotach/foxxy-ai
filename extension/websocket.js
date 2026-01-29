// WebSocket client for real-time updates from backend

class FoxyWebSocket {
  constructor(backendUrl = 'ws://localhost:8000') {
    this.backendUrl = backendUrl;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  connect(taskId = null) {
    return new Promise((resolve, reject) => {
      const wsUrl = taskId 
        ? `${this.backendUrl}/ws/${taskId}`
        : `${this.backendUrl}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.attemptReconnect(taskId);
      };
    });
  }

  attemptReconnect(taskId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(taskId), 2000 * this.reconnectAttempts);
    }
  }

  handleMessage(data) {
    const { type } = data;

    // Call registered listeners
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(data));
    }

    // Call 'all' listeners
    if (this.listeners.has('all')) {
      this.listeners.get('all').forEach(callback => callback(data));
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FoxyWebSocket;
}
