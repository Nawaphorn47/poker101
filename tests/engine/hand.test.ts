import { createHand, apply, legalFor, playerView, finalStacks, checkInvariants } from '../../src/engine/hand';
import type { HandState } from '../../src/engine/hand';
import type { Action } from '../../src/engine/types';
import { parseCard, cardToString, type Card } from '../../src/engine/cards';
import { shuffledDeck } from '../../src/engine/deck';

const deckWith = (prefix: string): Card[] => {
  const pre = prefix.split(' ').map(parseCard);
  const used = new Set(pre.map(cardToString));
  return [...pre, ...shuffledDeck(1).filter((c) => !used.has(cardToString(c)))];
};
const cfg = (n: number, stack = 1000, extra = {}) => ({
  seed: 1, buttonSeat: 0, smallBlind: 10, bigBlind: 20,
  seats: Array.from({ length: n }, (_, id) => ({ id, stack })), ...extra,
});
const run = (s: HandState, acts: Action[]) => {
  for (const a of acts) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
};
const check = { type: 'check' } as const;
const call = { type: 'call' } as const;
const fold = { type: 'fold' } as const;

describe('createHand', () => {
  it('blinds posted and UTG acts first at 6 players', () => {
    const s = createHand(cfg(6));
    expect(s.seats[1].committed).toBe(10);
    expect(s.seats[2].committed).toBe(20);
    expect(s.round.toAct).toBe(3);
    expect(s.seats.every((x) => x.hole.length === 2)).toBe(true);
  });
  it('heads-up: button is small blind and acts first preflop', () => {
    const s = createHand(cfg(2));
    expect(s.seats[0].committed).toBe(10);
    expect(s.seats[1].committed).toBe(20);
    expect(s.round.toAct).toBe(0);
  });
  it('short stack posts partial blind and is all-in', () => {
    const c = cfg(3);
    c.seats[2].stack = 5;
    const s = createHand(c);
    expect(s.seats[2].committed).toBe(5);
    expect(s.seats[2].allIn).toBe(true);
    expect(s.round.currentBet).toBe(20);
  });
});

describe('playing a hand', () => {
  it('all fold to one player: wins uncontested, no showdown', () => {
    const s = run(createHand(cfg(3)), [fold, fold]);
    expect(s.street).toBe('done');
    expect(s.result!.showdown).toBe(false);
    expect([...finalStacks(s)]).toEqual([[0, 1000], [1, 990], [2, 1010]]);
  });
  it('check-down reaches showdown and awards best hand', () => {
    const s0 = createHand(cfg(2, 1000, { deck: deckWith('As Ad Ks Kd 2c 7d 9h Jc 3s') }));
    const s = run(s0, [call, check, check, check, check, check, check, check]);
    expect(s.street).toBe('done');
    expect(s.result!.showdown).toBe(true);
    expect(finalStacks(s).get(0)).toBe(1020);
    expect(finalStacks(s).get(1)).toBe(980);
  });
  it('all-in preflop deals remaining board with no betting', () => {
    const s = run(createHand(cfg(2)), [{ type: 'raise', amount: 1000 }, call]);
    expect(s.street).toBe('done');
    expect(s.board).toHaveLength(5);
    const total = [...finalStacks(s).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(2000);
  });
  it('total chips before equals total chips after', () => {
    const s = run(createHand(cfg(4)), [{ type: 'raise', amount: 100 }, call, fold, call, check, check, check, check, check, check, check, check, check]);
    expect(checkInvariants(s)).toBeNull();
    const total = [...finalStacks(s).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(4000);
  });
  it('same config and actions replay to identical result', () => {
    const acts = [call, check, check, check, check, check, check, check];
    const a = run(createHand(cfg(2)), acts);
    const b = run(createHand(cfg(2)), acts);
    expect(a.result).toEqual(b.result);
    expect(a.board).toEqual(b.board);
  });
  it('illegal action returns error and leaves state unchanged', () => {
    const s = createHand(cfg(3));
    const r = apply(s, check);
    expect(r.ok).toBe(false);
    expect(legalFor(s).callAmount).toBe(20);
  });
});

describe('playerView', () => {
  it("hides other seats' hole cards", () => {
    const s = createHand(cfg(3));
    const v = playerView(s, 1);
    expect(v.hole).toEqual(s.seats[1].hole);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.seats[0].hole));
    expect(v.seats[0]).not.toHaveProperty('hole');
    expect(v.position).toBe('SB');
  });
});
