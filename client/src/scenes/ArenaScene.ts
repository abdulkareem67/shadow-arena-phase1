import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { RemotePlayer } from '../entities/RemotePlayer';
import { InputSystem } from '../systems/InputSystem';
import { SocketClient, type WelcomePayload } from '../network/SocketClient';
import { SnapshotBuffer } from '../network/SnapshotBuffer';
import { MusicEngine } from '../audio/MusicEngine';
import { MAPS, forgottenRuins } from '../../../shared/maps';
import {
  TILE_SIZE,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_START_HP,
  PLAYER_START_ARMOR,
  RESPAWN_DELAY_MS,
  SERVER_TICK_MS,
} from '../../../shared/constants/game';
import type { ArenaMapDef, GameEvent, ObstacleDef, PlayerState } from '../../../shared/types/entities';
import type { PlayerInputMessage, StateSnapshot } from '../../../shared/protocol';

type ConnectionStatus = 'connecting' | 'ready' | 'full';

interface KillFeedEntry {
  text: Phaser.GameObjects.Text;
  expiresAt: number;
}

/**
 * Renders the arena, drives the local player's prediction + input send,
 * and reconciles/interpolates everyone (including combat) from the
 * server's authoritative snapshots. The server is the source of truth for
 * HP, damage, death and respawn — this scene only renders and requests.
 */
export class ArenaScene extends Phaser.Scene {
  private player: Player | null = null;
  private localPlayerId: string | null = null;
  private inputSystem!: InputSystem;
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  // Resolved from the server's match:welcome mapId once connected (see
  // handleWelcome) — defaults to Forgotten Ruins purely so nothing needs
  // a null-check before that arrives.
  private map: ArenaMapDef = forgottenRuins;

  private socketClient!: SocketClient;
  private snapshotBuffer = new SnapshotBuffer();
  private remotePlayers = new Map<string, RemotePlayer>();
  private usernames = new Map<string, string>();
  private connectionStatus: ConnectionStatus = 'connecting';

  private inputSeq = 0;
  private sendAccumulatorMs = 0;
  private pendingDash = false;

  private localDeathAt: number | null = null;
  private damageFlashAlpha = 0;

  private musicEngine = new MusicEngine();
  private musicStarted = false;
  private musicMuted = false;

  private statusText!: Phaser.GameObjects.Text;
  private dashCooldownText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private musicText!: Phaser.GameObjects.Text;
  private mapNameText!: Phaser.GameObjects.Text;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;
  private damageFlash!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Image;
  private killFeed: KillFeedEntry[] = [];

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Floor/obstacles/ambient particles depend on which map the server
    // picked (see shared/maps/index.ts's getRandomMap), so they're built
    // in handleWelcome once match:welcome tells us the mapId — not here.
    this.inputSystem = new InputSystem(this);

    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setZoom(1);

