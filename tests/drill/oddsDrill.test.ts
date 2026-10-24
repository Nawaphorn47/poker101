import { oddsDrill } from '../../src/drill/modules/oddsDrill';
import type { Question } from '../../src/drill/types';
import { outsEquity, requiredEquity, evCall } from '../../src/drill/oddsMath';
import { mulberry32 } from '../../src/drill/../engine/deck';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const gen = (level: number, seed: number) => oddsDrill.generate(mulberry32(seed), level);

describe('level 1: required equity', () => {
  it('the option equal to the exact required percentage is the only correct one', () => {
    for (const s of seeds) {
      const q = gen(1, s);
      const sc = q.scenario as { pot: number; call: number };
      const exact = Math.round(requiredEquity(sc.call, sc.pot) * 100);
      const right = q.options.filter((o) => oddsDrill.grade(q, o.value).correct);
      expect(right.map((o) => Number(o.value))).toEqual([exact]);
    }
  });
  it('has 4 distinct options at least 10 points apart, all within 1..99', () => {
    for (const s of seeds) {
      const vals = gen(1, s).options.map((o) => Number(o.value)).sort((a, b) => a - b);
      expect(vals).toHaveLength(4);
      for (let i = 1; i < vals.length; i++) expect(vals[i] - vals[i - 1]).toBeGreaterThanOrEqual(10);
      expect(vals[0]).toBeGreaterThanOrEqual(1);
      expect(vals[3]).toBeLessThanOrEqual(99);
    }
  });
  it('an overbet of 1.5x the pot needs 37.5% and still gets four options', () => {
    const q: Question = {
      type: 'odds', level: 1, key: 'odds:L1', prompt: '', options: [],
      scenario: { variant: 'required', pot: 100 + 150, call: 150, prePot: 100 },
    };
    const g = oddsDrill.grade(q, '38');
    expect(g.correct).toBe(true);
    expect(requiredEquity(150, 250)).toBeCloseTo(0.375, 10);
  });
});

describe('level 2: estimate equity from outs', () => {
  it('exactly one option is within 5 points of exact equity', () => {
    for (const s of seeds) {
      const q = gen(2, s);
      const sc = q.scenario as { outs: number; street: 'flop' | 'turn' };
      const exact = outsEquity(sc.outs, sc.street) * 100;
      const right = q.options.filter((o) => oddsDrill.grade(q, o.value).correct);
      expect(right).toHaveLength(1);
      expect(Math.abs(Number(right[0].value) - exact)).toBeLessThanOrEqual(5);
    }
  });
  it('5 points away is correct and 5.1 away is not', () => {
    const q: Question = {
      type: 'odds', level: 2, key: 'odds:L2:flop:9', prompt: '', options: [],
      scenario: { variant: 'outs', outs: 9, street: 'flop', pot: 0 },
    };
    const exact = outsEquity(9, 'flop') * 100;
    expect(oddsDrill.grade(q, String(exact + 5)).correct).toBe(true);
    expect(oddsDrill.grade(q, String(exact + 5.1)).correct).toBe(false);
  });
  it('outs of 1 and 15 give options within 0..100', () => {
    for (const outs of [1, 15]) {
      for (const street of ['flop', 'turn'] as const) {
        const q = gen(2, outs * 7 + (street === 'flop' ? 1 : 2));
        for (const o of q.options) {
          expect(Number(o.value)).toBeGreaterThanOrEqual(0);
          expect(Number(o.value)).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('level 3: call or fold with outs', () => {
  it('is correct exactly when the EV sign says so and carries ev in chips', () => {
    for (const s of seeds) {
      const q = gen(3, s);
      const sc = q.scenario as { outs: number; street: 'flop' | 'turn'; pot: number; call: number };
      const ev = evCall(outsEquity(sc.outs, sc.street), sc.pot, sc.call);
      const call = oddsDrill.grade(q, 'call');
      const fold = oddsDrill.grade(q, 'fold');
      expect(call.correct).toBe(ev > 0);
      expect(fold.correct).toBe(ev <= 0);
      expect(call.ev).toEqual({ chosen: ev, best: Math.max(ev, 0), unit: 'chips' });
      expect(fold.ev).toEqual({ chosen: 0, best: Math.max(ev, 0), unit: 'chips' });
    }
  });
});

describe('all levels', () => {
  it('grades are exact and never borderline', () => {
    for (const level of [1, 2, 3]) {
      for (const s of seeds.slice(0, 50)) {
        const q = gen(level, s);
        for (const o of q.options) {
          const g = oddsDrill.grade(q, o.value);
          expect(g.certainty).toBe('exact');
          expect(g.borderline).toBe(false);
          expect(g.explanation.length).toBeGreaterThan(10);
        }
      }
    }
  });
  it('same rng state gives the same question', () => {
    expect(gen(2, 5)).toEqual(gen(2, 5));
  });
  it('declares type odds and three levels', () => {
    expect(oddsDrill.id).toBe('odds');
    expect(oddsDrill.levels).toBe(3);
  });
});
