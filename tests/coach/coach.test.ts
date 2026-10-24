import { potOdds } from '../../src/coach/potOdds';
import { equity } from '../../src/coach/equity';
import { preflopAdvice } from '../../src/coach/preflopChart';
import { hint } from '../../src/coach/hint';
import { reviewHand } from '../../src/coach/review';
import { parseCard } from '../../src/engine/cards';
import { mulberry32 } from '../../src/engine/deck';
import { createHand, playerView } from '../../src/engine/hand';
import { chenScore } from '../../src/engine/handClass';
import type { HandLog } from '../../src/engine/handLog';

const hc = (s: string) => s.split(' ').map(parseCard);

describe('potOdds', () => {
  it('potOdds(50, 150) is 0.25', () => {
    expect(potOdds(50, 150)).toBe(0.25);
  });
  it('is 0 when nothing to call', () => {
    expect(potOdds(0, 100)).toBe(0);
  });
});

describe('equity', () => {
  it('AA vs 1 random opponent is about 0.85', () => {
    const e = equity(hc('As Ad'), [], 1, 20000, mulberry32(1));
    expect(e).toBeGreaterThan(0.82);
    expect(e).toBeLessThan(0.88);
  });
  it('is deterministic for a fixed seed', () => {
    const a = equity(hc('As Kd'), hc('2c 7d 9h'), 2, 2000, mulberry32(5));
    const b = equity(hc('As Kd'), hc('2c 7d 9h'), 2, 2000, mulberry32(5));
    expect(a).toBe(b);
  });
  it('a made nut flush on the river against one opponent is near 1', () => {
    const e = equity(hc('As Ks'), hc('2s 7s 9s Jd 3c'), 1, 2000, mulberry32(2));
    expect(e).toBeGreaterThan(0.95);
  });
});

describe('preflopAdvice and hint', () => {
  it('72o from UTG is a fold', () => {
    expect(preflopAdvice(hc('7c 2d'), 'EP', 'none')).toBe('fold');
  });
  it('AA from UTG raises, and facing a raise still raises', () => {
    expect(preflopAdvice(hc('As Ad'), 'EP', 'none')).toBe('raise');
    expect(preflopAdvice(hc('As Ad'), 'EP', 'raise')).toBe('raise');
  });
  it('hint text for 72o UTG says fold', () => {
    const s = createHand({ seed: 3, seats: Array.from({ length: 6 }, (_, id) => ({ id, stack: 200 })), buttonSeat: 0, smallBlind: 1, bigBlind: 2 });
    const v = { ...playerView(s, 3), hole: hc('7c 2d') };
    const h = hint(v, v.legal!, 0.3);
    expect(h.preflop).toBe('fold');
    expect(h.text.toLowerCase()).toContain('fold');
  });
  it('hint reports pot odds when facing a bet', () => {
    const s = createHand({ seed: 3, seats: Array.from({ length: 6 }, (_, id) => ({ id, stack: 200 })), buttonSeat: 0, smallBlind: 1, bigBlind: 2 });
    const v = playerView(s, 3);
    const h = hint(v, v.legal!, 0.5);
    expect(h.potOdds).toBeCloseTo(2 / (3 + 2), 5);
  });
});

function findSeed(pred: (hole: ReturnType<typeof hc>) => boolean): number {
  for (let seed = 1; seed < 100000; seed++) {
    const s = createHand({ seed, seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], buttonSeat: 0, smallBlind: 10, bigBlind: 20 });
    if (pred(s.seats[1].hole)) return seed;
  }
  throw new Error('no seed found');
}
const baseLog = (seed: number, actions: HandLog['actions']): HandLog => ({
  id: 'x', seed, mode: 'cash', seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], button: 0,
  blinds: { sb: 10, bb: 20 }, actions, humanSeat: 1, usedHint: false, netBb: 0, timestamp: 0,
});

describe('reviewHand', () => {
  it('flags a call with equity below pot odds', () => {
    const seed = findSeed((h) => chenScore(h) <= 0 && h[0].rank !== h[1].rank);
    const log = baseLog(seed, [{ seat: 0, action: { type: 'raise', amount: 200 } }, { seat: 1, action: { type: 'call' } }]);
    const items = reviewHand(log);
    expect(items).toHaveLength(1);
    expect(items[0].flag).toBe('questionable');
    expect(items[0].reason).toMatch(/odds/i);
  });
  it('flags a fold with equity well above pot odds', () => {
    const seed = findSeed((h) => h[0].rank === 14 && h[1].rank === 14);
    const log = baseLog(seed, [{ seat: 0, action: { type: 'raise', amount: 60 } }, { seat: 1, action: { type: 'fold' } }]);
    const items = reviewHand(log);
    expect(items[0].flag).toBe('questionable');
    expect(items[0].equity).toBeGreaterThan(0.7);
  });
  it('produces one item per human action and none for bot actions', () => {
    const seed = findSeed(() => true);
    const log = baseLog(seed, [
      { seat: 0, action: { type: 'call' } },
      { seat: 1, action: { type: 'check' } },
      { seat: 1, action: { type: 'check' } },
      { seat: 0, action: { type: 'check' } },
    ]);
    const items = reviewHand(log);
    expect(items.map((i) => i.seat)).toEqual([1, 1]);
    expect(items.map((i) => i.step)).toEqual([1, 2]);
  });
});
