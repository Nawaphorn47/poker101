import {
  callersAfter, isInPosition, expandClass, openingCombos, rangeShare, type HeroPos, type OpenerPos,
} from '../../src/drill/postflop';
import { cardToString } from '../../src/engine/cards';

const OPENERS: OpenerPos[] = ['EP', 'MP', 'CO', 'BTN', 'SB'];
const key = (c: [unknown, unknown] | { rank: number; suit: string }[]) => (c as { rank: number; suit: string }[]).map((x) => `${x.rank}${x.suit}`).join('-');

describe('callersAfter', () => {
  it('lists the seats that act after the opener preflop', () => {
    expect(callersAfter('EP')).toEqual(['MP', 'CO', 'BTN', 'SB', 'BB']);
    expect(callersAfter('MP')).toEqual(['CO', 'BTN', 'SB', 'BB']);
    expect(callersAfter('CO')).toEqual(['BTN', 'SB', 'BB']);
    expect(callersAfter('BTN')).toEqual(['SB', 'BB']);
    expect(callersAfter('SB')).toEqual(['BB']);
  });
});

describe('isInPosition', () => {
  it.each<[HeroPos, HeroPos, boolean]>([
    ['CO', 'EP', true],
    ['BTN', 'CO', true],
    ['BB', 'SB', true],
    ['SB', 'BTN', false],
    ['BB', 'BTN', false],
    ['SB', 'EP', false],
    ['BB', 'EP', false],
    ['BTN', 'EP', true],
  ])('hero %s against villain %s is %s', (hero, villain, expected) => {
    expect(isInPosition(hero, villain)).toBe(expected);
  });

  it('for every valid pair exactly one player is in position', () => {
    for (const villain of OPENERS) {
      for (const hero of callersAfter(villain)) {
        expect(isInPosition(hero, villain)).toBe(!isInPosition(villain, hero));
      }
    }
  });
});

describe('expandClass', () => {
  it('gives 6, 4 and 12 distinct combinations for a pair, suited and offsuit class', () => {
    expect(expandClass('AA')).toHaveLength(6);
    expect(expandClass('AKs')).toHaveLength(4);
    expect(expandClass('AKo')).toHaveLength(12);
    for (const name of ['AA', 'AKs', 'AKo', '72o', 'T9s']) {
      const combos = expandClass(name);
      expect(new Set(combos.map(key)).size).toBe(combos.length);
      for (const [a, b] of combos) expect(cardToString(a)).not.toBe(cardToString(b));
    }
  });
  it('suited combinations share a suit and offsuit combinations do not', () => {
    for (const [a, b] of expandClass('KQs')) expect(a.suit).toBe(b.suit);
    for (const [a, b] of expandClass('KQo')) expect(a.suit).not.toBe(b.suit);
  });
  it('uses the right ranks', () => {
    for (const [a, b] of expandClass('T9s')) expect([a.rank, b.rank].sort((x, y) => x - y)).toEqual([9, 10]);
    for (const [a, b] of expandClass('77')) expect([a.rank, b.rank]).toEqual([7, 7]);
  });
});

describe('opening ranges', () => {
  it('have the sizes from the guideline table', () => {
    expect(openingCombos('EP')).toHaveLength(88);
    expect(openingCombos('MP')).toHaveLength(142);
    expect(openingCombos('CO')).toHaveLength(236);
    expect(openingCombos('BTN')).toHaveLength(338);
    expect(openingCombos('SB')).toHaveLength(236);
  });
  it('rangeShare is the fraction of 1,326 combinations', () => {
    expect(rangeShare('EP')).toBeCloseTo(88 / 1326, 10);
    expect(Math.abs(rangeShare('EP') - 0.066)).toBeLessThan(0.001);
    expect(Math.abs(rangeShare('BTN') - 0.255)).toBeLessThan(0.001);
  });
  it('are nested from tight to wide: EP within MP within CO within BTN', () => {
    const asSet = (p: OpenerPos) => new Set(openingCombos(p).map(key));
    for (const [narrow, wide] of [['EP', 'MP'], ['MP', 'CO'], ['CO', 'BTN']] as [OpenerPos, OpenerPos][]) {
      const w = asSet(wide);
      for (const k of asSet(narrow)) expect(w.has(k)).toBe(true);
    }
  });
  it('never list the same combination twice or a card twice in one hand', () => {
    for (const p of OPENERS) {
      const combos = openingCombos(p);
      expect(new Set(combos.map(key)).size).toBe(combos.length);
      for (const [a, b] of combos) expect(cardToString(a)).not.toBe(cardToString(b));
    }
  });
});
