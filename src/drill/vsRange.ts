import type { Card } from '../engine/cards';
import { shuffledDeck } from '../engine/deck';
import { compareScores, evaluate } from '../engine/handEvaluator';

const key = (c: Card) => c.rank * 4 + 'cdhs'.indexOf(c.suit);

/**
 * True when the hole cards lift the hand to a higher category than the board alone makes (a pair on an
 * unpaired board, trips on a paired board, ...). Categories are compared rather than full scores: a
 * four-card turn board has fewer kickers than a five-card hand, so any extra card would otherwise count.
 */
export function beatsBoard(board: Card[], hole: [Card, Card]): boolean {
  return evaluate([...board, ...hole]).category > evaluate(board).category;
}

/**
 * Exact equity of `hero` against every combination of `range` on a turn (4 cards) or river (5 cards) board.
 * Combinations that use a hero or board card, or that fail `filter`, are skipped. Every remaining
 * combination and every remaining runout counts equally; a tie counts one half.
 */
export function equityVsRange(
  hero: Card[],
  board: Card[],
  range: [Card, Card][],
  filter?: (hole: [Card, Card]) => boolean,
): { equity: number; combos: number } {
  const dead = new Set([...hero, ...board].map(key));
  const live = shuffledDeck(0).filter((c) => !dead.has(key(c)));
  let sum = 0;
  let outcomes = 0;
  let combos = 0;

  const settle = (villain: [Card, Card], full: Card[]) => {
    const cmp = compareScores(evaluate([...hero, ...full]), evaluate([...villain, ...full]));
    sum += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
    outcomes++;
  };

  for (const villain of range) {
    const [a, b] = villain;
    if (dead.has(key(a)) || dead.has(key(b))) continue;
    if (filter && !filter(villain)) continue;
    combos++;
    if (board.length === 5) {
      settle(villain, board);
    } else {
      for (const c of live) if (key(c) !== key(a) && key(c) !== key(b)) settle(villain, [...board, c]);
    }
  }
  return { equity: outcomes === 0 ? 0 : sum / outcomes, combos };
}
