import type { Card } from '../engine/cards';
import { shuffledDeck } from '../engine/deck';
import { compareScores, evaluate } from '../engine/handEvaluator';

export type EquityInput = { hands: Card[][]; board: Card[] };

/** Fractions of all outcomes: `win` = outright wins, `tie` = outcomes tied for best, `equity` = wins + split shares. */
export type PlayerEquity = { win: number; tie: number; equity: number };

export type EquityResult =
  | { ok: true; players: PlayerEquity[]; exact: boolean; samples: number; margin?: number[] }
  | { ok: false; error: string };

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const SAMPLE_CAP = 200_000;
const EVALUATION_BUDGET = 1_200_000;

const cardKey = (c: Card) => c.rank * 4 + 'cdhs'.indexOf(c.suit);

/** Returns a message describing the first problem with the input, or null when it is valid. */
export function validateEquityInput({ hands, board }: EquityInput): string | null {
  if (hands.length < MIN_PLAYERS || hands.length > MAX_PLAYERS) return `Equity needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`;
  if (!hands.every((h) => h.length === 2)) return 'Pick both cards for every player.';
  if (![0, 3, 4, 5].includes(board.length)) return 'The board needs 0, 3, 4 or 5 cards.';
  const seen = new Set<number>();
  for (const c of [...hands.flat(), ...board]) {
    const k = cardKey(c);
    if (seen.has(k)) return 'A card cannot be used twice.';
    seen.add(k);
  }
  return null;
}

function unseenCards({ hands, board }: EquityInput): Card[] {
  const used = new Set([...hands.flat(), ...board].map(cardKey));
  return shuffledDeck(0).filter((c) => !used.has(cardKey(c)));
}

type Tally = { win: number[]; tie: number[]; share: number[]; outcomes: number };
const newTally = (players: number): Tally => ({
  win: new Array(players).fill(0), tie: new Array(players).fill(0), share: new Array(players).fill(0), outcomes: 0,
});

/** Scores one complete board for every player. */
function settle(hands: Card[][], fullBoard: Card[], t: Tally): void {
  const scores = hands.map((h) => evaluate([...h, ...fullBoard]));
  let best = scores[0];
  for (const s of scores) if (compareScores(s, best) > 0) best = s;
  const winners: number[] = [];
  scores.forEach((s, i) => {
    if (compareScores(s, best) === 0) winners.push(i);
  });
  for (const w of winners) {
    if (winners.length === 1) t.win[w]++;
    else t.tie[w]++;
    t.share[w] += 1 / winners.length;
  }
  t.outcomes++;
}

function toResult(t: Tally, exact: boolean): EquityResult {
  const n = t.outcomes;
  const players = t.win.map((w, i) => ({ win: w / n, tie: t.tie[i] / n, equity: t.share[i] / n }));
  const result: EquityResult = { ok: true, players, exact, samples: n };
  if (!exact) result.margin = players.map((p) => 1.96 * Math.sqrt((p.equity * (1 - p.equity)) / n));
  return result;
}

/** Exact equity by enumerating every completion of a board that already has 3, 4 or 5 cards. */
export function enumerateEquity(input: EquityInput): EquityResult {
  const error = validateEquityInput(input);
  if (error) return { ok: false, error };
  if (input.board.length < 3) return { ok: false, error: 'Exact enumeration needs at least 3 board cards.' };
  const rest = unseenCards(input);
  const need = 5 - input.board.length;
  const t = newTally(input.hands.length);
  if (need === 0) settle(input.hands, input.board, t);
  else if (need === 1) for (const a of rest) settle(input.hands, [...input.board, a], t);
  else
    for (let i = 0; i < rest.length; i++)
      for (let j = i + 1; j < rest.length; j++) settle(input.hands, [...input.board, rest[i], rest[j]], t);
  return toResult(t, true);
}

/** Random-board simulation that can be advanced in chunks and read at any time. Input must already be valid. */
export function createSimulation(input: EquityInput, rng: () => number) {
  const deck = unseenCards(input);
  const need = 5 - input.board.length;
  const t = newTally(input.hands.length);
  return {
    step(samples: number): void {
      for (let s = 0; s < samples; s++) {
        for (let k = 0; k < need; k++) {
          const j = k + Math.floor(rng() * (deck.length - k));
          [deck[k], deck[j]] = [deck[j], deck[k]];
        }
        settle(input.hands, need === 0 ? input.board : [...input.board, ...deck.slice(0, need)], t);
      }
    },
    result(): EquityResult {
      return t.outcomes === 0 ? { ok: false, error: 'No samples yet.' } : toResult(t, false);
    },
  };
}

/** Sample cap for a simulation: 200,000, scaled down so total evaluations stay near 1.2 million. */
export function samplesFor(players: number): number {
  return Math.min(SAMPLE_CAP, Math.floor(EVALUATION_BUDGET / players));
}
