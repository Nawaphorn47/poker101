import type { Card } from '../engine/cards';
import { evaluate, compareScores } from '../engine/handEvaluator';
import { shuffledDeck } from '../engine/deck';

/** Monte Carlo equity (ties split) of `hole` against `opponents` random hands. */
export function equity(hole: Card[], board: Card[], opponents: number, samples: number, rng: () => number): number {
  const known = new Set([...hole, ...board].map((c) => c.rank * 4 + 'cdhs'.indexOf(c.suit)));
  const remaining = shuffledDeck(0).filter((c) => !known.has(c.rank * 4 + 'cdhs'.indexOf(c.suit)));
  const boardNeeded = 5 - board.length;
  const draw = opponents * 2 + boardNeeded;
  let total = 0;
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < draw; k++) {
      const j = k + Math.floor(rng() * (remaining.length - k));
      [remaining[k], remaining[j]] = [remaining[j], remaining[k]];
    }
    const full = board.concat(remaining.slice(opponents * 2, draw));
    const mine = evaluate([...hole, ...full]);
    let beaten = false;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const theirs = evaluate([remaining[o * 2], remaining[o * 2 + 1], ...full]);
      const cmp = compareScores(mine, theirs);
      if (cmp < 0) { beaten = true; break; }
      if (cmp === 0) ties++;
    }
    if (!beaten) total += 1 / (ties + 1);
  }
  return total / samples;
}
