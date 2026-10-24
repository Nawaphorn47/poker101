import { buildSet } from '../../src/drill/runner';
import { mulberry32 } from '../../src/engine/deck';
import type { DrillModule, Question } from '../../src/drill/types';

/** generates key A or B with equal probability */
const fake: DrillModule = {
  id: 'odds',
  levels: 1,
  generate(rng, level): Question {
    const key = rng() < 0.5 ? 'A' : 'B';
    return { type: 'odds', level, key, prompt: key, options: [], scenario: null };
  },
  grade: () => ({ correct: true, borderline: false, explanation: '', certainty: 'exact' }),
};

const shareOfA = (misses: Map<string, number>, seed: number) => {
  const set = buildSet(fake, 1, misses, mulberry32(seed), 2000);
  return set.filter((q) => q.key === 'A').length / set.length;
};

describe('buildSet', () => {
  it('returns exactly 10 questions by default with no history', () => {
    expect(buildSet(fake, 1, new Map(), mulberry32(1))).toHaveLength(10);
  });
  it('returns 10 questions when every key in history has miss rate 1', () => {
    const misses = new Map([['A', 1], ['B', 1]]);
    expect(buildSet(fake, 1, misses, mulberry32(2))).toHaveLength(10);
  });
  it('honours a custom size', () => {
    expect(buildSet(fake, 1, new Map(), mulberry32(3), 4)).toHaveLength(4);
  });
  it('without history both keys come up about equally', () => {
    const share = shareOfA(new Map(), 7);
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
  it('a missed key is picked clearly more often', () => {
    expect(shareOfA(new Map([['A', 1]]), 7)).toBeGreaterThan(0.65);
  });
  it('a never-missed key keeps the baseline weight', () => {
    const share = shareOfA(new Map([['A', 0]]), 7);
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
  it('the same seed gives the same set', () => {
    const a = buildSet(fake, 1, new Map([['A', 0.5]]), mulberry32(11));
    const b = buildSet(fake, 1, new Map([['A', 0.5]]), mulberry32(11));
    expect(a).toEqual(b);
  });
});
