// Socket.IO event/message contracts shared by client and server, so the
// wire format can't silently drift between the two sides.
import type { GameEvent, PlayerState, Vector2 } from '../types/entities';

export interface PlayerInputMessage {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dashPressed: boolean;
  shootHeld: boolean;
  aimAngle: number; // radians
}

export interface StateSnapshot {
  tick: number;
  players: PlayerState[];
  events: GameEvent[];
}

export interface ClientToServerEvents {
  'player:join': (payload: { username: string }) => void;
  'player:input': (payload: PlayerInputMessage) => void;
}

export interface ServerToClientEvents {
  'match:welcome': (payload: { playerId: string; spawn: Vector2; mapId: string }) => void;
  'match:full': () => void;
  'state:snapshot': (payload: StateSnapshot) => void;
}
