const MAX_OPTIONS_PER_ROOM = 20;
const MAX_OPTION_LENGTH = 20;
const MAX_SOCKETS_PER_ROOM = 50;
const MAX_ROOMS_PER_SOCKET = 1;
const DECISION_TIMEOUT_MS = 20000;
const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 30;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.rooms = new Map();
    this.sockets = new Map();
    this.socketRooms = new Map();
    this.rateLogs = new Map();
  }

  checkRate(socketId) {
    const now = Date.now();
    if (!this.rateLogs.has(socketId)) {
      this.rateLogs.set(socketId, []);
    }
    const log = this.rateLogs.get(socketId);
    const cutoff = now - RATE_LIMIT_WINDOW;
    while (log.length > 0 && log[0] < cutoff) log.shift();
    if (log.length >= RATE_LIMIT_MAX) return false;
    log.push(now);
    return true;
  }

  broadcast(roomCode, event, data, exclude) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const msg = JSON.stringify({ event, data });
    for (const sid of room.sockets) {
      if (sid !== exclude) {
        const ws = this.sockets.get(sid);
        if (ws && ws.readyState === 1) {
          try { ws.send(msg); } catch (_) {}
        }
      }
    }
  }

  sendTo(socketId, event, data) {
    const ws = this.sockets.get(socketId);
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ event, data })); } catch (_) {}
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    const socketId = crypto.randomUUID();
    this.sockets.set(socketId, server);

    server.addEventListener('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this.handleMessage(socketId, server, parsed);
      } catch (_) {}
    });

    server.addEventListener('close', () => {
      this.handleDisconnect(socketId);
    });

    server.addEventListener('error', () => {
      this.handleDisconnect(socketId);
    });

    this.sendTo(socketId, 'connected', { id: socketId });

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(socketId, ws, msg) {
    if (!this.checkRate(socketId)) {
      this.sendTo(socketId, 'error', { ref: msg.ref, message: 'Demasiadas solicitudes. Espera un momento.' });
      return;
    }

    switch (msg.event) {
      case 'create-room': {
        if ((this.socketRooms.get(socketId)?.size || 0) >= MAX_ROOMS_PER_SOCKET) {
          this.sendTo(socketId, 'create-room', { ref: msg.ref, error: 'Ya tienes una sala activa.' });
          return;
        }

        const code = this.generateCode();
        const room = {
          code,
          options: ['OPCIÓN A', 'OPCIÓN B', 'OPCIÓN C', 'OPCIÓN D'],
          mode: 'slot',
          busy: false,
          host: socketId,
          sockets: new Set(),
          pendingWinner: null,
          busyTimeout: null,
        };

        this.rooms.set(code, room);
        room.sockets.add(socketId);

        if (!this.socketRooms.has(socketId)) {
          this.socketRooms.set(socketId, new Set());
        }
        this.socketRooms.get(socketId).add(code);

        this.sendTo(socketId, 'create-room', {
          ref: msg.ref,
          success: true,
          code,
          state: this.getPublicState(room),
        });
        break;
      }

      case 'join-room': {
        const code = msg.data?.code?.toUpperCase();
        if (!code) {
          this.sendTo(socketId, 'join-room', { ref: msg.ref, error: 'Código inválido' });
          return;
        }

        const room = this.rooms.get(code);
        if (!room) {
          this.sendTo(socketId, 'join-room', { ref: msg.ref, error: 'Sala no encontrada' });
          return;
        }

        if (room.sockets.size >= MAX_SOCKETS_PER_ROOM) {
          this.sendTo(socketId, 'join-room', { ref: msg.ref, error: 'Sala llena.' });
          return;
        }

        room.sockets.add(socketId);

        if (!this.socketRooms.has(socketId)) {
          this.socketRooms.set(socketId, new Set());
        }
        this.socketRooms.get(socketId).add(code);

        this.sendTo(socketId, 'join-room', {
          ref: msg.ref,
          success: true,
          state: this.getPublicState(room),
        });

        this.broadcast(code, 'room-info', {
          userCount: room.sockets.size,
          host: room.host,
        }, socketId);
        break;
      }

      case 'add-option': {
        const room = this.findRoomBySocket(socketId);
        if (!room || room.busy) return;
        if (room.options.length >= MAX_OPTIONS_PER_ROOM) return;

        const val = msg.data?.option?.trim()?.toUpperCase();
        if (!val) return;
        if (val.length > MAX_OPTION_LENGTH) return;
        if (room.options.includes(val)) return;

        room.options.push(val);
        this.broadcast(room.code, 'state-update', { options: [...room.options] });
        break;
      }

      case 'remove-option': {
        const room = this.findRoomBySocket(socketId);
        if (!room || room.busy) return;

        const index = msg.data?.index;
        if (index >= 0 && index < room.options.length) {
          room.options.splice(index, 1);
          this.broadcast(room.code, 'state-update', { options: [...room.options] });
        }
        break;
      }

      case 'trigger-decision': {
        const room = this.findRoomBySocket(socketId);
        if (!room) return;
        if (socketId !== room.host) return;
        if (room.busy) return;
        if (room.options.length < 2) return;

        const winner = this.pickWinner(room.options);
        room.busy = true;
        room.mode = msg.data?.mode || 'slot';
        room.pendingWinner = winner;

        if (room.busyTimeout) clearTimeout(room.busyTimeout);
        room.busyTimeout = setTimeout(() => {
          if (room.busy) {
            room.busy = false;
            room.pendingWinner = null;
            room.busyTimeout = null;
            this.broadcast(room.code, 'busy-timeout', null);
          }
        }, DECISION_TIMEOUT_MS);

        this.broadcast(room.code, 'decision-start', { mode: room.mode, winner });
        break;
      }

      case 'decision-done': {
        const room = this.findRoomBySocket(socketId);
        if (!room) return;
        if (socketId !== room.host) return;
        if (!room.busy) return;
        if (msg.data?.winner !== room.pendingWinner) return;

        if (room.busyTimeout) {
          clearTimeout(room.busyTimeout);
          room.busyTimeout = null;
        }

        room.busy = false;
        room.pendingWinner = null;
        this.broadcast(room.code, 'decision-result', { winner: msg.data.winner });
        break;
      }
    }
  }

  handleDisconnect(socketId) {
    this.sockets.delete(socketId);
    this.rateLogs.delete(socketId);

    const roomCodes = this.socketRooms.get(socketId);
    if (roomCodes) {
      for (const code of roomCodes) {
        const room = this.rooms.get(code);
        if (!room) continue;

        room.sockets.delete(socketId);

        if (socketId === room.host && room.sockets.size > 0) {
          const nextHost = [...room.sockets][0];
          room.host = nextHost;
          this.broadcast(code, 'new-host', { hostId: nextHost });
        }

        if (room.sockets.size === 0) {
          if (room.busyTimeout) {
            clearTimeout(room.busyTimeout);
          }
          this.rooms.delete(code);
        } else {
          this.broadcast(code, 'room-info', {
            userCount: room.sockets.size,
            host: room.host,
          });
        }
      }
      this.socketRooms.delete(socketId);
    }
  }

  findRoomBySocket(socketId) {
    const roomCodes = this.socketRooms.get(socketId);
    if (!roomCodes) return null;
    for (const code of roomCodes) {
      const room = this.rooms.get(code);
      if (room) return room;
    }
    return null;
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
      }
    } while (this.rooms.has(code));
    return code;
  }

  pickWinner(options) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const idx = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0) % options.length;
    return options[idx];
  }

  getPublicState(room) {
    return {
      code: room.code,
      options: [...room.options],
      mode: room.mode,
      busy: room.busy,
    };
  }
}
