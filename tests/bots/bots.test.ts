import { preflopRange } from '../../src/bots/ranges';
import { decide, type BotStyle } from '../../src/bots/decide';
import { createHand, apply, playerView, type HandState } from '../../src/engine/hand';
import { parseCard, cardToString, type Card } from '../../src/engine/cards';
import { shuffledDeck, mulberry32 } from '../../src/engine/deck';
import type { Position } from '../../src/engine/hand';

const STYLES: BotStyle[] = ['tight', 'loose', 'aggressive'];
const POSITIONS: Position[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];

const deckWith = (prefix: string): Card[] => {
  const pre = prefix.split(' ').map(parseCard);
  const used = new Set(pre.map(cardToString));
  return [...pre, ...shuffledDeck(1).filter((c) => !used.has(cardToString(c)))];
};

function simulate(styles: BotStyle[], hands: number, seed: number) {
  const rng = mulberry32(seed);
  let decisions = 0;
  let vpip = 0;
  let opportunities = 0;
  for (let h = 0; h < hands; h++) {
    const n = styles.length;
    let s: HandState = createHand({
      seed: seed * 100000 + h,
      seats: Array.from({ length: n }, (_, id) => ({ id, stack: 200 })),
      buttonSeat: h % n, smallBlind: 1, bigBlind: 2,
    });
    const voluntary = new Set<number>();
    while (s.street !== 'done') {
      const seat = s.round.toAct;
      const action = decide(playerView(s, seat), styles[seat], rng);
      if (s.street === 'preflop' && (action.type === 'call' || action.type === 'raise')) voluntary.add(seat);
      const r = apply(s, action);
      if (!r.ok) throw new Error(`bot (${styles[seat]}) made illegal action ${JSON.stringify(action)}: ${r.error}`);
      s = r.state;
      decisions++;
    }
    vpip += voluntary.size;
    opportunities += n;
  }
  return { decisions, vpip: vpip / opportunities };
}

describe('preflop ranges', () => {
  it('tight range is a strict subset of loose range for every position', () => {
    for (const pos of POSITIONS) {
      const tight = preflopRange('tight', pos);
      const loose = preflopRange('loose', pos);
      expect(tight.size).toBeLessThan(loose.size);
      for (const c of tight) expect(loose.has(c)).toBe(true);
    }
  });
  it('later positions play at least as many hands as earlier ones', () => {
    expect(preflopRange('tight', 'BTN').size).toBeGreaterThanOrEqual(preflopRange('tight', 'EP').size);
  });
});

describe('decide', () => {
  it.each(STYLES)('%s bot makes only legal actions over 3000+ decisions', (style) => {
    const { decisions } = simulate(Array(6).fill(style), 1000, 7);
    expect(decisions).toBeGreaterThan(3000);
  });
  it.each(STYLES)('%s bot folds 72o from UTG and raises AA', (style) => {
    // 6 players, button 0: UTG is seat 3; seats 0..2 hold the first 6 cards
    const weak = createHand({ seed: 1, seats: Array.from({ length: 6 }, (_, id) => ({ id, stack: 200 })), buttonSeat: 0, smallBlind: 1, bigBlind: 2, deck: deckWith('2h 3h 4h 5h 6h 8h 7c 2d') });
    expect(decide(playerView(weak, 3), style, () => 0.5).type).toBe('fold');
    const strong = createHand({ seed: 1, seats: Array.from({ length: 6 }, (_, id) => ({ id, stack: 200 })), buttonSeat: 0, smallBlind: 1, bigBlind: 2, deck: deckWith('2h 3h 4h 5h 6h 8h As Ad') });
    expect(decide(playerView(strong, 3), style, () => 0.5).type).toBe('raise');
  });
  it('tight VPIP is lower than loose VPIP over 2000 simulated hands', () => {
    const tight = simulate(Array(6).fill('tight'), 2000, 11).vpip;
    const loose = simulate(Array(6).fill('loose'), 2000, 11).vpip;
    expect(tight).toBeLessThan(loose);
  });
});
