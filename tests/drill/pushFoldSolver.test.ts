import { solvePushFold } from '../../src/drill/pushFoldSolver';

const strengths = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
const weights = [6, 4, 12, 6, 4, 12];
const equity = strengths.map((si, i) =>
  strengths.map((sj, j) => (i === j ? 0.5 : 0.5 + 0.25 * (si - sj))),
);
const solve = (stack: number) => solvePushFold({ equity, weights, stack });

describe('solvePushFold on a synthetic ordered matrix', () => {
  it('a class pushes exactly when its push EV beats folding (-0.5)', () => {
    for (const stack of [2, 5, 10, 15]) {
      const r = solve(stack);
      r.push.forEach((p, i) => expect(p).toBe(r.evPush[i] > -0.5));
    }
  });
  it('a class calls exactly when its call EV beats folding (-1)', () => {
    for (const stack of [2, 5, 10, 15]) {
      const r = solve(stack);
      r.call.forEach((c, j) => expect(c).toBe(r.evCall[j] > -1));
    }
  });
  it('push and call sets are upward closed in strength', () => {
    for (const stack of [2, 4, 8, 12, 15]) {
      const r = solve(stack);
      for (let i = 0; i < 6; i++)
        for (let k = i + 1; k < 6; k++) {
          if (r.push[i]) expect(r.push[k]).toBe(true);
          if (r.call[i]) expect(r.call[k]).toBe(true);
        }
    }
  });
  it('a large stack pushes strictly fewer classes than a small one', () => {
    const count = (stack: number) => solve(stack).push.filter(Boolean).length;
    expect(count(100)).toBeLessThan(count(2));
  });
  it('at a very short stack (1.5bb) every class pushes', () => {
    expect(solve(1.5).push.every(Boolean)).toBe(true);
  });
  it('the result is stable: running twice as long gives the same push and call sets', () => {
    for (const stack of [3, 8, 15]) {
      const a = solvePushFold({ equity, weights, stack }, 4000);
      const b = solvePushFold({ equity, weights, stack }, 8000);
      expect(b.push).toEqual(a.push);
      expect(b.call).toEqual(a.call);
    }
  });
  it('produces no NaN or Infinity', () => {
    for (const stack of [2, 7, 15, 100]) {
      const r = solve(stack);
      for (const v of [...r.evPush, ...r.evCall]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('solvePushFold hand-computed case', () => {
  it('two classes at 10bb match the EV formulas', () => {
    const r = solvePushFold({ equity: [[0.5, 0.7], [0.3, 0.5]], weights: [1, 1], stack: 10 });
    expect(r.push).toEqual([true, false]);
    expect(r.call).toEqual([true, false]);
    expect(r.evPush[0]).toBeCloseTo(0.5, 2);
    expect(r.evPush[1]).toBeCloseTo(-1.5, 2);
    expect(r.evCall[0]).toBeCloseTo(0, 2);
    expect(r.evCall[1]).toBeCloseTo(-4, 2);
  });
  it('a matrix with an overwhelming favourite gives finite EVs and the favourite always pushes', () => {
    const r = solvePushFold({ equity: [[0.5, 0.01], [0.99, 0.5]], weights: [1, 1], stack: 15 });
    expect(r.push[1]).toBe(true);
    for (const v of [...r.evPush, ...r.evCall]) expect(Number.isFinite(v)).toBe(true);
  });
});
