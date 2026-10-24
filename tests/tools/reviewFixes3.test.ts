import { icmEquities } from '../../src/tools/icm';
import { potOddsReport } from '../../src/tools/potOdds';
import { startEquity } from '../../src/tools/equityRunner';
import { parseCard } from '../../src/engine/cards';
import type { EquityResult } from '../../src/tools/equity';

describe('review fix: ICM refuses stacks it cannot compute honestly', () => {
  it('stacks 1e16 to 1 are rejected instead of printing NaN', () => {
    const r = icmEquities([1e16, 1], [60, 40]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/too much|too large/i);
  });
  it('stacks of 1e308 are rejected instead of returning zeros', () => {
    expect(icmEquities([1e308, 1e308], [60, 40]).ok).toBe(false);
  });
  it('a 1,000,000 to 1 spread still computes', () => {
    expect(icmEquities([1_000_000, 1], [60, 40]).ok).toBe(true);
  });
});

describe('review fix: pot odds refuses numbers that overflow', () => {
  it('pot and bet of 1e308 return an error, not Infinity', () => {
    const r = potOddsReport({ potBefore: 1e308, bet: 1e308, outs: 9, street: 'flop' });
    expect(r.ok).toBe(false);
  });
  it('large but sane numbers still work', () => {
    expect(potOddsReport({ potBefore: 1e9, bet: 5e8, outs: 9, street: 'turn' }).ok).toBe(true);
  });
});

describe('review fix: the main-thread fallback works in small slices', () => {
  it('a preflop run with the default chunk delivers many small updates', async () => {
    const hands = ['As Ah', 'Ks Kh'].map((h) => h.split(' ').map(parseCard));
    const updates: { r: EquityResult; done: boolean }[] = await new Promise((resolve) => {
      const seen: { r: EquityResult; done: boolean }[] = [];
      startEquity({ hands, board: [] }, (r, done) => {
        seen.push({ r, done });
        if (done) resolve(seen);
      }, { useWorker: false, cap: 40000 });
    });
    // half the cap (20,000 samples) in slices of at most 5,000
    expect(updates.length).toBeGreaterThanOrEqual(4);
    const last = updates[updates.length - 1].r;
    expect(last.ok && last.samples).toBe(20000);
  });
});
