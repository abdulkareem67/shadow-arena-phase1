import Phaser from 'phaser';

/**
 * BootScene generates all Phase 1 textures procedurally at runtime using
 * Phaser's Graphics -> generateTexture pipeline. This keeps the project
 * asset-free (no external/copyrighted art) while still giving every
 * entity a distinct, original silhouette, per doc section 33.
 *
 * Later phases can swap generateTexture calls for real sprite sheets
 * without touching any code outside this file.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.buildPlayerTexture();
    this.buildFloorTileTexture();
    this.buildWallTexture();
    this.buildPillarTexture();
    this.buildDustParticleTexture();
    this.buildVignetteTexture();
    this.buildMuzzleFlashTexture();
  }

  create(): void {
    this.scene.start('ArenaScene');
  }

  private buildPlayerTexture(): void {
    const g = this.add.graphics();
    const r = 18; // core radius — must match Player.ts/simulation.ts's physics/hit radius
    const texW = 60;
    const texH = 56;
    // Rotation origin (Phaser sprites rotate about texture center by
    // default) — keep this exactly at (texW / 2, texH / 2) so the physics
    // circle (centered the same way in Player.ts) never drifts off the
    // visual core as the sprite spins to face the aim direction.
    const cx = texW / 2;
    const cy = texH / 2;

    // 1. Shadow trail — fading wisps stretching behind the core (opposite
    // "forward"), so facing reads at a glance before the blade tip does,
    // and it nods to the arena's Shadow Zone theme instead of a flat dot.
    for (let i = 3; i >= 1; i--) {
      const dist = i * 7;
      const wispR = r * (0.55 - i * 0.1);
      g.fillStyle(0x7c5cff, 0.16 - i * 0.03);
      g.fillCircle(cx - dist, cy, Math.max(2, wispR));
    }

    // 2. Outer energy glow behind the armor core.
    g.fillStyle(0x7c5cff, 0.18);
    g.fillCircle(cx, cy, r + 4);

    // 3. Main armor core — drawn before the shoulder plates so their
    // opaque fill isn't painted over and hidden by the core's own fill.
    g.fillStyle(0x141822, 1);
    g.fillCircle(cx, cy, r);
    g.lineStyle(2, 0x7c5cff, 1);
    g.strokeCircle(cx, cy, r);

    // 4. Shoulder plates, poking slightly past the core's rim on the
    // "sides" (the axis perpendicular to facing) — reads as a geared
    // operative silhouette instead of a bare circle.
    g.fillStyle(0x1a2030, 1);
    g.fillRoundedRect(cx - 10, cy - 20, 12, 9, 3);
    g.fillRoundedRect(cx - 10, cy + 11, 12, 9, 3);
    g.lineStyle(1.5, 0x7c5cff, 0.8);
    g.strokeRoundedRect(cx - 10, cy - 20, 12, 9, 3);
    g.strokeRoundedRect(cx - 10, cy + 11, 12, 9, 3);

    // 5. Faceted shard inset into the core — keeps the original "shard/
    // diamond core" design note, now as an inlaid detail rather than a
    // flat fill covering the whole body.
    g.fillStyle(0x7c5cff, 0.5);
    g.beginPath();
    g.moveTo(cx + 7, cy);
    g.lineTo(cx, cy - 7);
    g.lineTo(cx - 7, cy);
    g.lineTo(cx, cy + 7);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0xe7eaf2, 0.7);
    g.strokePath();

    // 6. Visor slit — bright forward-facing accent so heading is legible
    // at arena scale even before the blade registers.
    g.fillStyle(0xe7eaf2, 0.9);
    g.fillRoundedRect(cx + 2, cy - 2, 6, 4, 1.5);

    // 7. Forward blade/barrel — narrower and sharper than a flat triangle,
    // reads as a weapon tip rather than a generic arrow.
    g.fillStyle(0xe7eaf2, 1);
    g.beginPath();
    g.moveTo(cx + r - 3, cy - 4);
    g.lineTo(cx + r + 8, cy - 1.5);
    g.lineTo(cx + r + 8, cy + 1.5);
    g.lineTo(cx + r - 3, cy + 4);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x7c5cff, 0.6);
    g.strokePath();

    g.generateTexture('player-core', texW, texH);
    g.destroy();
  }

  private buildFloorTileTexture(): void {
    const g = this.add.graphics();
    const s = 64;
    g.fillStyle(0x0b0d13, 1);
    g.fillRect(0, 0, s, s);

    // Faint mottling so the floor doesn't read as a flat, repeating grid.
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0x11141d, 0.4 + Math.random() * 0.3);
      g.fillCircle(Math.random() * s, Math.random() * s, 1 + Math.random() * 2);
    }

    // Rare violet accent fleck — echoes the signal color without
    // competing with gameplay-relevant elements.
    if (Math.random() < 0.4) {
      g.fillStyle(0x7c5cff, 0.12);
      g.fillCircle(8 + Math.random() * (s - 16), 8 + Math.random() * (s - 16), 1.5);
    }

    g.lineStyle(1, 0x161b26, 1);
    g.strokeRect(0, 0, s, s);
    g.generateTexture('tile-floor', s, s);
    g.destroy();
  }

  private buildDustParticleTexture(): void {
    const size = 16;
    const canvasTexture = this.textures.createCanvas('dust-particle', size, size)!;
    const ctx = canvasTexture.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(124,92,255,0.9)');
    gradient.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvasTexture.refresh();
  }

  private buildVignetteTexture(): void {
    const size = 1024;
    const canvasTexture = this.textures.createCanvas('vignette', size, size)!;
    const ctx = canvasTexture.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.71);
    gradient.addColorStop(0, 'rgba(2,3,6,0)');
    gradient.addColorStop(1, 'rgba(2,3,6,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvasTexture.refresh();
  }

  /** A soft radial burst used for the weapon's muzzle flash (see
   * ArenaScene.drawMuzzleFlash). Built with the same canvas-gradient
   * approach as the dust particle/vignette rather than Graphics, since
   * it's a pure glow with no hard edges to speak of. */
  private buildMuzzleFlashTexture(): void {
    const size = 32;
    const canvasTexture = this.textures.createCanvas('muzzle-flash', size, size)!;
    const ctx = canvasTexture.getContext();
    const cx = size / 2;
    const cy = size / 2;

    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    bloom.addColorStop(0, 'rgba(255,241,168,0.9)');
    bloom.addColorStop(0.4, 'rgba(255,209,110,0.55)');
    bloom.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, size, size);

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 5);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    canvasTexture.refresh();
  }

  private buildWallTexture(): void {
    const g = this.add.graphics();
    const s = 64;
    g.fillStyle(0x1a2030, 1);
    g.fillRect(0, 0, s, s);
    g.lineStyle(2, 0x3a4258, 1);
    g.strokeRect(1, 1, s - 2, s - 2);
    g.fillStyle(0x2b3348, 1);
    g.fillRect(6, 6, s - 12, s - 12);
    g.generateTexture('tile-wall', s, s);
    g.destroy();
  }

  private buildPillarTexture(): void {
    const g = this.add.graphics();
    const d = 56;
    g.fillStyle(0x1a2030, 1);
    g.fillCircle(d / 2, d / 2, d / 2 - 2);
    g.lineStyle(2, 0x7c5cff, 0.6);
    g.strokeCircle(d / 2, d / 2, d / 2 - 2);
    g.generateTexture('obstacle-pillar', d, d);
    g.destroy();
  }
}
