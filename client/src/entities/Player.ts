import Phaser from 'phaser';
import {
  PLAYER_BASE_SPEED,
  PLAYER_START_HP,
  PLAYER_START_ARMOR,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
} from '../../../shared/constants/game';
import type { PlayerState } from '../../../shared/types/entities';

// Divergence beyond this from the server's reported position is treated
// as a teleport (e.g. just respawned) and snapped instead of eased.
const RECONCILE_SNAP_DISTANCE = 120;
// Fraction of the remaining gap to the server position closed per snapshot.
const RECONCILE_LERP_FACTOR = 0.12;

export interface PlayerInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dashPressed: boolean;
  shootHeld: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
}

/**
 * Client-side representation of the local player. In Phase 1 this drives
 * movement directly; from Phase 4 onward this becomes the *predicted*
 * local state that gets reconciled against server snapshots (see
 * network/ once it exists), while remote players are driven purely by
 * interpolated server state instead of local input.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  public hp = PLAYER_START_HP;
  public armor = PLAYER_START_ARMOR;
  public isAlive = true;

  private isDashing = false;
  private dashEndsAt = 0;
  private dashCooldownEndsAt = 0;
  private dashDirection = new Phaser.Math.Vector2(0, 0);

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-core');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCircle(18, this.width / 2 - 18, this.height / 2 - 18);
    this.setDamping(true);
    this.setDrag(0.0006);
    this.setMaxVelocity(PLAYER_BASE_SPEED * DASH_SPEED_MULTIPLIER);
    this.setDepth(10);
  }

  update(input: PlayerInputState, time: number): void {
    if (!this.isAlive) {
      this.setVelocity(0, 0);
      return;
    }

    // Face the pointer/aim direction, per doc section 8 (Mouse = Aim).
    const angle = Phaser.Math.Angle.Between(this.x, this.y, input.pointerWorldX, input.pointerWorldY);
    this.setRotation(angle);

    if (this.isDashing) {
      if (time >= this.dashEndsAt) {
        this.isDashing = false;
      } else {
        const dashSpeed = PLAYER_BASE_SPEED * DASH_SPEED_MULTIPLIER;
        this.setVelocity(this.dashDirection.x * dashSpeed, this.dashDirection.y * dashSpeed);
        return;
      }
    }

    const move = new Phaser.Math.Vector2(0, 0);
    if (input.up) move.y -= 1;
    if (input.down) move.y += 1;
    if (input.left) move.x -= 1;
    if (input.right) move.x += 1;

    if (move.lengthSq() > 0) {
      move.normalize();
      this.setVelocity(move.x * PLAYER_BASE_SPEED, move.y * PLAYER_BASE_SPEED);
    } else {
      this.setVelocity(0, 0);
    }

    if (input.dashPressed && time >= this.dashCooldownEndsAt) {
      const dashDir = move.lengthSq() > 0 ? move.clone() : Phaser.Math.Vector2.RIGHT.clone().rotate(this.rotation);
      this.dashDirection = dashDir.normalize();
      this.isDashing = true;
      this.dashEndsAt = time + DASH_DURATION_MS;
      this.dashCooldownEndsAt = time + DASH_COOLDOWN_MS;
    }
  }

  public getDashCooldownRemaining(time: number): number {
    return Math.max(0, this.dashCooldownEndsAt - time);
  }

  /** HP/armor/death are server-authoritative — copy them in from the
   * latest snapshot rather than computing them locally. */
  public applyServerState(state: PlayerState): void {
    this.hp = state.hp;
    this.armor = state.armor;
    this.isAlive = state.isAlive;
  }

  /** Soft-correct the locally-predicted position toward the server's
   * reported position for this player. Not full input-replay
   * reconciliation (see plan notes) — a small per-snapshot nudge is
   * enough to stay in sync at LAN/low-latency scale without fighting
   * the local prediction that keeps movement feeling responsive. */
  public reconcile(serverX: number, serverY: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = serverX - this.x;
    const dy = serverY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > RECONCILE_SNAP_DISTANCE) {
      body.reset(serverX, serverY);
      return;
    }
    if (dist < 0.5) return;

    body.x += dx * RECONCILE_LERP_FACTOR;
    body.y += dy * RECONCILE_LERP_FACTOR;
  }
}
