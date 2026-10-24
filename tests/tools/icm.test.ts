import { icmEquities } from '../../src/tools/icm';

/** independent reference: enumerate every finishing order (feasible for up to 4 players) */
function bruteForce(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const values = new Array(n).fill(0);
  const total = stacks.reduce((a, b) => a + b, 0);
  const walk = (order: number[], prob: number, remaining: number) => {
    if (order.length === n) {
      order.forEach((player, place) => (values[player] += prob * (payouts[place] ?? 0)));
      return;
    }
    for (let i = 0; i < n; i++) {
      if (order.includes(i)) continue;
      walk([...order, i], prob * (stacks[i] / remaining), remaining - stacks[i]);
    }
  };
  walk([], 1, total);
  return values;
}

const values = (stacks: number[], payouts: number[]) => {
  const r = icmEquities(stacks, payouts);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('icmEquities', () => {
  it('3 players [50,30,20] with payouts [50,30,20] equals brute force', () => {
    const r = values([50, 30, 20], [50, 30, 20]);
    bruteForce([50, 30, 20], [50, 30, 20]).forEach((v, i) => expect(r.values[i]).toBeCloseTo(v, 9));
  });
  it('4 players with uneven stacks and 3 payouts equals brute force', () => {
    const stacks = [4000, 2500, 2500, 1000];
    const payouts = [500, 300, 200];
    const r = values(stacks, payouts);
    bruteForce(stacks, payouts).forEach((v, i) => expect(r.values[i]).toBeCloseTo(v, 9));
  });
  it('equal stacks give equal values', () => {
    const r = values([100, 100, 100, 100], [50, 30, 20]);
    for (const v of r.values) expect(v).toBeCloseTo(25, 9);
  });
  it('values sum to the total payouts and shares sum to 1', () => {
    const r = values([123, 77, 40, 9, 1], [60, 25, 10, 5]);
    expect(r.values.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    expect(r.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(r.chipShares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it('winner-take-all gives value proportional to stack', () => {
    const r = values([50, 30, 20], [100]);
    expect(r.values[0]).toBeCloseTo(50, 9);
    expect(r.values[1]).toBeCloseTo(30, 9);
    expect(r.values[2]).toBeCloseTo(20, 9);
  });
  it('the chip leader is worth less than its chip share and the short stack more', () => {
    const r = values([70, 20, 10], [50, 30, 20]);
    expect(r.shares[0]).toBeLessThan(r.chipShares[0]);
    expect(r.shares[2]).toBeGreaterThan(r.chipShares[2]);
  });
  it('stacks of 1,000,000 to 1 give finite values that sum to the pool', () => {
    const r = values([1_000_000, 1], [60, 40]);
    expect(r.values.every(Number.isFinite)).toBe(true);
    expect(r.values[0] + r.values[1]).toBeCloseTo(100, 9);
    expect(r.values[1]).toBeGreaterThan(40);
  });
  it('2 players with 2 payouts [60,40]', () => {
    const r = values([70, 30], [60, 40]);
    expect(r.values[0]).toBeCloseTo(0.7 * 60 + 0.3 * 40, 9);
    expect(r.values[1]).toBeCloseTo(0.3 * 60 + 0.7 * 40, 9);
  });
  it('payouts containing zeros [100,0,0]', () => {
    const r = values([60, 30, 10], [100, 0, 0]);
    expect(r.values[0]).toBeCloseTo(60, 9);
  });
  it('10 players with 5 payouts computes and sums to the pool', () => {
    const r = values([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], [40, 25, 15, 12, 8]);
    expect(r.values.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
  });
});

describe('icmEquities validation', () => {
  const cases: [string, number[], number[]][] = [
    ['1 player', [100], [100]],
    ['11 players', Array(11).fill(10), [100]],
    ['a stack of 0', [50, 0, 20], [50, 30]],
    ['a negative stack', [50, -5, 20], [50, 30]],
    ['a negative payout', [50, 30], [60, -10]],
    ['more payouts than players', [50, 30], [50, 30, 20]],
    ['6 payouts', Array(10).fill(10), [30, 20, 15, 10, 5, 5]],
    ['no payouts', [50, 30], []],
    ['a non-finite stack', [50, NaN], [100]],
  ];
  it.each(cases)('rejects %s', (_name, stacks, payouts) => {
    const r = icmEquities(stacks, payouts);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.length > 0).toBe(true);
  });
});
