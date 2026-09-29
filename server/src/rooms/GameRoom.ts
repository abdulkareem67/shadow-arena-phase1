import type { Server, Socket } from 'socket.io';
import { getRandomMap } from '../../../shared/maps';
import type { ArenaMapDef } from '../../../shared/types/entities';
import {
  PLAYER_START_HP,
  PLAYER_START_ARMOR,
  PLAYER_RADIUS,
  WEAPON_DAMAGE,
  WEAPON_FIRE_COOLDOWN_MS,
  RESPAWN_DELAY_MS,
  SERVER_TICK_MS,
  MAX_PLAYERS_PER_MATCH,
} from '../../../shared/constants/game';
import type { GameEvent, PlayerState } from '../../../shared/types/entities';
import type {
  ClientToServerEvents,
  PlayerInputMessage,
  ServerToClientEvents,
  StateSnapshot,
} from '../../../shared/protocol';
import { integrateMovement, performHitscan, resolveObstacleCollisions, type ServerPlayerState } from '../game/simulation';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Single shared match room. There's no matchmaking yet (Phase 5) — every
 * connecting socket joins this one authoritative simulation, capped at
 * MAX_PLAYERS_PER_MATCH.
 */
export class GameRoom {
  private players = new Map<string, ServerPlayerState>();
  private inputs = new Map<string, PlayerInputMessage>();
  private tick = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  // Chosen once per server process — see shared/maps/index.ts's
  // getRandomMap doc comment for why this isn't re-picked mid-session.
  private readonly map: ArenaMapDef = getRandomMap();

  constructor(private readonly io: IOServer) {
    console.log(`GameRoom: playing "${this.map.name}" (${this.map.id})`);
  }

  start(): void {
    this.intervalHandle = setInterval(() => this.update(), SERVER_TICK_MS);
  }

  stop(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  join(socket: IOSocket, username: string): void {
    if (this.players.size >= MAX_PLAYERS_PER_MATCH) {
      socket.emit('match:full');
      return;
    }

    const spawn = this.map.spawnPoints[this.players.size % this.map.spawnPoints.length];
    const player: ServerPlayerState = {
      id: socket.id,
      username,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      facing: 0,
      hp: PLAYER_START_HP,
      armor: PLAYER_START_ARMOR,
      isAlive: true,
      isDashing: false,
      dashEndsAt: 0,
      dashCooldownEndsAt: 0,
      dashDirX: 0,
      dashDirY: 0,
      fireCooldownEndsAt: 0,
      respawnAt: 0,
      lastInputSeq: 0,
    };
    this.players.set(socket.id, player);
    socket.emit('match:welcome', { playerId: socket.id, spawn, mapId: this.map.id });
  }

  leave(socketId: string): void {
    this.players.delete(socketId);
    this.inputs.delete(socketId);
  }

  handleInput(socketId: string, input: PlayerInputMessage): void {
    const player = this.players.get(socketId);
    if (!player || input.seq < player.lastInputSeq) return;
    player.lastInputSeq = input.seq;
    this.inputs.set(socketId, input);
  }

  private update(): void {
    const now = Date.now();
    const dt = SERVER_TICK_MS / 1000;
    const events: GameEvent[] = [];
    const roster = Array.from(this.players.values());

    for (const player of roster) {
      if (!player.isAlive) {
        if (now >= player.respawnAt && player.respawnAt > 0) {
          this.respawn(player);
          events.push({ type: 'respawn', playerId: player.id });
        }
        continue;
      }

      const input = this.inputs.get(player.id);
      if (input) {
        integrateMovement(player, input, dt, now);
      }
      resolveObstacleCollisions(player, PLAYER_RADIUS, this.map.obstacles);
      player.x = clamp(player.x, PLAYER_RADIUS, this.map.width - PLAYER_RADIUS);
      player.y = clamp(player.y, PLAYER_RADIUS, this.map.height - PLAYER_RADIUS);

      if (input?.shootHeld && now >= player.fireCooldownEndsAt) {
        player.fireCooldownEndsAt = now + WEAPON_FIRE_COOLDOWN_MS;
        this.resolveShot(player, roster, events, now);
      }
    }

    this.tick += 1;
    const snapshot: StateSnapshot = {
      tick: this.tick,
      players: roster.map(toPlayerState),
      events,
    };
    this.io.emit('state:snapshot', snapshot);
  }

  private resolveShot(shooter: ServerPlayerState, roster: ServerPlayerState[], events: GameEvent[], now: number): void {
    const { hitPlayerId, distance } = performHitscan(shooter, roster, this.map.obstacles);
    // Fired every shot, hit or miss, so the client can render a muzzle
    // flash + tracer for every player (not just the ones who land a hit).
    events.push({ type: 'shot', shooterId: shooter.id, angle: shooter.facing, distance });

    if (!hitPlayerId) return;
    const target = this.players.get(hitPlayerId);
    if (!target || !target.isAlive) return;

    events.push({ type: 'hit', shooterId: shooter.id, targetId: hitPlayerId, damage: WEAPON_DAMAGE });
    this.applyDamage(target, WEAPON_DAMAGE);
    if (!target.isAlive) {
      events.push({ type: 'death', victimId: target.id, killerId: shooter.id });
      target.respawnAt = now + RESPAWN_DELAY_MS;
    }
  }

  private applyDamage(target: ServerPlayerState, damage: number): void {
    let remaining = damage;
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, remaining);
      target.armor -= absorbed;
      remaining -= absorbed;
    }
    target.hp = Math.max(0, target.hp - remaining);
    if (target.hp === 0) {
      target.isAlive = false;
      target.vx = 0;
      target.vy = 0;
    }
  }

  private respawn(player: ServerPlayerState): void {
    const spawn = this.map.spawnPoints[Math.floor(Math.random() * this.map.spawnPoints.length)];
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = PLAYER_START_HP;
    player.armor = PLAYER_START_ARMOR;
    player.isAlive = true;
    player.isDashing = false;
    player.respawnAt = 0;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toPlayerState(p: ServerPlayerState): PlayerState {
  return {
    id: p.id,
    username: p.username,
    position: { x: p.x, y: p.y },
    velocity: { x: p.vx, y: p.vy },
    facing: p.facing,
    hp: p.hp,
    armor: p.armor,
    isAlive: p.isAlive,
    isDashing: p.isDashing,
    lastInputSeq: p.lastInputSeq,
  };
}
