import {
  createSimulation, enumerateEquity, samplesFor, validateEquityInput, type EquityInput,
} from '../../src/tools/equity';
import { parseCard, cardToString, type Card } from '../../src/engine/cards';
import { shuffledDeck, mulberry32 } from '../../src/engine/deck';
import { compareScores, evaluate } from '../../src/engine/handEvaluator';

const cards = (s: string): Card[] => (s.trim() === '' ? [] : s.trim().split(/\s+/).map(parseCard));
const input = (hands: string[], board = ''): EquityInput => ({ hands: hands.map(cards), board: cards(board) });

/** independent reference: enumerate completions of the board directly with the evaluator */
function reference(hands: Card[][], board: Card[]): number[] {
  const used = new Set([...hands.flat(), ...board].map(cardToString));
  const rest = shuffledDeck(0).filter((c) => !used.has(cardToString(c)));
  const need = 5 - board.length;
  const equity = new Array(hands.length).fill(0);
  let total = 0;
  const settle = (full: Card[]) => {
    const scores = hands.map((h) => evaluate([...h, ...full]));
    let best = scores[0];
    for (const s of scores) if (compareScores(s, best) > 0) best = s;
    const winners = scores.map((s, i) => (compareScores(s, best) === 0 ? i : -1)).filter((i) => i >= 0);
    for (const w of winners) equity[w] += 1 / winners.length;
    total++;
  };
  if (need === 0) settle(board);
  else if (need === 1) for (const a of rest) settle([...board, a]);
  else for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) settle([...board, rest[i], rest[j]]);
  return equity.map((e) => e / total);
}

