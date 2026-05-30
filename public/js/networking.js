class AzarSocket {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.pendingRefs = {};
    this.refCounter = 0;
    this.socketId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  connect(roomCode) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}?room=${roomCode || ''}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      this.reconnectAttempts = 0;
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const { event: evt, data } = JSON.parse(event.data);

        if (evt === 'connected') {
          this.socketId = data.id;
          this.connected = true;
          this.emit('_connected', data);
          return;
        }

        if (data?.ref && this.pendingRefs[data.ref]) {
          this.pendingRefs[data.ref](data);
          delete this.pendingRefs[data.ref];
          return;
        }

        if (this.listeners[evt]) {
          this.listeners[evt].forEach(fn => fn(data));
        }
      } catch (_) {}
    });

    this.ws.addEventListener('close', () => {
      this.connected = false;
      if (this.reconnectAttempts < this.maxReconnect) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(roomCode), 2000 * this.reconnectAttempts);
      }
    });
  }

  send(event, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event, data }));
  }

  sendWithRef(event, data) {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      const ref = `ref_${++this.refCounter}`;
      this.pendingRefs[ref] = resolve;
      this.ws.send(JSON.stringify({ event, data, ref }));
    });
  }

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return () => {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    };
  }

  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }
}

window.AzarSocket = AzarSocket;
