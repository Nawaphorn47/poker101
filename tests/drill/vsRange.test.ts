import { beatsBoard, equityVsRange } from '../../src/drill/vsRange';
import { expandClass } from '../../src/drill/postflop';
import { parseCard, cardToString, type Card } from '../../src/engine/cards';
import { shuffledDeck } from '../../src/engine/deck';
import { compareScores, evaluate } from '../../src/engine/handEvaluator';

const cards = (s: string): Card[] => s.trim().split(/\s+/).map(parseCard);
const pair = (s: string): [Card, Card] => cards(s) as [Card, Card];

describe('equityVsRange on the river', () => {
  const board = cards('2c 7d 9h Jc 3s');
  it('a one-hand range that loses gives equity 1 and combos 1', () => {
    const r = equityVsRange(cards('As Ah'), board, [pair('Ks Kh')]);
    expect(r).toEqual({ equity: 1, combos: 1 });
  });
  it('a one-hand range that wins gives equity 0', () => {
    const r = equityVsRange(cards('5h 4d'), board, [pair('Ks Kh')]);
    expect(r).toEqual({ equity: 0, combos: 1 });
  });
  it('a tie counts one half', () => {
    const royal = cards('As Ks Qs Js Ts');
    const r = equityVsRange(cards('2c 3d'), royal, [pair('4c 5d')]);
    expect(r).toEqual({ equity: 0.5, combos: 1 });
  });
  it('mixes results across the range with equal weights', () => {
    // hero pair of aces: beats KK, loses to a set of sevens
    const r = equityVsRange(cards('As Ah'), board, [pair('Ks Kh'), pair('7s 7h')]);
    expect(r.combos).toBe(2);
    expect(r.equity).toBeCloseTo(0.5, 12);
  });
});

describe('equityVsRange on the turn', () => {
  it('equals an independent enumeration over every river card', () => {
    const hero = cards('Ah Kd');
    const board = cards('2c 7d 9h Jc');
    const range = [pair('Ks Kh'), pair('Qs Qh'), pair('Td 9d')];
    const used = new Set([...hero, ...board].map(cardToString));
    let sum = 0;
    let n = 0;
    for (const villain of range) {
      const dead = new Set([...used, ...villain.map(cardToString)]);
      for (const river of shuffledDeck(0).filter((c) => !dead.has(cardToString(c)))) {
        const full = [...board, river];
        const cmp = compareScores(evaluate([...hero, ...full]), evaluate([...villain, ...full]));
        sum += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
        n++;
      }
    }
    const r = equityVsRange(hero, board, range);
    expect(r.combos).toBe(3);
    expect(r.equity).toBeCloseTo(sum / n, 12);
  });
});

describe('equityVsRange blockers and filter', () => {
  const board = cards('2c 7d 9h Jc 3s');
  it('combinations containing a hero card are excluded', () => {
    expect(equityVsRange(cards('As Kd'), board, expandClass('AA')).combos).toBe(3);
  });
  it('combinations containing a board card are excluded', () => {
    expect(equityVsRange(cards('As Ah'), cards('Ks 7d 9h Jc 3s'), expandClass('KK')).combos).toBe(3);
  });
  it('a filter can exclude combinations, and rejecting everything gives combos 0 and equity 0', () => {
    const range = expandClass('QQ');
    const none = equityVsRange(cards('As Ah'), board, range, () => false);
    expect(none).toEqual({ equity: 0, combos: 0 });
    const some = equityVsRange(cards('As Ah'), board, range, ([a, b]) => a.suit === 's' || b.suit === 's');
    expect(some.combos).toBe(3);
  });
  it('an empty range gives combos 0', () => {
    expect(equityVsRange(cards('As Ah'), board, [])).toEqual({ equity: 0, combos: 0 });
  });
});

describe('beatsBoard', () => {
  it('a royal flush on the board is never beaten by any hole cards', () => {
    const royal = cards('As Ks Qs Js Ts');
    for (const hole of ['2c 3d', '9s 8s', 'Ah Ad'].map(pair)) expect(beatsBoard(royal, hole)).toBe(false);
  });
  it('on a paired board: trips and two pair beat it; a hand that plays the board or only adds a kicker does not', () => {
    const board = cards('2c 2d 7h 9s Jc');
    expect(beatsBoard(board, pair('2h 3h'))).toBe(true); // trips
    expect(beatsBoard(board, pair('7d 8d'))).toBe(true); // two pair
    expect(beatsBoard(board, pair('3h 4h'))).toBe(false); // plays the board
    expect(beatsBoard(board, pair('Ah 3h'))).toBe(false); // ace kicker only: same category
  });
  it('works with a four-card turn board, where extra cards must not count as improvements by themselves', () => {
    const turn = cards('2c 2d 7h 9s');
    expect(beatsBoard(turn, pair('2h 3h'))).toBe(true);
    expect(beatsBoard(turn, pair('3h 4h'))).toBe(false);
    expect(beatsBoard(turn, pair('Ah Kh'))).toBe(false);
    expect(beatsBoard(turn, pair('7d 8d'))).toBe(true);
  });
  it('on an unpaired board a pair beats it and a bare kicker improvement does not', () => {
    expect(beatsBoard(cards('2c 7d 9h Jc 3s'), pair('Kh Kd'))).toBe(true); // pocket pair
    expect(beatsBoard(cards('2c 7d 9h Jc 3s'), pair('Jh 4d'))).toBe(true); // pairs the board
    expect(beatsBoard(cards('2c 7d 9h Jc 3s'), pair('4h 5d'))).toBe(false); // improves kickers only
    expect(beatsBoard(cards('2c 7d 9h Jc'), pair('4h 5d'))).toBe(false);
  });
  it('holding only cards that miss the best five does not beat a strong board', () => {
    expect(beatsBoard(cards('Ac Kc Qc Jc 9c'), pair('2d 3d'))).toBe(false);
  });
});
