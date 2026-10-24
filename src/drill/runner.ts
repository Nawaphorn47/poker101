import type { DrillModule, Question } from './types';

const CANDIDATES = 5;
const MISS_BONUS = 3;
export const SET_SIZE = 10;

/**
 * Builds a question set. For each slot it generates a few candidates and picks one with probability
 * proportional to 1 + 3 x missRate(key), so questions the player gets wrong come up more often.
 */
export function buildSet(
  module: DrillModule,
  level: number,
  misses: Map<string, number>,
  rng: () => number,
  size = SET_SIZE,
): Question[] {
  const set: Question[] = [];
  for (let slot = 0; slot < size; slot++) {
    const candidates = Array.from({ length: CANDIDATES }, () => module.generate(rng, level));
    const weights = candidates.map((q) => 1 + MISS_BONUS * (misses.get(q.key) ?? 0));
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    let pick = candidates.length - 1;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        pick = i;
        break;
      }
    }
    set.push(candidates[pick]);
  }
  return set;
}
