import GameCanvas from './game/GameCanvas';

// Phase 1: mount the Phaser game directly. Later phases add react-router
// here for the main menu, profile, leaderboard, etc. (see pages/), with
// GameCanvas only mounted once the player actually enters a match.
export default function App() {
  return <GameCanvas />;
}
