import type { Card, Suit } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { ALL_CLASSES, handClass } from '../../engine/handClass';
import { pushFoldRow, PUSHFOLD_STACKS } from '../pushFoldData';
import type { DrillModule, Grade, Question } from '../types';

type Role = 'sb' | 'bb';
type PushFoldScenario = { role: Role; stack: number; hole: Card[] };

const TOLERANCE_BB = 0.1;
const SB_FOLD = -0.5;
const BB_FOLD = -1;
const LETTERS = '23456789TJQKA';
const SUITS: Suit[] = ['c', 'd', 'h', 's'];

const combos = (name: string) => (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12);
const TOTAL_COMBOS = ALL_CLASSES.reduce((a, c) => a + combos(c.name), 0);

function randomClass(rng: () => number): string {
  let roll = rng() * TOTAL_COMBOS;
  for (const c of ALL_CLASSES) {
    roll -= combos(c.name);
    if (roll < 0) return c.name;
  }
  return ALL_CLASSES[ALL_CLASSES.length - 1].name;
}

/** Concrete cards for a class name such as AA, AKs or T9o. */
function holeFor(name: string, rng: () => number): Card[] {
  const r1 = LETTERS.indexOf(name[0]) + 2;
  const r2 = LETTERS.indexOf(name[1]) + 2;
  const s1 = SUITS[Math.floor(rng() * 4)];
  if (name.length === 3 && name[2] === 's') return [{ rank: r1, suit: s1 }, { rank: r2, suit: s1 }];
  const others = SUITS.filter((s) => s !== s1);
  return [{ rank: r1, suit: s1 }, { rank: r2, suit: others[Math.floor(rng() * 3)] }];
}

const bucket = (stack: number) => (stack <= 5 ? '2-5' : stack <= 10 ? '6-10' : '11-15');

function generate(rng: () => number, level: number): Question<PushFoldScenario> {
  const role: Role = level === 1 ? 'sb' : level === 2 ? 'bb' : rng() < 0.5 ? 'sb' : 'bb';
  const stack = PUSHFOLD_STACKS[Math.floor(rng() * PUSHFOLD_STACKS.length)];
  const hole = holeFor(randomClass(rng), rng);
  const cards = hole.map(cardToString).join(' ');
  return {
    type: 'pushfold', level, key: `pushfold:${role}:${bucket(stack)}`,
    prompt:
      role === 'sb'
        ? `Heads-up, you are the small blind with ${cards} and an effective stack of ${stack}bb. Push all-in or fold?`
        : `Heads-up, the small blind pushes all-in for ${stack}bb. You are the big blind with ${cards}. Call or fold?`,
    options:
      role === 'sb'
        ? [{ value: 'push', label: 'Push all-in' }, { value: 'fold', label: 'Fold' }]
        : [{ value: 'call', label: 'Call' }, { value: 'fold', label: 'Fold' }],
    scenario: { role, stack, hole },
  };
}

function grade(q: Question, answer: string): Grade {
  const { role, stack, hole } = q.scenario as PushFoldScenario;
  const row = pushFoldRow(stack);
  const cls = handClass(hole);
  const active = role === 'sb' ? row.evPush[cls] : row.evCall[cls];
  const fold = role === 'sb' ? SB_FOLD : BB_FOLD;
  const best = Math.max(active, fold);
  const chosen = answer === 'fold' ? fold : active;
  const correct = best - chosen <= TOLERANCE_BB + 1e-9;
  const verb = role === 'sb' ? 'push' : 'call';
  return {
    correct,
    borderline: correct && chosen < best,
    certainty: 'exact',
    explanation: `${cls} at ${stack}bb, heads-up: EV of ${verb} ${active.toFixed(2)}bb vs fold ${fold.toFixed(2)}bb. These come from a heads-up Nash equilibrium built on simulated equities (about +/-1%) and ignore card removal between hands, so an answer within ${TOLERANCE_BB}bb of the best is accepted. Multi-way spots differ.`,
    ev: { chosen, best, unit: 'bb' },
  };
}

export const pushFoldDrill: DrillModule = { id: 'pushfold', levels: 3, generate, grade };
