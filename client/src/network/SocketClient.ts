import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, PlayerInputMessage, ServerToClientEvents, StateSnapshot } from '../../../shared/protocol';
import type { Vector2 } from '../../../shared/types/entities';

// socket.io-client's generics are (ListenEvents, EmitEvents) — from the
// client's point of view it listens for ServerToClientEvents and emits
// ClientToServerEvents, the mirror image of the server's Socket<> type.
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface WelcomePayload {
  playerId: string;
  spawn: Vector2;
  mapId: string;
}

function randomGuestName(): string {
  return `Guest${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Default server URL when VITE_SERVER_URL isn't set. Deliberately derived
 * from the page's own hostname (window.location.hostname) rather than a
 * literal 'localhost' — 'localhost' always means "this machine", so a
 * friend loading the game from your LAN IP (e.g. http://192.168.1.5:5173)
 * would otherwise have their browser try to reach a server on *their own*
 * machine and hang on "Connecting to server..." forever. Matching the
 * page's own hostname means it resolves correctly whether you open the
 * game as localhost or someone else opens it as your LAN IP, with zero
 * config needed for the common "play with a friend on the same network"
 * case. VITE_SERVER_URL still overrides this for anything fancier
 * (a different port, a tunnel, a deployed server).
 */
function defaultServerUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) return configured;
  const port = import.meta.env.VITE_SERVER_PORT ?? '3001';
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * Thin socket.io-client wrapper. Owns the connection and the
 * server-authoritative message contract; ArenaScene reacts to its
 * callbacks rather than touching socket.io directly.
 */
export class SocketClient {
  private socket: GameSocket;
  readonly username: string;

  constructor(serverUrl: string = defaultServerUrl()) {
    this.username = randomGuestName();
    this.socket = io(serverUrl, { transports: ['websocket'] });
    this.socket.on('connect', () => {
      this.socket.emit('player:join', { username: this.username });
    });
  }

  onWelcome(cb: (payload: WelcomePayload) => void): void {
    this.socket.on('match:welcome', cb);
  }

  onSnapshot(cb: (snapshot: StateSnapshot) => void): void {
    this.socket.on('state:snapshot', cb);
  }

  onMatchFull(cb: () => void): void {
    this.socket.on('match:full', cb);
  }

  onDisconnect(cb: () => void): void {
    this.socket.on('disconnect', cb);
  }

  sendInput(input: PlayerInputMessage): void {
    this.socket.emit('player:input', input);
  }

  destroy(): void {
    this.socket.disconnect();
  }
}
