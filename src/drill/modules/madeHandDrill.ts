import type { Card } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { shuffledDeck } from '../../engine/deck';
import { compareScores, evaluate } from '../../engine/handEvaluator';
import type { DrillModule, Grade, Question } from '../types';

const CATEGORY_NAMES = [
  'High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush',
];
// rejection weights so made hands show up more often than plain high card and single pair
const KEEP_L1 = [0.25, 0.6, 1, 1, 1, 1, 1, 1, 1];
const MAX_ATTEMPTS = 500;
const STREET_BY_BOARD: Record<number, string> = { 3: 'flop', 4: 'turn', 5: 'river' };

type Level1 = { hole: Card[]; board: Card[] };
type Level2 = { hole: Card[]; villain: Card[]; board: Card[] };

const show = (cards: Card[]) => cards.map(cardToString).join(' ');
const nextSeed = (rng: () => number) => Math.floor(rng() * 2 ** 31);

function shuffle<T>(rng: () => number, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function level1(rng: () => number): Question<Level1> {
  let hole: Card[] = [];
  let board: Card[] = [];
  let category = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const deck = shuffledDeck(nextSeed(rng));
    const size = 3 + Math.floor(rng() * 3);
    hole = deck.slice(0, 2);
    board = deck.slice(2, 2 + size);
    category = evaluate([...hole, ...board]).category;
    if (rng() < KEEP_L1[category]) break;
  }
  const others = shuffle(rng, CATEGORY_NAMES.map((_, i) => i).filter((i) => i !== category)).slice(0, 3);
  const options = shuffle(rng, [category, ...others]).map((i) => ({ value: String(i), label: CATEGORY_NAMES[i] }));
  return {
    type: 'madehand', level: 1, key: `madehand:L1:${STREET_BY_BOARD[board.length]}`,
    prompt: `You hold ${show(hole)}. The board is ${show(board)}. What is your best hand?`,
    options, scenario: { hole, board },
  };
}

function level2(rng: () => number): Question<Level2> {
  let hole: Card[] = [];
  let villain: Card[] = [];
  let board: Card[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const deck = shuffledDeck(nextSeed(rng));
    hole = deck.slice(0, 2);
    villain = deck.slice(2, 4);
    board = deck.slice(4, 9);
    const a = evaluate([...hole, ...board]);
    const b = evaluate([...villain, ...board]);
    // favour showdowns decided by kickers or tied over those decided by hand category
    if (a.category === b.category || compareScores(a, b) === 0 || rng() < 0.5) break;
  }
  return {
    type: 'madehand', level: 2, key: 'madehand:L2',
    prompt: `You hold ${show(hole)}, villain holds ${show(villain)}, the board is ${show(board)}. Who wins at showdown?`,
    options: [
      { value: 'hero', label: 'You win' },
      { value: 'villain', label: 'Villain wins' },
      { value: 'split', label: 'Split pot' },
    ],
    scenario: { hole, villain, board },
  };
}

function grade(q: Question, answer: string): Grade {
  const base = { borderline: false, certainty: 'exact' as const };
  if (q.level === 1) {
    const { hole, board } = q.scenario as Level1;
    const category = evaluate([...hole, ...board]).category;
    return {
      ...base,
      correct: answer === String(category),
      explanation: `${show(hole)} with the board ${show(board)} makes ${CATEGORY_NAMES[category].toLowerCase()}.`,
    };
  }
  const { hole, villain, board } = q.scenario as Level2;
  const a = evaluate([...hole, ...board]);
  const b = evaluate([...villain, ...board]);
  const cmp = compareScores(a, b);
  const winner = cmp > 0 ? 'hero' : cmp < 0 ? 'villain' : 'split';
  const mine = CATEGORY_NAMES[a.category].toLowerCase();
  const theirs = CATEGORY_NAMES[b.category].toLowerCase();
  const result = winner === 'split' ? 'The pot is split.' : winner === 'hero' ? 'You win.' : 'Villain wins.';
  return {
    ...base,
    correct: answer === winner,
    explanation: `You have ${mine}, villain has ${theirs}. ${result}${a.category === b.category && winner !== 'split' ? ' Same category, so the higher cards decide.' : ''}`,
  };
}

export const madeHandDrill: DrillModule = {
  id: 'madehand',
  levels: 2,
  generate: (rng, level) => (level === 1 ? level1(rng) : level2(rng)),
  grade,
};
