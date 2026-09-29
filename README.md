# Shadow Arena

A fast-paced top-down 2D multiplayer battle arena, built for the browser.
Players fight other online players inside a shrinking "Shadow Zone,"
aiming to be the last one standing.

This repo is being built in phases (see **Roadmap** below). **Phases 1,
2, and a basic slice of Phase 4 are implemented**: a running client with
player movement, camera, an original arena map, collision, weapons,
health/damage/death, and a real Node.js/Socket.IO server that runs one
authoritative shared match room. There is still no matchmaking, no
bots/AI, no shrinking Shadow Zone, no auth, and no database — those come
in later phases. Everything below reflects the actual current state, not
the finished vision.

## What's playable right now

- Move a player character around an original top-down arena with WASD
- Mouse-aim (the player rotates to face the cursor)
- SPACE to dash, with a cooldown shown in the HUD
- Left click (hold) to fire an automatic hitscan blaster at other players
- HP + armor, damage, death, and respawn — armor absorbs damage first
- A kill feed and a damage flash when you're hit
- Real multiplayer: every player who connects joins one shared server
  room (up to 10 players) and sees everyone else moving and fighting in
  real time
- Arcade-physics collision against walls and pillars, including shots
  being blocked by walls (no shooting through cover)
- A camera that smoothly follows the player around a 2400×2400 map

There's no matchmaking screen, AI bots, loot, or the shrinking Shadow
Zone yet — that's Phase 3/5 onward.

## Technology stack

**Implemented:**
- Client: React 18 + TypeScript, Phaser 3 (Arcade Physics), Vite
- Server: Node.js + Express + Socket.IO, TypeScript, running one
  authoritative in-memory match room at a fixed tick rate

**Planned, not yet built (see Roadmap):**
- AI bots, loot, the shrinking Shadow Zone
- PostgreSQL + Prisma, JWT auth, matchmaking

## Project structure

```
shadow-arena/
├── client/                # React + Phaser game (working)
│   ├── src/
│   │   ├── game/           # Phaser bootstrap, config
│   │   ├── scenes/         # Phaser scenes (Boot, Arena)
│   │   ├── entities/        # Player (local, predicted) and RemotePlayer
│   │   │                     (server-interpolated)
│   │   ├── systems/          # Input reading
│   │   ├── network/           # Socket.IO client wrapper + snapshot
│   │   │                        interpolation (working)
│   │   ├── components/        # Reserved for React UI (menu, HUD overlays)
│   │   ├── pages/              # Reserved for menu/profile/leaderboard routes
│   │   ├── audio/               # Reserved for sound system (Phase 6)
│   │   └── utils/
│   └── package.json
│
├── server/                 # Node.js/Socket.IO backend (working, basic room)
│   └── src/
│       ├── index.ts          # Express + Socket.IO bootstrap
│       ├── rooms/GameRoom.ts  # Player roster, tick loop, snapshot broadcast
│       ├── game/simulation.ts  # Movement, collision, hitscan — pure functions
│       └── sockets/             # Socket.IO event wiring
│       # matchmaking/ auth/ database/ bots/ reserved for later phases
│
├── shared/                # Types/constants/map/protocol shared by both sides
│   ├── types/entities.ts
│   ├── constants/game.ts
│   ├── maps/forgottenRuins.ts   # Arena layout — used by client render + server sim
│   └── protocol/index.ts         # Socket.IO event contract (client <-> server)
│
├── prisma/                # Reserved for the Prisma schema (Phase 4+)
├── .env.example            # Server env (PORT, CLIENT_URL, ...)
└── README.md
```

## Running the game

Requires Node.js 18+.

From the repo root (npm workspaces manage both `client/` and `server/`):

```bash
npm install
npm run dev
```

This starts the server on `:3001` and the client on `:5173` together.
Open the URL Vite prints (typically `http://localhost:5173`); open it in
a second tab (or from another device on your LAN, pointed at your
machine's IP) to play against another player.

To run just one side: `npm run dev:server` or `npm run dev:client`.

Copy `.env.example` to `.env` at the repo root to customize `PORT`. If
your server isn't on `http://localhost:3001`, copy
`client/.env.example` to `client/.env.local` and set `VITE_SERVER_URL`.

To build production bundles: `npm run build`.

## Controls

| Input          | Action                |
|----------------|-----------------------|
| W / A / S / D  | Move                  |
| Mouse          | Aim / face direction  |
| Left click (hold) | Fire               |
| SPACE          | Dash (3s cooldown)    |

Q, E, and R are reserved for further abilities, added in a later phase.

## Roadmap

- [x] **Phase 1** — Project setup, Phaser game, player movement, camera, arena, collision
- [x] **Phase 2** — Weapons, shooting, health, damage, death
- [ ] **Phase 3** — AI bots, loot, abilities, shrinking Shadow Zone
- [x] **Phase 4 (partial)** — Node.js/Socket.IO server, one shared multiplayer room, server-authoritative movement + combat. Still missing: auth, database, multiple/matchmade rooms.
- [ ] **Phase 5** — Matchmaking, ranked mode, leaderboards, profiles
- [ ] **Phase 6** — Cosmetics, challenges, sound, polish
- [ ] **Phase 7** — Testing and deployment

## Design notes

All visuals (player silhouette, tiles, walls, pillars) are generated
procedurally at runtime in `client/src/scenes/BootScene.ts` — no
external or copyrighted art assets are used anywhere in this project.
The current map, "Forgotten Ruins," is an original layout defined in
`shared/maps/forgottenRuins.ts` (shared, not client-only, so the
server's authoritative simulation uses the exact same geometry as the
client's renderer).

## Architecture notes

- `shared/` holds types, constants, the map, and the Socket.IO protocol
  contract that both the client and server import, so gameplay numbers
  (speeds, cooldowns, HP, damage) and the wire format never drift
  between prediction and authority.
- **Netcode model**: `Player` (the local player) predicts its own
  movement/dash locally via Arcade Physics for snappy feel, while
  sending timestamped inputs to the server. The server re-simulates
  every player's movement and is the sole authority on combat (hitscan,
  damage, HP, death, respawn) — see `server/src/rooms/GameRoom.ts` and
  `server/src/game/simulation.ts`. Each snapshot, the local player is
  softly nudged toward the server's reported position (`Player.reconcile`)
  rather than doing full input-replay reconciliation — simple, and good
  enough at LAN/low-latency scale; full replay-based reconciliation is a
  fair follow-up for a later polish phase. `RemotePlayer` instances are
  driven purely by interpolated server snapshots (`network/SnapshotBuffer.ts`),
  never by local simulation.
- There is no login/matchmaking yet: every connecting socket auto-joins
  the one shared `GameRoom` (capped at `MAX_PLAYERS_PER_MATCH`) with an
  auto-generated guest name.
- Phaser and React are intentionally decoupled: `GameCanvas.tsx` owns
  the `Phaser.Game` lifecycle and nothing else in React touches Phaser
  internals directly, per the "keep Phaser loop separate from React
  UI" requirement.
