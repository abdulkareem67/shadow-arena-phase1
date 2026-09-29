import type { ArenaMapDef } from '../types/entities';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants/game';

const CENTER_X = ARENA_WIDTH / 2;
const CENTER_Y = ARENA_HEIGHT / 2;

/**
 * "Iron Bastion" — a symmetric fortress: a hollow keep at dead-center
 * (diagonal gaps at its corners act as doorways), four enclosed corner
 * bastions each with their own pillar, and narrower connecting
 * corridors than Forgotten Ruins. Denser walls and shorter sightlines
 * make this the close-quarters map of the three. Purely original
 * geometry.
 */
export const ironBastion: ArenaMapDef = {
  id: 'iron-bastion',
  name: 'Iron Bastion',
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    // Central keep — four walls that don't quite meet, leaving diagonal
    // doorways at the corners instead of one open room.
    { id: 'keep-n', shape: 'rect', x: CENTER_X - 110, y: CENTER_Y - 200, width: 220, height: 40 },
    { id: 'keep-s', shape: 'rect', x: CENTER_X - 110, y: CENTER_Y + 160, width: 220, height: 40 },
    { id: 'keep-w', shape: 'rect', x: CENTER_X - 200, y: CENTER_Y - 110, width: 40, height: 220 },
    { id: 'keep-e', shape: 'rect', x: CENTER_X + 160, y: CENTER_Y - 110, width: 40, height: 220 },

    // Narrower N/S/E/W corridors than Forgotten Ruins' cross.
    { id: 'corridor-n', shape: 'rect', x: CENTER_X - 24, y: CENTER_Y - 560, width: 48, height: 340 },
    { id: 'corridor-s', shape: 'rect', x: CENTER_X - 24, y: CENTER_Y + 220, width: 48, height: 340 },
    { id: 'corridor-e', shape: 'rect', x: CENTER_X + 220, y: CENTER_Y - 24, width: 340, height: 48 },
    { id: 'corridor-w', shape: 'rect', x: CENTER_X - 560, y: CENTER_Y - 24, width: 340, height: 48 },

    // Four enclosed corner bastions, each with an L-shaped wall and a
    // pillar for cover inside.
    { id: 'bastion-nw-a', shape: 'rect', x: 260, y: 260, width: 260, height: 40 },
    { id: 'bastion-nw-b', shape: 'rect', x: 260, y: 260, width: 40, height: 260 },
    { id: 'bastion-nw-pillar', shape: 'circle', x: 420, y: 420, radius: 26 },

    { id: 'bastion-ne-a', shape: 'rect', x: ARENA_WIDTH - 520, y: 260, width: 260, height: 40 },
    { id: 'bastion-ne-b', shape: 'rect', x: ARENA_WIDTH - 300, y: 260, width: 40, height: 260 },
    { id: 'bastion-ne-pillar', shape: 'circle', x: ARENA_WIDTH - 420, y: 420, radius: 26 },

    { id: 'bastion-sw-a', shape: 'rect', x: 260, y: ARENA_HEIGHT - 300, width: 260, height: 40 },
    { id: 'bastion-sw-b', shape: 'rect', x: 260, y: ARENA_HEIGHT - 520, width: 40, height: 260 },
    { id: 'bastion-sw-pillar', shape: 'circle', x: 420, y: ARENA_HEIGHT - 420, radius: 26 },

    { id: 'bastion-se-a', shape: 'rect', x: ARENA_WIDTH - 520, y: ARENA_HEIGHT - 300, width: 260, height: 40 },
    { id: 'bastion-se-b', shape: 'rect', x: ARENA_WIDTH - 300, y: ARENA_HEIGHT - 520, width: 40, height: 260 },
    { id: 'bastion-se-pillar', shape: 'circle', x: ARENA_WIDTH - 420, y: ARENA_HEIGHT - 420, radius: 26 },
  ],
  spawnPoints: [
    { x: 340, y: 340 },
    { x: ARENA_WIDTH - 340, y: 340 },
    { x: 340, y: ARENA_HEIGHT - 340 },
    { x: ARENA_WIDTH - 340, y: ARENA_HEIGHT - 340 },
    { x: CENTER_X, y: 200 },
    { x: CENTER_X, y: ARENA_HEIGHT - 200 },
    { x: 200, y: CENTER_Y },
    { x: ARENA_WIDTH - 200, y: CENTER_Y },
    { x: CENTER_X - 150, y: CENTER_Y - 150 },
    { x: CENTER_X + 150, y: CENTER_Y + 150 },
  ],
  // Cool steel/cyan palette — reads as the "fortified" map at a glance.
  accentColor: 0x4fd3ff,
  floorTint: 0x9fd9ff,
  wallTint: 0x6fa8dc,
  pillarTint: 0x6fa8dc,
};
