import { buildPots, distribute } from '../../src/engine/pots';
import type { HandScore } from '../../src/engine/handEvaluator';

const s = (category: number, ...tb: number[]): HandScore => ({ category, tiebreak: tb });
const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('buildPots', () => {
  it('three all-ins of 50/100/200 give 150, 100, 100 pots', () => {
    const pots = buildPots([
      { seat: 0, amount: 50, folded: false },
      { seat: 1, amount: 100, folded: false },
      { seat: 2, amount: 200, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
      { amount: 100, eligible: [2] },
    ]);
  });
  it('folded contributor is not eligible but chips remain', () => {
    const pots = buildPots([
      { seat: 0, amount: 100, folded: true },
      { seat: 1, amount: 100, folded: false },
      { seat: 2, amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 300, eligible: [1, 2] }]);
  });
});

describe('distribute', () => {
  it('two-way tie splits evenly', () => {
    const w = distribute([{ amount: 100, eligible: [0, 1] }], new Map([[0, s(1, 5)], [1, s(1, 5)]]), 0, 6);
    expect(w.get(0)).toBe(50);
    expect(w.get(1)).toBe(50);
  });
  it('odd chip goes to first winner clockwise from the button', () => {
    const scores = new Map([[2, s(1, 5)], [4, s(1, 5)]]);
    const w = distribute([{ amount: 101, eligible: [2, 4] }], scores, 3, 6);
    expect(w.get(4)).toBe(51);
    expect(w.get(2)).toBe(50);
  });
  it('side pot goes to best eligible hand, not best overall', () => {
    const pots = [
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
    ];
    const scores = new Map([[0, s(8, 9)], [1, s(2, 5, 4, 3)], [2, s(1, 5)]]);
    const w = distribute(pots, scores, 0, 3);
    expect(w.get(0)).toBe(150);
    expect(w.get(1)).toBe(100);
  });
  it('sum of payouts equals sum of contributions', () => {
    const contribs = [
      { seat: 0, amount: 30, folded: false },
      { seat: 1, amount: 80, folded: false },
      { seat: 2, amount: 80, folded: true },
      { seat: 3, amount: 80, folded: false },
    ];
    const scores = new Map([[0, s(3, 2)], [1, s(2, 9, 8, 7)], [3, s(2, 9, 8, 7)]]);
    const w = distribute(buildPots(contribs), scores, 0, 4);
    expect(sum(w)).toBe(270);
  });
});
