import { countOuts, outsDrill } from '../../src/drill/modules/outsDrill';
import { compareScores, evaluate } from '../../src/engine/handEvaluator';
import { parseCard, cardToString, type Card } from '../../src/engine/cards';
import { shuffledDeck, mulberry32 } from '../../src/engine/deck';

type Sc = { hole: Card[]; board: Card[] };
const cards = (s: string): Card[] => s.trim().split(/\s+/).map(parseCard);
const gen = (level: number, seed: number) => outsDrill.generate(mulberry32(seed), level);

/**
 * independent card-by-card count written separately from the implementation: a card is an out only if it
 * gives a straight or better AND the hand is better than the board alone would give every player
 */
function bruteForce(hole: Card[], board: Card[]): number {
  const used = new Set([...hole, ...board].map(cardToString));
  let n = 0;
  for (const c of shuffledDeck(0)) {
    if (used.has(cardToString(c))) continue;
    const mine = evaluate([...hole, ...board, c]);
    if (mine.category >= 4 && compareScores(mine, evaluate([...board, c])) > 0) n++;
  }
  return n;
}
const paired = (board: Card[]) => new Set(board.map((c) => c.rank)).size < board.length;

describe('countOuts known cases', () => {
  it.each([
    ['flush draw', 'As 5s', 'Ks 9s 2d', 9],
    ['open-ended straight draw', '7h 8c', '9d Tc 2s', 8],
    ['gutshot', '7h 8c', '9d Jc 2s', 4],
    ['flush draw plus open-ended straight draw', '8s 9s', '7s Tc 2s', 15],
    ['no draw', 'Ah 2d', 'Ks 9c 4h', 0],
    // a straight that sits on the board is shared by everyone, so the cards that complete it are not outs
    ['a card that only completes a straight on the board', '3s Tc', '9c Th 8h 7h', 0],
    ['a board straight completed while the hero holds a pair', '2c 9s', '7d 9h 8d 5s', 0],
    ['a card that gives the hero a higher straight than the board', 'Th 2c', '5h 6d 7c 8s', 4],
  ])('%s is %i outs', (_name, hole, board, expected) => {
    expect(countOuts(cards(hole as string), cards(board as string))).toBe(expected);
  });
  it('counts a full house as an out for trips (straight or better)', () => {
    // trips on the flop: any card pairing the board or the hole card makes a full house or quads
    expect(countOuts(cards('7h 7d'), cards('7c Ks 2d'))).toBeGreaterThan(0);
  });
  it('works on the turn with one card to come', () => {
    expect(countOuts(cards('As 5s'), cards('Ks 9s 2d 7h'))).toBe(9);
  });
});

describe('outsDrill generation and grading', () => {
  it('the answer equals an independent count for 300 questions at each level', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 300; seed++) {
        const q = gen(level, seed);
        const sc = q.scenario as Sc;
        const expected = bruteForce(sc.hole, sc.board);
        const right = q.options.filter((o) => outsDrill.grade(q, o.value).correct);
        expect(right.map((o) => Number(o.value))).toEqual([expected]);
      }
    }
  });
  it('no counted out is a hand the board alone would give everybody', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 300; seed++) {
        const sc = gen(level, seed).scenario as Sc;
        const used = new Set([...sc.hole, ...sc.board].map(cardToString));
        for (const c of shuffledDeck(0)) {
          if (used.has(cardToString(c))) continue;
          const mine = evaluate([...sc.hole, ...sc.board, c]);
          const isOut = mine.category >= 4 && compareScores(mine, evaluate([...sc.board, c])) > 0;
          const shared = mine.category >= 4 && !isOut;
          if (shared) expect(countOuts(sc.hole, sc.board)).toBe(bruteForce(sc.hole, sc.board)); // excluded from the count
        }
      }
    }
  });
  it('level 1 outs are only straight or flush completions, never full houses or quads', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const sc = gen(1, seed).scenario as Sc;
      const used = new Set([...sc.hole, ...sc.board].map(cardToString));
      for (const c of shuffledDeck(0)) {
        if (used.has(cardToString(c))) continue;
        const mine = evaluate([...sc.hole, ...sc.board, c]);
        if (mine.category >= 4 && compareScores(mine, evaluate([...sc.board, c])) > 0) {
          expect([4, 5]).toContain(mine.category);
        }
      }
    }
  });
  it('never asks about a hand that already has a straight or better', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 300; seed++) {
        const sc = gen(level, seed).scenario as Sc;
        expect(evaluate([...sc.hole, ...sc.board]).category).toBeLessThan(4);
      }
    }
  });
  it('options are four distinct non-negative integers', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = gen(1 + (seed % 2), seed);
      const vals = q.options.map((o) => Number(o.value));
      expect(vals).toHaveLength(4);
      expect(new Set(vals).size).toBe(4);
      for (const v of vals) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('level 1 boards are unpaired and have 3 or 4 cards', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const sc = gen(1, seed).scenario as Sc;
      expect(paired(sc.board)).toBe(false);
      sizes.add(sc.board.length);
    }
    expect([...sizes].sort()).toEqual([3, 4]);
  });
  it('level 1 questions are single draws (0, 4, 8 or 9 outs)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const sc = gen(1, seed).scenario as Sc;
      expect([0, 4, 8, 9]).toContain(countOuts(sc.hole, sc.board));
    }
  });
  it('level 2 includes paired boards and combination draws over 500 seeds', () => {
    let pairedBoards = 0;
    let big = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const sc = gen(2, seed).scenario as Sc;
      if (paired(sc.board)) pairedBoards++;
      if (countOuts(sc.hole, sc.board) >= 12) big++;
    }
    expect(pairedBoards).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(0);
  });
  it('cards are distinct, and the key carries level, street and outs', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = gen(1 + (seed % 2), seed);
      const sc = q.scenario as Sc;
      const all = [...sc.hole, ...sc.board].map(cardToString);
      expect(new Set(all).size).toBe(all.length);
      const street = sc.board.length === 3 ? 'flop' : 'turn';
      expect(q.key).toBe(`outs:L${q.level}:${street}:${countOuts(sc.hole, sc.board)}`);
    }
  });
  it('grades are exact, never borderline, and the explanation prints the definition', () => {
    const q = gen(1, 3);
    const g = outsDrill.grade(q, q.options[0].value);
    expect(g.certainty).toBe('exact');
    expect(g.borderline).toBe(false);
    expect(g.ev).toBeUndefined();
    expect(g.explanation).toMatch(/straight or better/i);
    expect(q.prompt).toMatch(/straight or better/i);
  });
  it('declares its id and two levels, and is deterministic for a seed', () => {
    expect(outsDrill.id).toBe('outs');
    expect(outsDrill.levels).toBe(2);
    expect(gen(2, 9)).toEqual(gen(2, 9));
  });
});
