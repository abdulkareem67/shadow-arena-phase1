import Phaser from 'phaser';

/**
 * A non-local player. Unlike Player.ts, this has no physics body and no
 * local simulation at all — its transform and HP are set purely from
 * SnapshotBuffer-interpolated server state each frame (see ArenaScene).
 */
export class RemotePlayer {
  readonly id: string;
  readonly username: string;
  private sprite: Phaser.GameObjects.Sprite;
  private hpBar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, id: string, username: string, x: number, y: number) {
    this.id = id;
    this.username = username;
    this.sprite = scene.add.sprite(x, y, 'player-core');
    this.sprite.setDepth(10);
    this.sprite.setTint(0xff9d4d); // distinct color from the local (violet) player
    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(11);
    this.label = scene.add
      .text(x, y - 46, username, { fontFamily: 'monospace', fontSize: '11px', color: '#7b8296' })
      .setOrigin(0.5, 1)
      .setDepth(11);
  }

  setTransform(x: number, y: number, facing: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setRotation(facing);
    this.label.setPosition(x, y - 46);
  }

  setHealth(hp: number, maxHp: number, isAlive: boolean): void {
    this.sprite.setAlpha(isAlive ? 1 : 0.25);
    this.hpBar.clear();
    if (!isAlive) return;

    const barWidth = 36;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 34;
    this.hpBar.fillStyle(0x1a2030, 0.85);
    this.hpBar.fillRect(x, y, barWidth, 5);
    this.hpBar.fillStyle(0xff4d6a, 1);
    this.hpBar.fillRect(x, y, barWidth * Math.max(0, Math.min(1, hp / maxHp)), 5);
  }

  destroy(): void {
    this.sprite.destroy();
    this.hpBar.destroy();
    this.label.destroy();
  }
}