const okResult = (r: ReturnType<typeof enumerateEquity>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('validateEquityInput', () => {
  it('accepts 2 players with no board and a 3, 4 or 5 card board', () => {
    expect(validateEquityInput(input(['As Ah', 'Ks Kh']))).toBeNull();
    expect(validateEquityInput(input(['As Ah', 'Ks Kh'], '2c 7d 9h'))).toBeNull();
    expect(validateEquityInput(input(['As Ah', 'Ks Kh'], '2c 7d 9h Jc'))).toBeNull();
    expect(validateEquityInput(input(['As Ah', 'Ks Kh'], '2c 7d 9h Jc 3s'))).toBeNull();
  });
  it.each([
    ['1 player', input(['As Ah'])],
    ['7 players', input(['As Ah', 'Ks Kh', 'Qs Qh', 'Js Jh', 'Ts Th', '9s 9h', '8s 8h'])],
    ['a hand with one card', input(['As', 'Ks Kh'])],
    ['a board of 1 card', input(['As Ah', 'Ks Kh'], '2c')],
    ['a board of 2 cards', input(['As Ah', 'Ks Kh'], '2c 7d')],
    ['a card repeated between two hands', input(['As Ah', 'As Kh'])],
    ['a card repeated between a hand and the board', input(['As Ah', 'Ks Kh'], '2c 7d Ah')],
    ['a card repeated on the board', input(['As Ah', 'Ks Kh'], '2c 2c 9h')],
  ])('rejects %s with a message', (_n, i) => {
    const msg = validateEquityInput(i);
    expect(typeof msg).toBe('string');
    expect(msg!.length).toBeGreaterThan(0);
  });
});

describe('enumerateEquity', () => {
  it('a full board where AA beats KK gives 1 and 0 and is exact', () => {
    const r = okResult(enumerateEquity(input(['As Ah', 'Ks Kh'], '2c 7d 9h Jc 3s')));
    expect(r.exact).toBe(true);
    expect(r.players[0].equity).toBe(1);
    expect(r.players[0].win).toBe(1);
    expect(r.players[1].equity).toBe(0);
  });
  it('a board that plays gives each of 3 players one third', () => {
    const r = okResult(enumerateEquity(input(['2c 2d', '3c 3d', '4c 4d'], 'As Ks Qs Js Ts')));
    for (const p of r.players) {
      expect(p.equity).toBeCloseTo(1 / 3, 12);
      expect(p.win).toBe(0);
      expect(p.tie).toBe(1);
    }
  });
  it('turn board equals an independent enumeration', () => {
    const hands = ['As Kd', 'Qh Qc', '9s 8s'];
    const r = okResult(enumerateEquity(input(hands, '2c 7d 9h Jc')));
    reference(hands.map(cards), cards('2c 7d 9h Jc')).forEach((e, i) => expect(r.players[i].equity).toBeCloseTo(e, 12));
  });
  it('flop board equals an independent two-card enumeration', () => {
    const hands = ['As Ah', 'Ks Qs'];
    const r = okResult(enumerateEquity(input(hands, '2s 7s 9h')));
    reference(hands.map(cards), cards('2s 7s 9h')).forEach((e, i) => expect(r.players[i].equity).toBeCloseTo(e, 12));
    expect(r.samples).toBe(990 - 0); // 52 - 4 - 3 = 45 unseen, C(45,2)
  });
  it('equities always sum to 1 and win <= equity <= win + tie', () => {
    const r = okResult(enumerateEquity(input(['As Kd', 'Qh Qc', '9s 8s', '7c 7d'], '2c 7h 9h')));
    expect(r.players.reduce((a, p) => a + p.equity, 0)).toBeCloseTo(1, 12);
    for (const p of r.players) {
      expect(p.equity).toBeGreaterThanOrEqual(p.win - 1e-12);
      expect(p.equity).toBeLessThanOrEqual(p.win + p.tie + 1e-12);
    }
  });
  it('rejects invalid input and boards of fewer than 3 cards', () => {
    expect(enumerateEquity(input(['As Ah', 'Ks Kh'], '2c 7d')).ok).toBe(false);
    expect(enumerateEquity(input(['As Ah', 'Ks Kh'])).ok).toBe(false);
    expect(enumerateEquity(input(['As Ah', 'As Kh'], '2c 7d 9h')).ok).toBe(false);
  });
});

describe('createSimulation', () => {
  it('AA vs KK preflop is about 82% within the reported margin', () => {
    const sim = createSimulation(input(['As Ah', 'Ks Kh']), mulberry32(1));
    sim.step(100000);
    const r = sim.result();
    if (!r.ok) throw new Error(r.error);
    expect(r.exact).toBe(false);
    expect(r.samples).toBe(100000);
    expect(Math.abs(r.players[0].equity - 0.82)).toBeLessThan(r.margin![0] + 0.005);
    expect(r.players[0].equity + r.players[1].equity).toBeCloseTo(1, 9);
  });
  it('the same seed gives identical results', () => {
    const run = () => {
      const sim = createSimulation(input(['As Kd', 'Qh Qc', '9s 8s']), mulberry32(42));
      sim.step(5000);
      return sim.result();
    };
    expect(run()).toEqual(run());
  });
  it('the margin shrinks as samples grow', () => {
    const sim = createSimulation(input(['As Kd', 'Qh Qc']), mulberry32(7));
    sim.step(1000);
    const early = sim.result();
    sim.step(99000);
    const late = sim.result();
    if (!early.ok || !late.ok) throw new Error('unexpected error');
    expect(late.margin![0]).toBeLessThan(early.margin![0]);
  });
  it('simulating a known flop converges to the exact enumeration', () => {
    const i = input(['As Ah', 'Ks Qs'], '2s 7s 9h');
    const exact = okResult(enumerateEquity(i));
    const sim = createSimulation(i, mulberry32(9));
    sim.step(60000);
    const r = sim.result();
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.players[0].equity - exact.players[0].equity)).toBeLessThan(0.02);
  });
  it('has no result before any sample', () => {
    const sim = createSimulation(input(['As Ah', 'Ks Kh']), mulberry32(1));
    expect(sim.result().ok).toBe(false);
  });
});

describe('samplesFor', () => {
  it('scales down so total evaluations stay near 1.2 million', () => {
    expect(samplesFor(2)).toBe(200000);
    expect(samplesFor(6)).toBe(200000);
    expect(samplesFor(10)).toBe(120000);
  });
});
