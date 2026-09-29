import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config';

// Owns the Phaser.Game instance's lifecycle. React never touches Phaser
// internals past this boundary — scenes read input/emit state via the
// EventBus (see systems/EventBus.ts) rather than through React props,
// so re-renders in the React tree never disturb the Phaser game loop.
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = createGameConfig(containerRef.current);
    gameRef.current = new Phaser.Game(config);

    const handleResize = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      const game = gameRef.current;
      gameRef.current = null;
      if (!game) return;

      // Phaser's boot is asynchronous. Destroying a game that hasn't
      // finished booting tears the WebGL context out from under
      // BootScene's still-running generateTexture calls, which surfaces
      // as "Framebuffer status: Incomplete Attachment" plus a dead 0x0
      // canvas left behind in the DOM. Wait for 'ready' before tearing
      // down so teardown is always safe, whatever triggered the unmount.
      if (game.isBooted) {
        game.destroy(true);
      } else {
        game.events.once(Phaser.Core.Events.READY, () => game.destroy(true));
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh' }}
      data-testid="game-canvas-root"
    />
  );
}
