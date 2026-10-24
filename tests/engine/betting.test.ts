import { legalActions, applyBet, isRoundComplete } from '../../src/engine/betting';
import type { BettingRound, SeatState } from '../../src/engine/types';

const seat = (id: number, stack: number, committed = 0, extra: Partial<SeatState> = {}): SeatState => ({
  id, stack, committed, totalCommitted: committed, hole: [], folded: false, allIn: false,
  acted: false, raiseLocked: false, ...extra,
});
const round = (seats: SeatState[], currentBet = 0, toAct = 0, lastRaiseSize = 20): BettingRound => ({
  currentBet, lastRaiseSize, toAct, seats, bigBlind: 20,
});
const ok = (r: ReturnType<typeof applyBet>) => {
  if (!r.ok) throw new Error(r.error);
  return r.round;
};

describe('legalActions', () => {
  it('min raise equals current bet plus last raise size', () => {
    const r = round([seat(0, 1000), seat(1, 1000, 60)], 60, 0, 40);
    expect(legalActions(r, 0).minRaiseTo).toBe(100);
  });
  it('postflop bet minimum is the big blind', () => {
    const r = round([seat(0, 1000), seat(1, 1000)], 0, 0, 20);
    const l = legalActions(r, 0);
    expect(l.canCheck).toBe(true);
    expect(l.minRaiseTo).toBe(20);
  });
  it('call amount capped at stack', () => {
    const r = round([seat(0, 30), seat(1, 1000, 100)], 100, 0, 100);
    const l = legalActions(r, 0);
    expect(l.callAmount).toBe(30);
    expect(l.canRaise).toBe(false);
  });
  it('check illegal when facing a bet', () => {
    const r = round([seat(0, 1000), seat(1, 1000, 50)], 50, 0, 50);
    expect(legalActions(r, 0).canCheck).toBe(false);
    expect(applyBet(r, 0, { type: 'check' }).ok).toBe(false);
  });
});

describe('applyBet', () => {
  it('raise below min and not all-in returns error, round unchanged', () => {
    const r = round([seat(0, 1000), seat(1, 1000, 60)], 60, 0, 40);
    const res = applyBet(r, 0, { type: 'raise', amount: 80 });
    expect(res.ok).toBe(false);
    expect(r.seats[0].stack).toBe(1000);
  });
  it('call all-in for less marks seat all-in', () => {
    const r = round([seat(0, 30), seat(1, 1000, 100)], 100, 0, 100);
    const next = ok(applyBet(r, 0, { type: 'call' }));
    expect(next.seats[0].allIn).toBe(true);
    expect(next.seats[0].stack).toBe(0);
  });
  it('short all-in raise does not reopen raising for players who already acted', () => {
    let r = round([seat(0, 1000), seat(1, 1000), seat(2, 130)], 0, 0, 20);
    r = ok(applyBet(r, 0, { type: 'bet', amount: 100 }));
    r = ok(applyBet(r, 1, { type: 'call' }));
    r = ok(applyBet(r, 2, { type: 'raise', amount: 130 }));
    expect(r.currentBet).toBe(130);
    expect(r.toAct).toBe(0);
    expect(legalActions(r, 0).canRaise).toBe(false);
    expect(legalActions(r, 0).callAmount).toBe(30);
  });
  it('full all-in raise reopens raising', () => {
    let r = round([seat(0, 1000), seat(1, 1000), seat(2, 300)], 0, 0, 20);
    r = ok(applyBet(r, 0, { type: 'bet', amount: 100 }));
    r = ok(applyBet(r, 1, { type: 'call' }));
    r = ok(applyBet(r, 2, { type: 'raise', amount: 300 }));
    expect(legalActions(r, 0).canRaise).toBe(true);
    expect(r.lastRaiseSize).toBe(200);
  });
  it('raise amount beyond stack is an error', () => {
    const r = round([seat(0, 100), seat(1, 100)], 0, 0, 20);
    expect(applyBet(r, 0, { type: 'bet', amount: 500 }).ok).toBe(false);
  });
  it('acting out of turn is an error', () => {
    const r = round([seat(0, 100), seat(1, 100)], 0, 0, 20);
    expect(applyBet(r, 1, { type: 'check' }).ok).toBe(false);
  });
});

describe('isRoundComplete', () => {
  it('complete when all live players matched and acted', () => {
    let r = round([seat(0, 1000), seat(1, 1000)], 0, 0, 20);
    expect(isRoundComplete(r)).toBe(false);
    r = ok(applyBet(r, 0, { type: 'check' }));
    expect(isRoundComplete(r)).toBe(false);
    r = ok(applyBet(r, 1, { type: 'check' }));
    expect(isRoundComplete(r)).toBe(true);
  });
  it('complete when everyone else folded', () => {
    let r = round([seat(0, 1000), seat(1, 1000, 20)], 20, 0, 20);
    r = ok(applyBet(r, 0, { type: 'fold' }));
    expect(isRoundComplete(r)).toBe(true);
  });
  it('complete when only one player can act and has matched all-in bets', () => {
    const r = round([seat(0, 900, 100), seat(1, 0, 100, { allIn: true })], 100, 0, 100);
    expect(isRoundComplete(r)).toBe(true);
  });
});
