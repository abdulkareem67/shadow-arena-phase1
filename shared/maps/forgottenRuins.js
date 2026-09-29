import { ARENA_WIDTH, ARENA_HEIGHT } from '../constants/game';
/**
 * "Forgotten Ruins" — original layout: a ring of outer walls, four
 * corridor-forming inner wall segments, and scattered circular pillars
 * for line-of-sight breaks. Purely original geometry, no reference to
 * any existing game's map.
 *
 * Lives in shared/ (not client-only) because the server needs the same
 * obstacle and spawn-point data for authoritative collision resolution
 * and hitscan line-of-sight checks.
 */
export const forgottenRuins = {
    id: 'forgotten-ruins',
    name: 'Forgotten Ruins',
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    obstacles: [
        // Inner cross-shaped wall segments forming corridors
        { id: 'wall-n', shape: 'rect', x: ARENA_WIDTH / 2 - 32, y: ARENA_HEIGHT / 2 - 500, width: 64, height: 260 },
        { id: 'wall-s', shape: 'rect', x: ARENA_WIDTH / 2 - 32, y: ARENA_HEIGHT / 2 + 240, width: 64, height: 260 },
        { id: 'wall-e', shape: 'rect', x: ARENA_WIDTH / 2 + 240, y: ARENA_HEIGHT / 2 - 32, width: 260, height: 64 },
        { id: 'wall-w', shape: 'rect', x: ARENA_WIDTH / 2 - 500, y: ARENA_HEIGHT / 2 - 32, width: 260, height: 64 },
        // Four corner rooms
        { id: 'wall-nw-a', shape: 'rect', x: 300, y: 300, width: 220, height: 48 },
        { id: 'wall-nw-b', shape: 'rect', x: 300, y: 300, width: 48, height: 220 },
        { id: 'wall-ne-a', shape: 'rect', x: ARENA_WIDTH - 520, y: 300, width: 220, height: 48 },
        { id: 'wall-ne-b', shape: 'rect', x: ARENA_WIDTH - 348, y: 300, width: 48, height: 220 },
        { id: 'wall-sw-a', shape: 'rect', x: 300, y: ARENA_HEIGHT - 348, width: 220, height: 48 },
        { id: 'wall-sw-b', shape: 'rect', x: 300, y: ARENA_HEIGHT - 520, width: 48, height: 220 },
        { id: 'wall-se-a', shape: 'rect', x: ARENA_WIDTH - 520, y: ARENA_HEIGHT - 348, width: 220, height: 48 },
        { id: 'wall-se-b', shape: 'rect', x: ARENA_WIDTH - 348, y: ARENA_HEIGHT - 520, width: 48, height: 220 },
        // Scattered pillars for open-area cover
        { id: 'pillar-1', shape: 'circle', x: ARENA_WIDTH / 2 - 300, y: ARENA_HEIGHT / 2 - 300, radius: 28 },
        { id: 'pillar-2', shape: 'circle', x: ARENA_WIDTH / 2 + 300, y: ARENA_HEIGHT / 2 - 300, radius: 28 },
        { id: 'pillar-3', shape: 'circle', x: ARENA_WIDTH / 2 - 300, y: ARENA_HEIGHT / 2 + 300, radius: 28 },
        { id: 'pillar-4', shape: 'circle', x: ARENA_WIDTH / 2 + 300, y: ARENA_HEIGHT / 2 + 300, radius: 28 },
        { id: 'pillar-5', shape: 'circle', x: ARENA_WIDTH / 2, y: 500, radius: 28 },
        { id: 'pillar-6', shape: 'circle', x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 500, radius: 28 },
    ],
    spawnPoints: [
        { x: 200, y: 200 },
        { x: ARENA_WIDTH - 200, y: 200 },
        { x: 200, y: ARENA_HEIGHT - 200 },
        { x: ARENA_WIDTH - 200, y: ARENA_HEIGHT - 200 },
        { x: ARENA_WIDTH / 2, y: 150 },
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 150 },
        { x: 150, y: ARENA_HEIGHT / 2 },
        { x: ARENA_WIDTH - 150, y: ARENA_HEIGHT / 2 },
        { x: ARENA_WIDTH / 2 - 150, y: ARENA_HEIGHT / 2 - 150 },
        { x: ARENA_WIDTH / 2 + 150, y: ARENA_HEIGHT / 2 + 150 },
    ],
};
