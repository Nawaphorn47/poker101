import { summarise, missRates } from '../../src/drill/progress';
import type { DrillResult } from '../../src/store/db';

let n = 0;
const r = (type: DrillResult['type'], key: string, correct: boolean, borderline = false): DrillResult => ({
  id: `r${n++}`, type, level: 1, key, correct, borderline, timestamp: n,
});

describe('summarise', () => {
  it('returns zeros and accuracy 0 for no results', () => {
    const s = summarise([]);
    expect(s.total).toBe(0);
    expect(s.correct).toBe(0);
    expect(s.byType.odds).toEqual({ total: 0, correct: 0, accuracy: 0 });
    expect(s.byType.preflop.accuracy).toBe(0);
    expect(s.byType.pushfold.accuracy).toBe(0);
  });
  it('computes accuracy per type', () => {
    const s = summarise([r('odds', 'a', true), r('odds', 'a', false), r('preflop', 'b', true), r('preflop', 'b', true)]);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.byType.odds).toEqual({ total: 2, correct: 1, accuracy: 0.5 });
    expect(s.byType.preflop).toEqual({ total: 2, correct: 2, accuracy: 1 });
  });
});

describe('missRates', () => {
  it('gives 0.5 for one miss in two attempts and omits unseen keys', () => {
    const m = missRates([r('odds', 'k1', false), r('odds', 'k1', true)]);
    expect(m.get('k1')).toBe(0.5);
    expect(m.has('k2')).toBe(false);
  });
  it('counts a borderline-correct answer as a hit', () => {
    const m = missRates([r('preflop', 'k', true, true), r('preflop', 'k', true, true)]);
    expect(m.get('k')).toBe(0);
  });
  it('is 1 when every attempt at a key was wrong', () => {
    expect(missRates([r('odds', 'k', false), r('odds', 'k', false)]).get('k')).toBe(1);
  });
});
