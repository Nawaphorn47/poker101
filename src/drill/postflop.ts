import type { Card, Suit } from '../engine/cards';
import { ALL_CLASSES } from '../engine/handClass';
import { openMin } from '../coach/preflopChart';

export type OpenerPos = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB';
export type HeroPos = OpenerPos | 'BB';

const PREFLOP_ORDER: HeroPos[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER: HeroPos[] = ['SB', 'BB', 'EP', 'MP', 'CO', 'BTN'];
const TOTAL_COMBOS = 1326;
const SUITS: Suit[] = ['c', 'd', 'h', 's'];
const LETTERS = '23456789TJQKA';

/** Seats that act after the opener preflop; any of them can be the caller who sees the flop with him. */
export function callersAfter(opener: OpenerPos): HeroPos[] {
  return PREFLOP_ORDER.slice(PREFLOP_ORDER.indexOf(opener) + 1);
}

/** True when `hero` acts after `villain` on every postflop street. */
export function isInPosition(hero: HeroPos, villain: HeroPos): boolean {
  return POSTFLOP_ORDER.indexOf(hero) > POSTFLOP_ORDER.indexOf(villain);
}

/** Every suit combination of a hand class such as AA, AKs or T9o. */
export function expandClass(name: string): [Card, Card][] {
  const r1 = LETTERS.indexOf(name[0]) + 2;
  const r2 = LETTERS.indexOf(name[1]) + 2;
  const out: [Card, Card][] = [];
  if (name.length === 2) {
    for (let a = 0; a < 4; a++)
      for (let b = a + 1; b < 4; b++) out.push([{ rank: r1, suit: SUITS[a] }, { rank: r2, suit: SUITS[b] }]);
  } else if (name[2] === 's') {
    for (const s of SUITS) out.push([{ rank: r1, suit: s }, { rank: r2, suit: s }]);
  } else {
    for (const s1 of SUITS)
      for (const s2 of SUITS) if (s1 !== s2) out.push([{ rank: r1, suit: s1 }, { rank: r2, suit: s2 }]);
  }
  return out;
}

/** The guideline opening range of a position as concrete combinations. */
export function openingCombos(pos: OpenerPos): [Card, Card][] {
  return ALL_CLASSES.filter((c) => c.score >= openMin(pos)).flatMap((c) => expandClass(c.name));
}

export function rangeShare(pos: OpenerPos): number {
  return openingCombos(pos).length / TOTAL_COMBOS;
}
