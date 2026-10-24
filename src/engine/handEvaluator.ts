import type { Card } from './cards';

export type HandScore = { category: number; tiebreak: number[] };

/** Best 5-card straight high card from a descending-unique rank list, or 0. */
function straightHigh(ranksDesc: number[]): number {
  const set = new Set(ranksDesc);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let i = 0; i < 5; i++) if (!set.has(high - i)) { ok = false; break; }
    if (ok) return high;
  }
  return 0;
}

export function evaluate(cards: Card[]): HandScore {
  const counts = new Map<number, number>();
  const bySuit = new Map<string, number[]>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
    const arr = bySuit.get(c.suit) ?? [];
    arr.push(c.rank);
    bySuit.set(c.suit, arr);
  }

  let flushRanks: number[] | null = null;
  for (const ranks of bySuit.values())
    if (ranks.length >= 5) flushRanks = ranks.slice().sort((a, b) => b - a);

  if (flushRanks) {
    const sf = straightHigh(flushRanks);
    if (sf) return { category: 8, tiebreak: [sf] };
  }

  // groups sorted by count desc, then rank desc
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranksDesc = [...counts.keys()].sort((a, b) => b - a);

  if (groups[0][1] === 4) {
    const kicker = ranksDesc.find((r) => r !== groups[0][0])!;
    return { category: 7, tiebreak: [groups[0][0], kicker] };
  }
  if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) {
    return { category: 6, tiebreak: [groups[0][0], groups[1][0]] };
  }
  if (flushRanks) return { category: 5, tiebreak: flushRanks.slice(0, 5) };

  const st = straightHigh(ranksDesc);
  if (st) return { category: 4, tiebreak: [st] };

  if (groups[0][1] === 3) {
    const kickers = ranksDesc.filter((r) => r !== groups[0][0]).slice(0, 2);
    return { category: 3, tiebreak: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    const pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]).slice(0, 2);
    const kicker = ranksDesc.find((r) => !pairs.includes(r))!;
    return { category: 2, tiebreak: [...pairs, kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = ranksDesc.filter((r) => r !== groups[0][0]).slice(0, 3);
    return { category: 1, tiebreak: [groups[0][0], ...kickers] };
  }
  return { category: 0, tiebreak: ranksDesc.slice(0, 5) };
}

export function compareScores(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const d = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
