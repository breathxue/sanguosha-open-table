import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerMessage } from '../src/shared/types.js';
import { parseClientMessage, PublicError, RoomStore, sendTo } from './rooms.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const store = new RoomStore();
const app = express();

app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: store.rooms.size,
    time: Date.now(),
  });
});

app.post('/api/rooms', (req, res, next) => {
  try {
    const session = store.createRoom(req.body?.playerName);
    store.broadcast(session.room);
    res.status(201).json(session.session);
  } catch (error) {
    next(error);
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const room = store.rooms.get(String(req.params.code).trim().toUpperCase());
  if (!room) {
    res.status(404).json({ error: '房间不存在，或已经结束' });
    return;
  }
  res.json(store.summary(room));
});

app.post('/api/rooms/:code/join', (req, res, next) => {
  try {
    const session = store.joinRoom(req.params.code, req.body?.playerName);
    store.broadcast(session.room);
    res.status(201).json(session.session);
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const distDir = path.resolve(process.cwd(), 'dist');
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/ws')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof PublicError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: '服务器开小差了，请稍后再试' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

interface LiveSocket extends WebSocket {
  isAlive?: boolean;
}

wss.on('connection', (socket: LiveSocket, request) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const auth = store.authenticate(url.searchParams.get('room'), url.searchParams.get('token'));
  if (!auth) {
    socket.close(4003, 'invalid session');
    return;
  }

  const { room, player } = auth;
  const actionTimes: number[] = [];
  const chatTimes: number[] = [];
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  store.attachSocket(room, player.id, socket);
  store.broadcast(room);

  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      sendError(socket, '只支持文本消息');
      return;
    }
    const raw = data.toString();
    const message = parseClientMessage(raw);
    if (!message) {
      sendError(socket, '无法识别的消息');
      return;
    }

    if (message.type === 'ping') {
      sendTo(socket, { type: 'pong' });
      return;
    }

    const currentRoom = store.rooms.get(room.code);
    if (!currentRoom || currentRoom !== room) {
      sendError(socket, '房间已经结束');
      socket.close(4004, 'room closed');
      return;
    }

    if (message.type === 'action') {
      if (!allowRate(actionTimes, 40, 5000)) {
        sendError(socket, '操作太快了，稍等一下');
        return;
      }
      const result = store.performAction(room, player.id, message.action);
      if (!result.ok) {
        sendError(socket, result.error ?? '操作失败');
        return;
      }
      store.broadcast(room);
      return;
    }

    if (message.type === 'chat') {
      if (!allowRate(chatTimes, 8, 8000)) {
        sendError(socket, '发言太快了，稍等一下');
        return;
      }
      const result = store.addChat(room, player.id, message.text);
      if (!result.ok) {
        sendError(socket, result.error ?? '发送失败');
        return;
      }
      store.broadcast(room);
      return;
    }

    if (message.type === 'start') {
      const result = store.startGame(room, player.id);
      if (!result.ok) {
        sendError(socket, result.error ?? '无法开始牌局');
        return;
      }
      store.broadcast(room);
      return;
    }

    if (message.type === 'leave') {
      const { deleted } = store.leaveRoom(room, player.id);
      if (!deleted) store.broadcast(room);
    }
  });

  socket.on('close', () => {
    const currentRoom = store.rooms.get(room.code);
    if (!currentRoom || currentRoom !== room) return;
    store.detachSocket(room, player.id, socket);
    store.broadcast(room);
  });

  socket.on('error', () => {
    // Close event handles cleanup.
  });
});

function sendError(socket: WebSocket, message: string): void {
  const payload: ServerMessage = { type: 'error', message };
  sendTo(socket, payload);
}

function allowRate(times: number[], limit: number, windowMs: number): boolean {
  const now = Date.now();
  while (times.length > 0 && now - times[0] > windowMs) times.shift();
  if (times.length >= limit) return false;
  times.push(now);
  return true;
}

const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    const socket = client as LiveSocket;
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    try {
      socket.ping();
    } catch {
      socket.terminate();
    }
  }
}, 30_000);
heartbeat.unref();

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => {
  const addresses = getLanAddresses();
  console.log('');
  console.log('  三国杀 · 自由牌桌');
  console.log(`  本机访问   http://localhost:${PORT}`);
  for (const address of addresses) {
    console.log(`  局域网访问 http://${address}:${PORT}`);
  }
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

function getLanAddresses(): string[] {
  const result: string[] = [];
  for (const values of Object.values(networkInterfaces())) {
    for (const value of values ?? []) {
      if (value.family === 'IPv4' && !value.internal) result.push(value.address);
    }
  }
  return result;
}

