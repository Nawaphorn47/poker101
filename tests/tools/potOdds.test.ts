import { potOddsReport } from '../../src/tools/potOdds';
import { evCall, nextCardEquity, outsEquity, requiredEquity } from '../../src/drill/oddsMath';
import { mulberry32 } from '../../src/engine/deck';

type Ok = Extract<ReturnType<typeof potOddsReport>, { ok: true }>;
const ok = (r: ReturnType<typeof potOddsReport>): Ok => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('potOddsReport', () => {
  it('flop, 9 outs, pot 100, bet 100: fold on the next card, call by the river, and says they disagree', () => {
    const r = ok(potOddsReport({ potBefore: 100, bet: 100, outs: 9, street: 'flop' }));
    expect(r.potAfter).toBe(200);
    expect(r.requiredEquity).toBeCloseTo(1 / 3, 4);
    expect(r.nextCard!.equity).toBeCloseTo(9 / 47, 10);
    expect(r.nextCard!.ev).toBeCloseTo((9 / 47) * 200 - (1 - 9 / 47) * 100, 6);
    expect(r.byRiver!.equity).toBeCloseTo(0.3497, 3);
    expect(r.byRiver!.ev).toBeGreaterThan(0);
    expect(r.verdict).toBe('fold');
    expect(r.disagreement).toBe(true);
  });
  it('turn, 9 outs, pot 100, bet 25: call, no by-river figure', () => {
    const r = ok(potOddsReport({ potBefore: 100, bet: 25, outs: 9, street: 'turn' }));
    expect(r.requiredEquity).toBeCloseTo(25 / 150, 6);
    expect(r.nextCard!.equity).toBeCloseTo(9 / 46, 10);
    expect(r.byRiver).toBeUndefined();
    expect(r.verdict).toBe('call');
    expect(r.disagreement).toBe(false);
  });
  it('river gives the required equity only and no verdict', () => {
    const r = ok(potOddsReport({ potBefore: 100, bet: 50, outs: 5, street: 'river' }));
    expect(r.requiredEquity).toBeCloseTo(50 / 200, 6);
    expect(r.nextCard).toBeUndefined();
    expect(r.byRiver).toBeUndefined();
    expect(r.verdict).toBeNull();
    expect(r.disagreement).toBe(false);
  });
  it('0 outs gives equity 0 and a fold', () => {
    const r = ok(potOddsReport({ potBefore: 100, bet: 50, outs: 0, street: 'flop' }));
    expect(r.nextCard!.equity).toBe(0);
    expect(r.byRiver!.equity).toBe(0);
    expect(r.verdict).toBe('fold');
  });
  it('a pot of 0 before the bet needs exactly 50%', () => {
    expect(ok(potOddsReport({ potBefore: 0, bet: 40, outs: 3, street: 'turn' })).requiredEquity).toBeCloseTo(0.5, 10);
  });
  it('rejects a bet of 0, a negative pot, fractional outs and outs above 20', () => {
    const bad = [
      { potBefore: 100, bet: 0, outs: 4, street: 'flop' as const },
      { potBefore: -1, bet: 10, outs: 4, street: 'flop' as const },
      { potBefore: 100, bet: 10, outs: 1.5, street: 'flop' as const },
      { potBefore: 100, bet: 10, outs: 21, street: 'flop' as const },
      { potBefore: NaN, bet: 10, outs: 4, street: 'flop' as const },
    ];
    for (const input of bad) {
      const r = potOddsReport(input);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.error.length > 0).toBe(true);
    }
  });
  it('agrees with drill/oddsMath for 200 random inputs', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const potBefore = Math.floor(rng() * 500);
      const bet = 1 + Math.floor(rng() * 300);
      const outs = Math.floor(rng() * 21);
      const street = rng() < 0.5 ? 'flop' : 'turn';
      const r = ok(potOddsReport({ potBefore, bet, outs, street }));
      const after = potBefore + bet;
      expect(r.requiredEquity).toBeCloseTo(requiredEquity(bet, after), 10);
      expect(r.nextCard!.ev).toBeCloseTo(evCall(nextCardEquity(outs, street), after, bet), 8);
      if (street === 'flop') expect(r.byRiver!.equity).toBeCloseTo(outsEquity(outs, 'flop'), 10);
    }
  });
});
