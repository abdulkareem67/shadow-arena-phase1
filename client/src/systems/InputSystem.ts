import Phaser from 'phaser';
import type { PlayerInputState } from '../entities/Player';

/**
 * Centralizes raw input reading so ArenaScene stays about orchestration,
 * not key-code plumbing. Matches control scheme in doc section 8:
 * WASD move, mouse aim, SPACE dash, left click to fire. (Q / E / R hook
 * in once abilities exist.)
 */
export class InputSystem {
  private scene: Phaser.Scene;
  private keys: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  read(): PlayerInputState {
    const pointer = this.scene.input.activePointer;
    const cam = this.scene.cameras.main;
    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);

    return {
      up: this.keys.w.isDown,
      down: this.keys.s.isDown,
      left: this.keys.a.isDown,
      right: this.keys.d.isDown,
      dashPressed: Phaser.Input.Keyboard.JustDown(this.keys.space),
      shootHeld: pointer.leftButtonDown(),
      pointerWorldX: worldPoint.x,
      pointerWorldY: worldPoint.y,
    };
  }
}