    this.buildHud();
    this.connectToServer();
    this.setupMusic();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
  }

  private teardown(): void {
    this.socketClient?.destroy();
    this.musicEngine.stop();
  }

  update(time: number, delta: number): void {
    this.updateHud(time);
    this.updateRemotePlayers();

    if (this.connectionStatus !== 'ready' || !this.player || !this.localPlayerId) return;

    const input = this.inputSystem.read();
    const aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, input.pointerWorldX, input.pointerWorldY);

    this.player.update(input, time);
    this.pendingDash = this.pendingDash || input.dashPressed;

    this.sendAccumulatorMs += delta;
    if (this.sendAccumulatorMs >= SERVER_TICK_MS) {
      this.sendAccumulatorMs = 0;
      this.inputSeq += 1;
      const message: PlayerInputMessage = {
        seq: this.inputSeq,
        up: input.up,
        down: input.down,
        left: input.left,
        right: input.right,
        dashPressed: this.pendingDash,
        shootHeld: input.shootHeld,
        aimAngle,
      };
      this.socketClient.sendInput(message);
      this.pendingDash = false;
    }
  }

  // --- Audio ---------------------------------------------------------

  private setupMusic(): void {
    // Autoplay policies require a real user gesture before audio can
    // start — grab the first one, whichever comes first.
    this.input.once('pointerdown', () => this.ensureMusicStarted());
    this.input.keyboard!.once('keydown', () => this.ensureMusicStarted());
    this.input.keyboard!.on('keydown-M', () => this.toggleMusicMute());
  }

  private ensureMusicStarted(): void {
    if (this.musicStarted) return;
    this.musicStarted = true;
    this.musicEngine.start().catch(() => undefined);
  }

  private toggleMusicMute(): void {
    this.musicMuted = !this.musicMuted;
    this.musicEngine.setMuted(this.musicMuted);
  }

  // --- Networking -----------------------------------------------------

  private connectToServer(): void {
    this.socketClient = new SocketClient();
    this.socketClient.onWelcome((payload) => this.handleWelcome(payload));
    this.socketClient.onSnapshot((snapshot) => this.handleSnapshot(snapshot));
    this.socketClient.onMatchFull(() => {
      this.connectionStatus = 'full';
    });
    this.socketClient.onDisconnect(() => {
      this.connectionStatus = 'connecting';
    });
  }

  private handleWelcome(payload: WelcomePayload): void {
    this.localPlayerId = payload.playerId;
    this.map = MAPS[payload.mapId] ?? forgottenRuins;

    this.buildFloor(this.map);
    this.buildAmbientParticles(this.map);
    this.buildObstacles(this.map.obstacles, this.map);

    this.player = new Player(this, payload.spawn.x, payload.spawn.y);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.obstacleGroup);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.connectionStatus = 'ready';
    this.mapNameText.setText(`MAP: ${this.map.name}`);
  }

  private handleSnapshot(snapshot: StateSnapshot): void {
    this.snapshotBuffer.push(snapshot);

    for (const state of snapshot.players) {
      this.usernames.set(state.id, state.username);
    }

    if (this.localPlayerId && this.player) {
      const own = snapshot.players.find((p) => p.id === this.localPlayerId);
      if (own) {
        this.player.applyServerState(own);
        this.player.reconcile(own.position.x, own.position.y);
      }
    }

    this.syncRemotePlayers(snapshot.players);
    this.processEvents(snapshot.events, snapshot.players);
  }

  private syncRemotePlayers(players: PlayerState[]): void {
    const seen = new Set<string>();
    for (const state of players) {
      if (state.id === this.localPlayerId) continue;
      seen.add(state.id);
      if (!this.remotePlayers.has(state.id)) {
        this.remotePlayers.set(
          state.id,
          new RemotePlayer(this, state.id, state.username, state.position.x, state.position.y),
        );
      }
    }
    for (const [id, remote] of this.remotePlayers) {
      if (!seen.has(id)) {
        remote.destroy();
        this.remotePlayers.delete(id);
      }
    }
  }

  private updateRemotePlayers(): void {
    const now = performance.now();
    for (const [id, remote] of this.remotePlayers) {
      const interp = this.snapshotBuffer.getInterpolated(id, now);
      if (!interp) continue;
      remote.setTransform(interp.x, interp.y, interp.facing);
      remote.setHealth(interp.state.hp, PLAYER_START_HP, interp.state.isAlive);
    }
  }

  private processEvents(events: GameEvent[], players: PlayerState[]): void {
    for (const event of events) {
      if (event.type === 'shot') {
        this.spawnMuzzleFlash(event, players);
      } else if (event.type === 'death') {
        const killer = this.usernames.get(event.killerId) ?? 'Unknown';
        const victim = this.usernames.get(event.victimId) ?? 'Unknown';
        this.pushKillFeed(`${killer} eliminated ${victim}`);
        if (event.victimId === this.localPlayerId) {
          this.localDeathAt = performance.now();
        }
      } else if (event.type === 'hit' && event.targetId === this.localPlayerId) {
        this.damageFlashAlpha = 0.35;
      }
    }
  }

  // --- Firing feedback ----------------------------------------------------

  /** Muzzle flash + tracer for a single shot, fired for hit and miss alike
   * so every player's weapon reads as "doing something" every time it
   * fires, not just when it lands a hit. Driven entirely by the server's
   * 'shot' event (angle + travel distance) so the tracer always ends
   * exactly where the authoritative hitscan actually stopped — at a wall,
   * at a player, or at max range. */
  private spawnMuzzleFlash(event: Extract<GameEvent, { type: 'shot' }>, players: PlayerState[]): void {
    let originX: number;
    let originY: number;

    if (event.shooterId === this.localPlayerId && this.player) {
      // Use the locally predicted/rendered position so the flash lines up
      // exactly with the sprite on screen instead of the server's
      // (slightly older) reported position for this same tick.
      originX = this.player.x;
      originY = this.player.y;
    } else {
      const shooterState = players.find((p) => p.id === event.shooterId);
      if (!shooterState) return;
      originX = shooterState.position.x;
      originY = shooterState.position.y;
    }

    // Roughly where the player texture's forward blade tip sits (r + 8 —
    // see BootScene.buildPlayerTexture) so the flash appears to come out
    // of the weapon rather than the player's center.
    const MUZZLE_OFFSET = 26;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const startX = originX + cos * MUZZLE_OFFSET;
    const startY = originY + sin * MUZZLE_OFFSET;
    const endX = originX + cos * event.distance;
    const endY = originY + sin * event.distance;

    this.drawTracer(startX, startY, endX, endY);
    this.drawMuzzleFlash(startX, startY, event.angle);
  }

  private drawTracer(x1: number, y1: number, x2: number, y2: number): void {
    const tracer = this.add.graphics().setDepth(15);
    tracer.lineStyle(3, 0xfff1a8, 0.55);
    tracer.lineBetween(x1, y1, x2, y2);
    tracer.lineStyle(1, 0xffffff, 0.9);
    tracer.lineBetween(x1, y1, x2, y2);

    this.tweens.add({
      targets: tracer,
      alpha: 0,
      duration: 90,
      ease: 'Cubic.easeOut',
      onComplete: () => tracer.destroy(),
    });
  }

  private drawMuzzleFlash(x: number, y: number, angle: number): void {
    const flash = this.add.image(x, y, 'muzzle-flash').setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const baseScale = 0.7 + Math.random() * 0.3;
    flash.setScale(baseScale);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: baseScale * 1.6,
      scaleY: baseScale * 1.6,
      duration: 80,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // --- World building ---------------------------------------------------

  private buildFloor(map: ArenaMapDef): void {
    const cols = Math.ceil(ARENA_WIDTH / TILE_SIZE);
    const rows = Math.ceil(ARENA_HEIGHT / TILE_SIZE);
    const floor = this.add.tileSprite(0, 0, ARENA_WIDTH, ARENA_HEIGHT, 'tile-floor');
    floor.setOrigin(0, 0);
    floor.setDepth(0);
    floor.setTint(map.floorTint);
    void cols;
    void rows;

    // Subtle boundary marker so the world edge is legible even before
    // the Shadow Zone system exists (Phase 3). Tinted per-map so it
    // matches that map's accent color instead of always violet.
    const border = this.add.graphics();
    border.lineStyle(4, map.accentColor, 0.5);
    border.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    border.setDepth(1);
  }

  private buildAmbientParticles(map: ArenaMapDef): void {
    // Sparse, slow-drifting dust motes across the whole arena for
    // atmosphere — sits behind obstacles/players so it never gets in the
    // way of reading the fight. Tinted to the map's accent color.
    this.add
      .particles(0, 0, 'dust-particle', {
        x: { min: 0, max: ARENA_WIDTH },
        y: { min: 0, max: ARENA_HEIGHT },
        lifespan: { min: 6000, max: 12000 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -10, max: -2 },
        scale: { start: 0.6, end: 0.1 },
        alpha: { start: 0.25, end: 0 },
        frequency: 220,
        blendMode: 'ADD',
        tint: map.accentColor,
      })
      .setDepth(2);
  }

  private buildObstacles(obstacles: ObstacleDef[], map: ArenaMapDef): void {
    this.obstacleGroup = this.physics.add.staticGroup();

    for (const obs of obstacles) {
      if (obs.shape === 'rect' && obs.width && obs.height) {
        // A tiled sprite instead of a manually-filled RenderTexture: same
        // repeating-tile look, but simpler and it can be tinted per-map.
        const wall = this.add.tileSprite(obs.x, obs.y, obs.width, obs.height, 'tile-wall');
        wall.setOrigin(0, 0);
        wall.setDepth(5);
        wall.setTint(map.wallTint);

        const body = this.obstacleGroup.create(obs.x + obs.width / 2, obs.y + obs.height / 2, undefined) as Phaser.Physics.Arcade.Sprite;
        body.setVisible(false);
        body.body!.setSize(obs.width, obs.height);
      } else if (obs.shape === 'circle' && obs.radius) {
        const img = this.add.image(obs.x, obs.y, 'obstacle-pillar');
        img.setDepth(5);
        img.setDisplaySize(obs.radius * 2, obs.radius * 2);
        img.setTint(map.pillarTint);

        const body = this.obstacleGroup.create(obs.x, obs.y, undefined) as Phaser.Physics.Arcade.Sprite;
        body.setVisible(false);
        body.body!.setCircle(obs.radius);
      }
    }
  }

  // --- HUD ---------------------------------------------------------------

  private buildHud(): void {
    this.statusText = this.add
      .text(16, 16, 'Connecting to server...', { fontFamily: 'monospace', fontSize: '14px', color: '#7c5cff' })
      .setScrollFactor(0)
      .setDepth(100);

    this.dashCooldownText = this.add
      .text(16, 40, 'DASH: READY', { fontFamily: 'monospace', fontSize: '14px', color: '#7c5cff' })
      .setScrollFactor(0)
      .setDepth(100);

    this.coordsText = this.add
      .text(16, 64, '', { fontFamily: 'monospace', fontSize: '12px', color: '#7b8296' })
      .setScrollFactor(0)
      .setDepth(100);

    this.musicText = this.add
      .text(16, 88, '', { fontFamily: 'monospace', fontSize: '11px', color: '#4a3a94' })
      .setScrollFactor(0)
      .setDepth(100);

    this.mapNameText = this.add
      .text(16, 106, '', { fontFamily: 'monospace', fontSize: '11px', color: '#7b8296' })
      .setScrollFactor(0)
      .setDepth(100);

    this.hpBarGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);

    this.vignette = this.add.image(0, 0, 'vignette').setScrollFactor(0).setDepth(90);

    this.deathText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '28px', color: '#ff4d6a', align: 'center' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.damageFlash = this.add
      .rectangle(0, 0, 1, 1, 0xff4d6a, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99);
  }

  private updateHud(time: number): void {
    const cam = this.cameras.main;

    this.vignette.setPosition(cam.width / 2, cam.height / 2);
    this.vignette.setDisplaySize(cam.width, cam.height);
    this.musicText.setText(
      !this.musicStarted ? 'Press any key for music' : this.musicMuted ? 'MUSIC: MUTED (M)' : 'MUSIC: ON (M to mute)',
    );

    if (this.connectionStatus === 'full') {
      this.statusText.setText('SERVER FULL — try again later').setColor('#ff4d6a');
      return;
    }
    if (this.connectionStatus === 'connecting' || !this.player) {
      this.statusText.setText('Connecting to server...');
      return;
    }
    if (this.statusText.text !== '') this.statusText.setText('');

    const cooldown = this.player.getDashCooldownRemaining(time);
    this.dashCooldownText.setText(cooldown > 0 ? `DASH: ${(cooldown / 1000).toFixed(1)}s` : 'DASH: READY');
    this.dashCooldownText.setColor(cooldown > 0 ? '#4a3a94' : '#7c5cff');
    this.coordsText.setText(`x:${Math.round(this.player.x)} y:${Math.round(this.player.y)}`);

    this.drawVitalsBars(cam);
    this.updateDeathOverlay(cam);
    this.updateDamageFlash(cam);
    this.pruneKillFeed(cam);
  }

  private drawVitalsBars(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.player) return;
    const barW = 220;
    const armorH = 8;
    const hpH = 14;
    const x = 16;
    const armorY = cam.height - 30;
    const hpY = cam.height - 20;

    this.hpBarGraphics.clear();

    this.hpBarGraphics.fillStyle(0x0d1017, 0.85);
    this.hpBarGraphics.fillRect(x, armorY, barW, armorH);
    this.hpBarGraphics.fillStyle(0x4fd3ff, 1);
    this.hpBarGraphics.fillRect(x, armorY, barW * Math.max(0, this.player.armor / PLAYER_START_ARMOR), armorH);

    this.hpBarGraphics.fillStyle(0x0d1017, 0.85);
    this.hpBarGraphics.fillRect(x, hpY, barW, hpH);
    this.hpBarGraphics.fillStyle(0xff4d6a, 1);
    this.hpBarGraphics.fillRect(x, hpY, barW * Math.max(0, this.player.hp / PLAYER_START_HP), hpH);
  }

  private updateDeathOverlay(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.player) return;
    this.deathText.setPosition(cam.width / 2, cam.height / 2);

    if (this.player.isAlive || this.localDeathAt === null) {
      this.deathText.setVisible(false);
      if (this.player.isAlive) this.localDeathAt = null;
      return;
    }

    const remaining = Math.max(0, RESPAWN_DELAY_MS - (performance.now() - this.localDeathAt)) / 1000;
    this.deathText.setText(`YOU DIED\nrespawning in ${remaining.toFixed(1)}s`);
    this.deathText.setVisible(true);
  }

  private updateDamageFlash(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.damageFlash.setPosition(0, 0);
    this.damageFlash.setSize(cam.width, cam.height);
    this.damageFlash.setAlpha(this.damageFlashAlpha);
    this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - 0.025);
  }

  private pushKillFeed(message: string): void {
    const cam = this.cameras.main;
    const text = this.add
      .text(cam.width - 16, 16, message, { fontFamily: 'monospace', fontSize: '13px', color: '#e7eaf2', align: 'right' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.killFeed.unshift({ text, expiresAt: performance.now() + 5000 });
    this.layoutKillFeed(cam);
  }

  private pruneKillFeed(cam: Phaser.Cameras.Scene2D.Camera): void {
    const now = performance.now();
    const before = this.killFeed.length;
    this.killFeed = this.killFeed.filter((entry) => {
      if (entry.expiresAt <= now) {
        entry.text.destroy();
        return false;
      }
      return true;
    });
    if (this.killFeed.length !== before) this.layoutKillFeed(cam);
  }

  private layoutKillFeed(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.killFeed.forEach((entry, index) => {
      entry.text.setPosition(cam.width - 16, 16 + index * 20);
    });
  }
}
