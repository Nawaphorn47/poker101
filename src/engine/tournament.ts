import type { HandConfig } from './hand';
import { applyStacks, levelForHand, makeHandConfig, nextButton, type Player } from './blinds';

export const TOURNAMENT_PLAYERS = 9;
export const TOURNAMENT_START_STACK = 1500;
const PRIZES = [450, 270, 180]; // 50% / 30% / 20% of a 900-unit pool

export type Tournament = {
  players: Player[];
  buttonId: number;
  handNumber: number;
  /** player ids in bust order (first out first) */
  eliminated: number[];
};

export function newTournament(): Tournament {
  return {
    players: Array.from({ length: TOURNAMENT_PLAYERS }, (_, id) => ({ id, stack: TOURNAMENT_START_STACK })),
    buttonId: 0,
    handNumber: 0,
    eliminated: [],
  };
}

export function nextTournamentHand(t: Tournament, seed: number): HandConfig {
  return makeHandConfig(t.players, t.buttonId, seed, levelForHand(t.handNumber + 1));
}

/** stacks are keyed by player id; ids not in the map keep their stacks. */
export function settleTournament(t: Tournament, stacks: Map<number, number>): Tournament {
  const before = new Map(t.players.map((p) => [p.id, p.stack]));
  const players = applyStacks(t.players, stacks);
  // players busting in the same hand: smaller starting stack goes out first
  const busted = players
    .filter((p) => p.stack === 0 && !t.eliminated.includes(p.id))
    .sort((a, b) => before.get(a.id)! - before.get(b.id)! || b.id - a.id)
    .map((p) => p.id);
  const alive = players.filter((p) => p.stack > 0).map((p) => p.id);
  return {
    players,
    handNumber: t.handNumber + 1,
    eliminated: [...t.eliminated, ...busted],
    buttonId: alive.length > 0 ? nextButton(alive, t.buttonId) : t.buttonId,
  };
}

export function isOver(t: Tournament): boolean {
  return t.players.filter((p) => p.stack > 0).length <= 1;
}

/** Finishing order, best first: survivors by stack, then busted players latest-out first. */
export function standings(t: Tournament): number[] {
  const alive = t.players.filter((p) => p.stack > 0).sort((a, b) => b.stack - a.stack).map((p) => p.id);
  return [...alive, ...[...t.eliminated].reverse()];
}

export function payouts(t: Tournament): Map<number, number> {
  const order = standings(t);
  return new Map(PRIZES.map((prize, i) => [order[i], prize] as [number, number]));
}
