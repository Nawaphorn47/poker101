import type { HandConfig } from './hand';

export type Blinds = { sb: number; bb: number };
export type Player = { id: number; stack: number };

export const TOURNAMENT_LEVELS: Blinds[] = [
  { sb: 10, bb: 20 }, { sb: 15, bb: 30 }, { sb: 25, bb: 50 }, { sb: 50, bb: 100 }, { sb: 75, bb: 150 },
  { sb: 100, bb: 200 }, { sb: 150, bb: 300 }, { sb: 200, bb: 400 }, { sb: 300, bb: 600 }, { sb: 500, bb: 1000 },
];

export const HANDS_PER_LEVEL = 10;

/** handNumber is 1-based. */
export function levelForHand(handNumber: number): Blinds {
  const idx = Math.min(Math.floor((handNumber - 1) / HANDS_PER_LEVEL), TOURNAMENT_LEVELS.length - 1);
  return TOURNAMENT_LEVELS[idx];
}

/** Next id after `current` (cyclic) among the ids still in the game. */
export function nextButton(seatIds: number[], current: number): number {
  const sorted = [...seatIds].sort((a, b) => a - b);
  return sorted.find((id) => id > current) ?? sorted[0];
}

/** Players with chips, ordered by id, become engine seats 0..n-1. */
export function makeHandConfig(players: Player[], buttonId: number, seed: number, blinds: Blinds): HandConfig {
  const alive = players.filter((p) => p.stack > 0).sort((a, b) => a.id - b.id);
  if (alive.length < 2) throw new Error('need at least two players with chips');
  const buttonSeat = Math.max(0, alive.findIndex((p) => p.id === buttonId));
  return {
    seed,
    seats: alive.map((p) => ({ id: p.id, stack: p.stack })),
    buttonSeat,
    smallBlind: blinds.sb,
    bigBlind: blinds.bb,
  };
}

export function applyStacks(players: Player[], stacks: Map<number, number>): Player[] {
  return players.map((p) => (stacks.has(p.id) ? { ...p, stack: stacks.get(p.id)! } : p));
}
