import type { Card } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { shuffledDeck } from '../../engine/deck';
import { compareScores, evaluate } from '../../engine/handEvaluator';
import type { DrillModule, Grade, Question } from '../types';

const STRAIGHT = 4; // hand category of a straight; anything at or above it counts
const FLUSH = 5;
const MAX_ATTEMPTS = 5000;
const SINGLE_DRAW_OUTS = [4, 8, 9]; // gutshot, open-ended straight draw, flush draw

type Scenario = { hole: Card[]; board: Card[] };

const show = (cards: Card[]) => cards.map(cardToString).join(' ');
const streetOf = (board: Card[]) => (board.length === 3 ? 'flop' : 'turn');
const isPaired = (board: Card[]) => new Set(board.map((c) => c.rank)).size < board.length;

/**
 * The unseen cards that would give you a straight or better on the next card using your own cards.
 * A card that only completes a straight or flush on the board is not an out: every player would have it.
 */
function outCards(hole: Card[], board: Card[]): Card[] {
  const used = new Set([...hole, ...board].map(cardToString));
  return shuffledDeck(0).filter((c) => {
    if (used.has(cardToString(c))) return false;
    const mine = evaluate([...hole, ...board, c]);
    return mine.category >= STRAIGHT && compareScores(mine, evaluate([...board, c])) > 0;
  });
}

/** Number of unseen cards that give a straight, flush, full house or better on the next card. */
export function countOuts(hole: Card[], board: Card[]): number {
  return outCards(hole, board).length;
}

function shuffle<T>(rng: () => number, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(rng: () => number): Scenario {
  const deck = shuffledDeck(Math.floor(rng() * 2 ** 31));
  const size = 3 + Math.floor(rng() * 2); // flop or turn
  return { hole: deck.slice(0, 2), board: deck.slice(2, 2 + size) };
}

/** Level 1 keeps single draws on unpaired boards; level 2 keeps anything with outs, favouring big combination draws. */
function accept(level: number, sc: Scenario, rng: () => number): boolean {
  if (evaluate([...sc.hole, ...sc.board]).category >= STRAIGHT) return false;
  const cards = outCards(sc.hole, sc.board);
  const outs = cards.length;
  if (level === 1) {
    if (isPaired(sc.board)) return false;
    // a single straight or flush draw: every out completes a straight or a flush, none a full house or better
    const onlyStraightsAndFlushes = cards.every((c) => {
      const category = evaluate([...sc.hole, ...sc.board, c]).category;
      return category === STRAIGHT || category === FLUSH;
    });
    return onlyStraightsAndFlushes && (SINGLE_DRAW_OUTS.includes(outs) || (outs === 0 && rng() < 0.1));
  }
  if (outs === 0) return false;
  return outs >= 12 || rng() < 0.35;
}

function generate(rng: () => number, level: number): Question<Scenario> {
  let sc = deal(rng);
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !accept(level, sc, rng); attempt++) sc = deal(rng);
  const outs = countOuts(sc.hole, sc.board);
  const wrong = shuffle(
    rng,
    [-4, -3, -2, -1, 1, 2, 3, 4].map((d) => outs + d).filter((v) => v >= 0),
  ).slice(0, 3);
  return {
    type: 'outs', level, key: `outs:L${level}:${streetOf(sc.board)}:${outs}`,
    prompt: `You hold ${show(sc.hole)}. The board is ${show(sc.board)}. You do not have a straight yet. How many of the unseen cards would give you a straight or better (straight, flush, full house, four of a kind or straight flush) on the next card, using your own cards? A card that only completes a hand on the board does not count, because every player would have it.`,
    options: shuffle(rng, [outs, ...wrong]).map((v) => ({ value: String(v), label: String(v) })),
    scenario: sc,
  };
}

function grade(q: Question, answer: string): Grade {
  const { hole, board } = q.scenario as Scenario;
  const cards = outCards(hole, board);
  return {
    correct: Number(answer) === cards.length,
    borderline: false,
    certainty: 'exact',
    explanation: cards.length === 0
      ? 'No unseen card gives you a straight or better with your own cards on the next card.'
      : `${cards.length} unseen cards give you a straight or better with your own cards on the next card: ${show(cards)}. Cards that only complete a hand on the board are not outs.`,
  };
}

export const outsDrill: DrillModule = { id: 'outs', levels: 2, generate, grade };
