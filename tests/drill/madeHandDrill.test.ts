import { madeHandDrill } from '../../src/drill/modules/madeHandDrill';
import { evaluate, compareScores } from '../../src/engine/handEvaluator';
import { cardToString, type Card } from '../../src/engine/cards';
import { mulberry32 } from '../../src/engine/deck';

type L1 = { hole: Card[]; board: Card[] };
type L2 = { hole: Card[]; villain: Card[]; board: Card[] };
const gen = (level: number, seed: number) => madeHandDrill.generate(mulberry32(seed), level);
const distinct = (cards: Card[]) => new Set(cards.map(cardToString)).size === cards.length;

describe('madehand level 1: name the hand', () => {
  it('the correct option equals the evaluator category, with four distinct options', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = gen(1, seed);
      const sc = q.scenario as L1;
      const category = evaluate([...sc.hole, ...sc.board]).category;
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.value)).size).toBe(4);
      const right = q.options.filter((o) => madeHandDrill.grade(q, o.value).correct);
      expect(right.map((o) => o.value)).toEqual([String(category)]);
    }
  });
  it('boards have 3, 4 or 5 cards and every card is distinct', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const sc = gen(1, seed).scenario as L1;
      sizes.add(sc.board.length);
      expect(sc.hole).toHaveLength(2);
      expect(distinct([...sc.hole, ...sc.board])).toBe(true);
    }
    expect([...sizes].sort()).toEqual([3, 4, 5]);
  });
  it('made hands appear often enough to be worth drilling', () => {
    const seen = new Map<number, number>();
    for (let seed = 1; seed <= 2000; seed++) {
      const sc = gen(1, seed).scenario as L1;
      const c = evaluate([...sc.hole, ...sc.board]).category;
      seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    expect((seen.get(0) ?? 0) / 2000).toBeLessThan(0.6);
  });
  it('the key names the street', () => {
    const keys = new Set(Array.from({ length: 200 }, (_, i) => gen(1, i + 1).key));
    for (const k of keys) expect(k).toMatch(/^madehand:L1:(flop|turn|river)$/);
    expect(keys.size).toBe(3);
  });
});

describe('madehand level 2: who wins', () => {
  it('grading agrees with compareScores for every option', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = gen(2, seed);
      const sc = q.scenario as L2;
      const cmp = compareScores(evaluate([...sc.hole, ...sc.board]), evaluate([...sc.villain, ...sc.board]));
      const expected = cmp > 0 ? 'hero' : cmp < 0 ? 'villain' : 'split';
      for (const o of q.options) expect(madeHandDrill.grade(q, o.value).correct).toBe(o.value === expected);
      expect(q.options.map((o) => o.value)).toEqual(['hero', 'villain', 'split']);
    }
  });
  it('hero, villain and split outcomes all occur', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 2000; seed++) {
      const q = gen(2, seed);
      const sc = q.scenario as L2;
      const cmp = compareScores(evaluate([...sc.hole, ...sc.board]), evaluate([...sc.villain, ...sc.board]));
      outcomes.add(cmp > 0 ? 'hero' : cmp < 0 ? 'villain' : 'split');
    }
    expect(outcomes).toEqual(new Set(['hero', 'villain', 'split']));
  });
  it('hero, villain and board cards are all distinct and the board is complete', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const sc = gen(2, seed).scenario as L2;
      expect(sc.board).toHaveLength(5);
      expect(distinct([...sc.hole, ...sc.villain, ...sc.board])).toBe(true);
    }
  });
});

describe('madehand grades', () => {
  it('are exact, never borderline, and carry no ev', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 50; seed++) {
        const q = gen(level, seed);
        for (const o of q.options) {
          const g = madeHandDrill.grade(q, o.value);
          expect(g.certainty).toBe('exact');
          expect(g.borderline).toBe(false);
          expect(g.ev).toBeUndefined();
          expect(g.explanation.length).toBeGreaterThan(10);
        }
      }
    }
  });
  it('declares its id and two levels, and the same seed gives the same question', () => {
    expect(madeHandDrill.id).toBe('madehand');
    expect(madeHandDrill.levels).toBe(2);
    expect(gen(1, 5)).toEqual(gen(1, 5));
    expect(gen(2, 5)).toEqual(gen(2, 5));
  });
});
