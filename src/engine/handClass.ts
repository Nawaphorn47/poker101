import type { Card } from './cards';

const LETTERS = '23456789TJQKA';

/** e.g. "AA", "AKs", "T9o" — high card first. */
export function handClass(hole: Card[]): string {
  const [a, b] = hole[0].rank >= hole[1].rank ? [hole[0], hole[1]] : [hole[1], hole[0]];
  const name = LETTERS[a.rank - 2] + LETTERS[b.rank - 2];
  if (a.rank === b.rank) return name;
  return name + (a.suit === b.suit ? 's' : 'o');
}

const points = (rank: number) => (rank === 14 ? 10 : rank === 13 ? 8 : rank === 12 ? 7 : rank === 11 ? 6 : rank / 2);

/** Chen formula preflop strength (higher is stronger). */
export function chenScore(hole: Card[]): number {
  const hi = Math.max(hole[0].rank, hole[1].rank);
  const lo = Math.min(hole[0].rank, hole[1].rank);
  if (hi === lo) return Math.ceil(Math.max(5, points(hi) * 2));
  let score = points(hi);
  if (hole[0].suit === hole[1].suit) score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

export const ALL_CLASSES: { name: string; score: number }[] = (() => {
  const out: { name: string; score: number }[] = [];
  for (let hi = 14; hi >= 2; hi--) {
    for (let lo = hi; lo >= 2; lo--) {
      const variants: [string, Card[]][] =
        hi === lo
          ? [[LETTERS[hi - 2] + LETTERS[lo - 2], [{ rank: hi, suit: 's' }, { rank: lo, suit: 'h' }]]]
          : [
              [LETTERS[hi - 2] + LETTERS[lo - 2] + 's', [{ rank: hi, suit: 's' }, { rank: lo, suit: 's' }]],
              [LETTERS[hi - 2] + LETTERS[lo - 2] + 'o', [{ rank: hi, suit: 's' }, { rank: lo, suit: 'h' }]],
            ];
      for (const [name, cards] of variants) out.push({ name, score: chenScore(cards) });
    }
  }
  return out;
})();
