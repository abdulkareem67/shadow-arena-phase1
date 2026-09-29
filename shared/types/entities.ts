// Core entity shapes shared between client and server.
// Phase 1 only uses Vector2/PlayerState/ObstacleDef; the rest are stubbed
// in now so later phases (weapons, abilities, loot) slot in without
// reshaping this file.

export interface Vector2 {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface PlayerState {
  id: string;
  username: string;
  position: Vector2;
  velocity: Vector2;
  facing: number; // radians, direction player is aimed
  hp: number;
  armor: number;
  isAlive: boolean;
  isDashing: boolean;
  lastInputSeq: number; // for client-side prediction reconciliation later
}

export type ObstacleShape = 'rect' | 'circle';

export interface ObstacleDef {
  id: string;
  shape: ObstacleShape;
  x: number;
  y: number;
  width?: number; // rect
  height?: number; // rect
  radius?: number; // circle
}

export interface ArenaMapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  obstacles: ObstacleDef[];
  spawnPoints: Vector2[];
  // Per-map color palette so each map reads as visually distinct at a
  // glance despite sharing the same procedural textures — see
  // ArenaScene's buildFloor/buildObstacles, which apply these as tints
  // rather than generating separate textures per map.
  accentColor: number; // arena border + ambient dust particles
  floorTint: number;
  wallTint: number;
  pillarTint: number;
}

// Per-tick combat/lifecycle notifications carried alongside a snapshot,
// consumed by the client for kill feed text and hit/death feedback.
export type GameEvent =
  | { type: 'shot'; shooterId: string; angle: number; distance: number }
  | { type: 'hit'; shooterId: string; targetId: string; damage: number }
  | { type: 'death'; victimId: string; killerId: string }
  | { type: 'respawn'; playerId: string };
