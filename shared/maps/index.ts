import type { ArenaMapDef } from '../types/entities';
import { forgottenRuins } from './forgottenRuins';
import { crimsonHollow } from './crimsonHollow';
import { ironBastion } from './ironBastion';

export const MAPS: Record<string, ArenaMapDef> = {
  [forgottenRuins.id]: forgottenRuins,
  [crimsonHollow.id]: crimsonHollow,
  [ironBastion.id]: ironBastion,
};

export const MAP_LIST: ArenaMapDef[] = Object.values(MAPS);

/**
 * Picks one map at random. Called once per server process lifetime (see
 * GameRoom) — there's no match-end/lobby flow yet to rotate maps within
 * a running session, so restarting the server is currently how you get
 * a different map. Client and server both resolve the chosen map by id
 * (sent in match:welcome) through the MAPS registry above, so they can
 * never disagree about which layout is live.
 */
export function getRandomMap(): ArenaMapDef {
  return MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)];
}

export { forgottenRuins, crimsonHollow, ironBastion };
