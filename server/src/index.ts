import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/protocol';
import { GameRoom } from './rooms/GameRoom';
import { registerHandlers } from './sockets/registerHandlers';

// Load the repo-root .env (see ../../.env.example) regardless of cwd, so
// `npm run dev` from either the root workspace or server/ directly works.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  // No .env present — fall back to defaults below, matching .env.example.
}

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: true }));
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true },
});

const room = new GameRoom(io);
registerHandlers(io, room);
room.start();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Shadow Arena server listening on 0.0.0.0:${PORT}`);
});
