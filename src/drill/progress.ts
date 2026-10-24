import type { DrillResult } from '../store/db';
import type { DrillId } from './types';

type TypeStats = { total: number; correct: number; accuracy: number };
export type Summary = { total: number; correct: number; byType: Record<DrillId, TypeStats> };

const TYPES: DrillId[] = ['odds', 'preflop', 'pushfold', 'madehand', 'outs', 'vsrange'];

export function summarise(results: DrillResult[]): Summary {
  const byType = Object.fromEntries(TYPES.map((t) => [t, { total: 0, correct: 0, accuracy: 0 }])) as Record<DrillId, TypeStats>;
  let correct = 0;
  for (const r of results) {
    byType[r.type].total++;
    if (r.correct) {
      byType[r.type].correct++;
      correct++;
    }
  }
  for (const t of TYPES) byType[t].accuracy = byType[t].total === 0 ? 0 : byType[t].correct / byType[t].total;
  return { total: results.length, correct, byType };
}

/** Share of attempts answered wrongly, per scenario key. A borderline-correct answer counts as a hit. */
export function missRates(results: DrillResult[]): Map<string, number> {
  const seen = new Map<string, { attempts: number; misses: number }>();
  for (const r of results) {
    const s = seen.get(r.key) ?? { attempts: 0, misses: 0 };
    s.attempts++;
    if (!r.correct) s.misses++;
    seen.set(r.key, s);
  }
  return new Map([...seen].map(([k, s]) => [k, s.misses / s.attempts]));
}
