import Phaser from 'phaser';
import { ArenaScene } from '../scenes/ArenaScene';
import { BootScene } from '../scenes/BootScene';

// Central Phaser config. Scenes are registered here; new scenes (MainMenu,
// Matchmaking, MatchEnd, etc.) get pushed into this array in later phases.
export function createGameConfig(parent: HTMLDivElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#05060a',
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: false,
    roundPixels: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, ArenaScene],
  };
}
