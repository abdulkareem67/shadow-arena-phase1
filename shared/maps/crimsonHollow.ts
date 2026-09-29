import type { ArenaMapDef } from '../types/entities';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants/game';

const CENTER_X = ARENA_WIDTH / 2;
const CENTER_Y = ARENA_HEIGHT / 2;
const RING_RADIUS = 700;
const RING_PILLAR_COUNT = 8;

const ringPillars = Array.from({ length: RING_PILLAR_COUNT }, (_, i) => {
  const angle = (Math.PI * 2 * i) / RING_PILLAR_COUNT;
  return {
    id: `ring-pillar-${i}`,
    shape: 'circle' as const,
    x: CENTER_X + Math.cos(angle) * RING_RADIUS,
    y: CENTER_Y + Math.sin(angle) * RING_RADIUS,
    radius: 30,
  };
});

/**
 * "Crimson Hollow" — a wide-open colosseum: a loose ring of pillars
 * around a big central plaza, with only a small diamond of short cover
 * blocks at dead-center. Long sightlines favor the hitscan weapon and
 * make dashing between cover matter more than corridor fighting.
 * Purely original geometry.
 */
export const crimsonHollow: ArenaMapDef = {
  id: 'crimson-hollow',
  name: 'Crimson Hollow',
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    // Small diamond of cover blocks at the very center — gaps between
    // them (unlike Forgotten Ruins' connected cross) so the middle of
    // the arena stays crossable, just not safely.
    { id: 'core-n', shape: 'rect', x: CENTER_X - 40, y: CENTER_Y - 260, width: 80, height: 140 },
    { id: 'core-s', shape: 'rect', x: CENTER_X - 40, y: CENTER_Y + 120, width: 80, height: 140 },
    { id: 'core-e', shape: 'rect', x: CENTER_X + 120, y: CENTER_Y - 40, width: 140, height: 80 },
    { id: 'core-w', shape: 'rect', x: CENTER_X - 260, y: CENTER_Y - 40, width: 140, height: 80 },

    // Wide ring of pillars — cover while crossing the open plaza.
    ...ringPillars,

    // Corner nooks near each spawn cluster.
    { id: 'corner-nw', shape: 'circle', x: 260, y: 260, radius: 32 },
    { id: 'corner-ne', shape: 'circle', x: ARENA_WIDTH - 260, y: 260, radius: 32 },
    { id: 'corner-sw', shape: 'circle', x: 260, y: ARENA_HEIGHT - 260, radius: 32 },
    { id: 'corner-se', shape: 'circle', x: ARENA_WIDTH - 260, y: ARENA_HEIGHT - 260, radius: 32 },
  ],
  spawnPoints: [
    { x: 200, y: 200 },
    { x: ARENA_WIDTH - 200, y: 200 },
    { x: 200, y: ARENA_HEIGHT - 200 },
    { x: ARENA_WIDTH - 200, y: ARENA_HEIGHT - 200 },
    { x: CENTER_X, y: 180 },
    { x: CENTER_X, y: ARENA_HEIGHT - 180 },
    { x: 180, y: CENTER_Y },
    { x: ARENA_WIDTH - 180, y: CENTER_Y },
    { x: CENTER_X - 500, y: CENTER_Y - 500 },
    { x: CENTER_X + 500, y: CENTER_Y + 500 },
  ],
  // Warm crimson palette — multiply-tints over the same dark base
  // textures as Forgotten Ruins, so it reads as a distinct "hot/open"
  // map at a glance without needing separate art.
  accentColor: 0xff4d6a,
  floorTint: 0xff9a8a,
  wallTint: 0xff6b6b,
  pillarTint: 0xff6b6b,
};
