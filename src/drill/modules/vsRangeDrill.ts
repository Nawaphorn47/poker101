import type { Card } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { shuffledDeck } from '../../engine/deck';
import { evCall, requiredEquity } from '../oddsMath';
import {
  callersAfter, isInPosition, openingCombos, rangeShare, type HeroPos, type OpenerPos,
} from '../postflop';
import { beatsBoard, equityVsRange } from '../vsRange';
import type { DrillModule, Grade, Question } from '../types';

const OPENERS: OpenerPos[] = ['EP', 'MP', 'CO', 'BTN', 'SB'];
const BET_FRACTIONS = [0.5, 0.75, 1];
const MIN_COMBOS = 15;
const MAX_ATTEMPTS = 50;

type Scenario = {
  villain: OpenerPos;
  hero: HeroPos;
  inPosition: boolean;
  hole: Card[];
  board: Card[];
  /** pot before the villain's bet */
  potBefore: number;
  bet: number;
  filter: 'whole' | 'beatsBoard';
};

const rangeCache = new Map<OpenerPos, [Card, Card][]>();
function rangeOf(pos: OpenerPos): [Card, Card][] {
  let r = rangeCache.get(pos);
  if (!r) {
    r = openingCombos(pos);
    rangeCache.set(pos, r);
  }
  return r;
}

const show = (cards: Card[]) => cards.map(cardToString).join(' ');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const filterOf = (sc: Scenario) =>
  sc.filter === 'beatsBoard' ? (hole: [Card, Card]) => beatsBoard(sc.board, hole) : undefined;

/** Number of villain combinations that survive blockers and the betting filter. */
function countCombos(sc: Scenario): number {
  const dead = new Set([...sc.hole, ...sc.board].map(cardToString));
  const keep = filterOf(sc);
  let n = 0;
  for (const villain of rangeOf(sc.villain)) {
    if (villain.some((c) => dead.has(cardToString(c)))) continue;
    if (keep && !keep(villain)) continue;
    n++;
  }
  return n;
}

function deal(rng: () => number, filter: Scenario['filter']): Scenario {
  const villain = OPENERS[Math.floor(rng() * OPENERS.length)];
  const options = callersAfter(villain);
  const hero = options[Math.floor(rng() * options.length)];
  const deck = shuffledDeck(Math.floor(rng() * 2 ** 31));
  const boardSize = rng() < 0.5 ? 4 : 5;
  const potBefore = (4 + Math.floor(rng() * 37)) * 5;
  const bet = Math.max(1, Math.round(potBefore * BET_FRACTIONS[Math.floor(rng() * BET_FRACTIONS.length)]));
  return {
    villain, hero, inPosition: isInPosition(hero, villain), hole: deck.slice(0, 2),
    board: deck.slice(2, 2 + boardSize), potBefore, bet, filter,
  };
}

function generate(rng: () => number, level: number): Question<Scenario> {
  const wanted: Scenario['filter'] = level === 2 ? 'beatsBoard' : 'whole';
  let sc = deal(rng, wanted);
  for (let attempt = 0; attempt < MAX_ATTEMPTS && countCombos(sc) < MIN_COMBOS; attempt++) sc = deal(rng, wanted);
  // the whole opening range always leaves enough hands; fall back to it if the filter keeps emptying the range
  if (countCombos(sc) < MIN_COMBOS) sc = { ...sc, filter: 'whole' };

  const street = sc.board.length === 4 ? 'turn' : 'river';
  const bettingRange =
    sc.filter === 'whole'
      ? 'He bets with his whole opening range.'
      : 'He bets only hands whose hole cards give him a better kind of hand than the board alone (for example a pair on an unpaired board).';
  const first = sc.inPosition ? 'Villain bets' : 'You check and villain bets';
  return {
    type: 'vsrange', level, key: `vsrange:L${level}:${sc.villain}:${sc.hero}:${street}`,
    prompt:
      `Villain opened from the ${sc.villain} (his range: about ${pct(rangeShare(sc.villain))} of hands). ` +
      `You called on the ${sc.hero} and are ${sc.inPosition ? 'in position' : 'out of position'}. ` +
      `You hold ${show(sc.hole)}; the ${street} board is ${show(sc.board)}. ` +
      `${first} ${sc.bet} into ${sc.potBefore}. ${bettingRange} ` +
      `Assume no further betting after your call. Call or fold?`,
    options: [{ value: 'call', label: 'Call' }, { value: 'fold', label: 'Fold' }],
    scenario: sc,
  };
}

function grade(q: Question, answer: string): Grade {
  const sc = q.scenario as Scenario;
  const { equity, combos } = equityVsRange(sc.hole, sc.board, rangeOf(sc.villain), filterOf(sc));
  if (combos === 0) {
    return {
      correct: true, borderline: false, certainty: 'exact',
      explanation: 'This question cannot be graded: no villain hands remain after removing the cards you can see.',
    };
  }
  const potAfter = sc.potBefore + sc.bet;
  const ev = evCall(equity, potAfter, sc.bet);
  const narrowed = sc.filter === 'beatsBoard' ? ', keeping only the hands that improve on the board' : '';
  return {
    correct: answer === 'call' ? ev > 0 : ev <= 0,
    borderline: false,
    certainty: 'exact',
    ev: { chosen: answer === 'call' ? ev : 0, best: Math.max(ev, 0), unit: 'chips' },
    explanation:
      `Against the ${combos} hands left in the ${sc.villain} opening range${narrowed}, your equity is ${pct(equity)} ` +
      `and you need ${pct(requiredEquity(sc.bet, potAfter))} to call. EV(call) = equity x ${potAfter} - (1 - equity) x ${sc.bet} = ` +
      `${ev.toFixed(1)} chips; EV(fold) = 0. This assumes no further betting after your call. ` +
      `The range is a guideline from our opening table, not GTO. Position does not change this answer under that assumption; ` +
      `in real play being in position lets you realise more of your equity.`,
  };
}

export const vsRangeDrill: DrillModule = { id: 'vsrange', levels: 2, generate, grade };
