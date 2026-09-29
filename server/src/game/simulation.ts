// Pure, framework-free authoritative simulation helpers used by GameRoom's
// tick. No Node/Express/Socket.IO dependency here so this stays easy to
// reason about (and unit-testable later) in isolation from transport.
import {
  PLAYER_BASE_SPEED,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
  WEAPON_RANGE,
  PLAYER_RADIUS,
} from '../../../shared/constants/game';
import type { ObstacleDef } from '../../../shared/types/entities';
import type { PlayerInputMessage } from '../../../shared/protocol';

export interface ServerPlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // radians
  hp: number;
  armor: number;
  isAlive: boolean;
  isDashing: boolean;
  dashEndsAt: number;
  dashCooldownEndsAt: number;
  dashDirX: number;
  dashDirY: number;
  fireCooldownEndsAt: number;
  respawnAt: number;
  lastInputSeq: number;
}

const DASH_SPEED = PLAYER_BASE_SPEED * DASH_SPEED_MULTIPLIER;

/** Mirrors client/src/entities/Player.ts's move + dash logic so the
 * server's authoritative position matches what the local player predicts. */
export function integrateMovement(
  player: ServerPlayerState,
  input: PlayerInputMessage,
  dt: number,
  now: number,
): void {
  player.facing = input.aimAngle;

  if (player.isDashing) {
    if (now >= player.dashEndsAt) {
      player.isDashing = false;
    } else {
      player.vx = player.dashDirX * DASH_SPEED;
      player.vy = player.dashDirY * DASH_SPEED;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      return;
    }
  }

  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moveLen = Math.hypot(mx, my);
  if (moveLen > 0) {
    mx /= moveLen;
    my /= moveLen;
    player.vx = mx * PLAYER_BASE_SPEED;
    player.vy = my * PLAYER_BASE_SPEED;
  } else {
    player.vx = 0;
    player.vy = 0;
  }

  if (input.dashPressed && now >= player.dashCooldownEndsAt) {
    if (moveLen > 0) {
      player.dashDirX = mx;
      player.dashDirY = my;
    } else {
      player.dashDirX = Math.cos(player.facing);
      player.dashDirY = Math.sin(player.facing);
    }
    player.isDashing = true;
    player.dashEndsAt = now + DASH_DURATION_MS;
    player.dashCooldownEndsAt = now + DASH_COOLDOWN_MS;
    player.vx = player.dashDirX * DASH_SPEED;
    player.vy = player.dashDirY * DASH_SPEED;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
}

/** Circle-vs-obstacle push-out, applied in place. One pass through the
 * obstacle list is enough for this map's geometry (obstacles don't overlap
 * each other, so there's no order-dependence to worry about). */
export function resolveObstacleCollisions(
  entity: { x: number; y: number },
  radius: number,
  obstacles: ObstacleDef[],
): void {
  for (const obs of obstacles) {
    if (obs.shape === 'rect' && obs.width && obs.height) {
      pushOutOfRect(entity, radius, obs.x, obs.y, obs.width, obs.height);
    } else if (obs.shape === 'circle' && obs.radius) {
      pushOutOfCircle(entity, radius, obs.x, obs.y, obs.radius);
    }
  }
}

function pushOutOfRect(entity: { x: number; y: number }, radius: number, rx: number, ry: number, rw: number, rh: number): void {
  const closestX = clamp(entity.x, rx, rx + rw);
  const closestY = clamp(entity.y, ry, ry + rh);
  const dx = entity.x - closestX;
  const dy = entity.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) return;

  if (distSq > 0) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    entity.x += (dx / dist) * overlap;
    entity.y += (dy / dist) * overlap;
    return;
  }

  // Center is exactly on/inside the rect edge — push out along the
  // shallowest penetration axis instead of dividing by a zero distance.
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const overlapX = rw / 2 + radius - Math.abs(entity.x - cx);
  const overlapY = rh / 2 + radius - Math.abs(entity.y - cy);
  if (overlapX < overlapY) {
    entity.x += entity.x < cx ? -overlapX : overlapX;
  } else {
    entity.y += entity.y < cy ? -overlapY : overlapY;
  }
}

function pushOutOfCircle(entity: { x: number; y: number }, radius: number, cx: number, cy: number, obstacleRadius: number): void {
  const dx = entity.x - cx;
  const dy = entity.y - cy;
  const dist = Math.hypot(dx, dy);
  const minDist = radius + obstacleRadius;
  if (dist >= minDist) return;

  if (dist > 0) {
    const overlap = minDist - dist;
    entity.x += (dx / dist) * overlap;
    entity.y += (dy / dist) * overlap;
  } else {
    entity.x += minDist;
  }
}

export interface HitscanResult {
  /** id of the nearest player hit, or null if the shot missed or was
   * blocked by a wall before reaching anyone. */
  hitPlayerId: string | null;
  /** Distance the shot actually traveled before hitting something (a
   * player or a wall) or running out of range — the client uses this to
   * draw a tracer that stops exactly where the shot stopped, hit or not. */
  distance: number;
}

/** Hitscan from the shooter along its facing angle. */
export function performHitscan(
  shooter: ServerPlayerState,
  players: ServerPlayerState[],
  obstacles: ObstacleDef[],
): HitscanResult {
  const dx = Math.cos(shooter.facing);
  const dy = Math.sin(shooter.facing);
  let nearestT = WEAPON_RANGE;
  let hitPlayerId: string | null = null;

  for (const target of players) {
    if (target.id === shooter.id || !target.isAlive) continue;
    const t = raySegmentVsCircle(shooter.x, shooter.y, dx, dy, target.x, target.y, PLAYER_RADIUS, nearestT);
    if (t !== null && t < nearestT) {
      nearestT = t;
      hitPlayerId = target.id;
    }
  }

  for (const obs of obstacles) {
    let t: number | null = null;
    if (obs.shape === 'rect' && obs.width && obs.height) {
      t = raySegmentVsRect(shooter.x, shooter.y, dx, dy, obs.x, obs.y, obs.width, obs.height, nearestT);
    } else if (obs.shape === 'circle' && obs.radius) {
      t = raySegmentVsCircle(shooter.x, shooter.y, dx, dy, obs.x, obs.y, obs.radius, nearestT);
    }
    if (t !== null && t < nearestT) {
      nearestT = t;
      hitPlayerId = null; // a wall closer than any player blocks the shot
    }
  }

  return { hitPlayerId, distance: nearestT };
}

function raySegmentVsCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number, maxDist: number): number | null {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  let t = (-b - sqrtDisc) / 2;
  if (t < 0) t = (-b + sqrtDisc) / 2;
  if (t < 0 || t > maxDist) return null;
  return t;
}

function raySegmentVsRect(ox: number, oy: number, dx: number, dy: number, rx: number, ry: number, rw: number, rh: number, maxDist: number): number | null {
  let tmin = 0;
  let tmax = maxDist;

  if (Math.abs(dx) < 1e-9) {
    if (ox < rx || ox > rx + rw) return null;
  } else {
    let t1 = (rx - ox) / dx;
    let t2 = (rx + rw - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (Math.abs(dy) < 1e-9) {
    if (oy < ry || oy > ry + rh) return null;
  } else {
    let t1 = (ry - oy) / dy;
    let t2 = (ry + rh - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (tmin < 0) return tmax >= 0 && tmax <= maxDist ? tmax : null;
  return tmin <= maxDist ? tmin : null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
