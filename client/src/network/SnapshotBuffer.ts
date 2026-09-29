import type { PlayerState } from '../../../shared/types/entities';
import type { StateSnapshot } from '../../../shared/protocol';

// Render slightly behind "now" so there are (almost) always two real
// snapshots straddling the render timestamp to interpolate between,
// smoothing over the gaps between the server's 30Hz ticks.
const INTERP_DELAY_MS = 100;
const MAX_BUFFERED_SNAPSHOTS = 8;

interface BufferedSnapshot {
  receivedAt: number;
  players: Map<string, PlayerState>;
}

export interface InterpolatedTransform {
  x: number;
  y: number;
  facing: number;
  state: PlayerState;
}

/** Buffers recent snapshots per-connection and interpolates player
 * transforms between them for smooth remote-player rendering. */
export class SnapshotBuffer {
  private buffer: BufferedSnapshot[] = [];

  push(snapshot: StateSnapshot): void {
    const players = new Map(snapshot.players.map((p) => [p.id, p]));
    this.buffer.push({ receivedAt: performance.now(), players });
    while (this.buffer.length > MAX_BUFFERED_SNAPSHOTS) this.buffer.shift();
  }

  latest(): BufferedSnapshot | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  getInterpolated(id: string, now: number = performance.now()): InterpolatedTransform | null {
    const renderTime = now - INTERP_DELAY_MS;

    let older: BufferedSnapshot | undefined;
    let newer: BufferedSnapshot | undefined;
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].receivedAt <= renderTime && this.buffer[i + 1].receivedAt >= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1];
        break;
      }
    }

    if (!older || !newer) {
      const state = this.latest()?.players.get(id);
      return state ? { x: state.position.x, y: state.position.y, facing: state.facing, state } : null;
    }

    const a = older.players.get(id);
    const b = newer.players.get(id);
    if (!a || !b) {
      const state = b ?? a;
      return state ? { x: state.position.x, y: state.position.y, facing: state.facing, state } : null;
    }

    const span = newer.receivedAt - older.receivedAt || 1;
    const t = Math.min(1, Math.max(0, (renderTime - older.receivedAt) / span));
    return {
      x: a.position.x + (b.position.x - a.position.x) * t,
      y: a.position.y + (b.position.y - a.position.y) * t,
      facing: lerpAngle(a.facing, b.facing, t),
      state: b,
    };
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
