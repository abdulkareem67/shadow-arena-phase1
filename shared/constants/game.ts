// Shared gameplay constants used by both client and (later) server.
// Keeping these in one place means the server's authoritative simulation
// and the client's prediction/rendering never drift apart.

export const ARENA_WIDTH = 2400;
export const ARENA_HEIGHT = 2400;

export const TILE_SIZE = 64;

export const PLAYER_START_HP = 100;
export const PLAYER_START_ARMOR = 50;
export const PLAYER_BASE_SPEED = 220; // px/sec
export const PLAYER_RADIUS = 18; // collision circle radius in px

export const DASH_SPEED_MULTIPLIER = 3.2;
export const DASH_DURATION_MS = 180;
export const DASH_COOLDOWN_MS = 3000;

export const WEAPON_DAMAGE = 18;
export const WEAPON_RANGE = 900; // px
export const WEAPON_FIRE_COOLDOWN_MS = 220; // automatic hitscan blaster
export const RESPAWN_DELAY_MS = 3000;

export const SERVER_TICK_RATE = 30; // updates per second (see doc section 16)
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

export const MIN_PLAYERS_PER_MATCH = 2;
export const MAX_PLAYERS_PER_MATCH = 10;

// Shadow Zone shrink stages, expressed as % of original arena radius.
export const ZONE_STAGES = [100, 80, 60, 40, 20, 10] as const;
