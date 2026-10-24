import type { Card } from './cards';
import { shuffledDeck } from './deck';
import { evaluate, type HandScore } from './handEvaluator';
import { buildPots, distribute } from './pots';
import { applyBet, isRoundComplete, legalActions } from './betting';
import type { Action, BettingRound, LegalActions, SeatState, Street } from './types';

export type Position = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export type HandConfig = {
  seed: number;
  seats: { id: number; stack: number }[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  /** optional fixed deck (tests); defaults to shuffledDeck(seed) */
  deck?: Card[];
};

export type HandEvent = { type: 'blinds' | 'deal' | 'street' | 'action' | 'showdown' | 'award'; data: unknown };

export type HandResult = { winnings: Record<number, number>; showdown: boolean };

export type HandState = {
  cfg: HandConfig;
  street: Street;
  board: Card[];
  deck: Card[];
  seats: SeatState[];
  round: BettingRound;
  button: number;
  log: { seat: number; action: Action }[];
  initialTotal: number;
  result?: HandResult;
};

export type PlayerView = {
  seat: number;
  hole: Card[];
  board: Card[];
  street: Street;
  pot: number;
  currentBet: number;
  bigBlind: number;
  button: number;
  toAct: number;
  position: Position;
  seats: { id: number; stack: number; committed: number; folded: boolean; allIn: boolean }[];
  legal: LegalActions | null;
};

const ableToAct = (s: SeatState) => !s.folded && !s.allIn;

export function positionOf(n: number, button: number, seat: number): Position {
  const d = (seat - button + n) % n;
  if (d === 0) return 'BTN';
  if (n === 2) return 'BB';
  if (d === 1) return 'SB';
  if (d === 2) return 'BB';
  const fromEnd = n - 1 - d; // 0 = seat just before the button
  if (fromEnd === 0) return 'CO';
  if (fromEnd === 1) return 'MP';
  return 'EP';
}

function firstAble(seats: SeatState[], after: number): number {
  for (let i = 1; i <= seats.length; i++) {
    const idx = (after + i) % seats.length;
    if (ableToAct(seats[idx])) return idx;
  }
  return -1;
}

export function createHand(cfg: HandConfig): HandState {
  const n = cfg.seats.length;
  const deck = (cfg.deck ?? shuffledDeck(cfg.seed)).slice();
  const seats: SeatState[] = cfg.seats.map((s, i) => ({
    id: i, stack: s.stack, committed: 0, totalCommitted: 0, hole: [],
    folded: false, allIn: false, acted: false, raiseLocked: false,
  }));
  for (const s of seats) s.hole = [deck.shift()!, deck.shift()!];

  const sb = n === 2 ? cfg.buttonSeat : (cfg.buttonSeat + 1) % n;
  const bb = n === 2 ? (cfg.buttonSeat + 1) % n : (cfg.buttonSeat + 2) % n;
  const post = (i: number, amt: number) => {
    const s = seats[i];
    const p = Math.min(amt, s.stack);
    s.stack -= p; s.committed += p; s.totalCommitted += p;
    if (s.stack === 0) s.allIn = true;
  };
  post(sb, cfg.smallBlind);
  post(bb, cfg.bigBlind);

  const round: BettingRound = {
    currentBet: cfg.bigBlind,
    lastRaiseSize: cfg.bigBlind,
    toAct: n === 2 ? (ableToAct(seats[sb]) ? sb : firstAble(seats, sb)) : firstAble(seats, bb),
    seats,
    bigBlind: cfg.bigBlind,
  };
  const state: HandState = {
    cfg, street: 'preflop', board: [], deck, seats, round, button: cfg.buttonSeat, log: [],
    initialTotal: cfg.seats.reduce((a, s) => a + s.stack, 0),
  };
  return progress(state, []);
}

function startStreet(state: HandState, street: Street, count: number, events: HandEvent[]): HandState {
  const deck = state.deck.slice();
  const board = state.board.concat(deck.splice(0, count));
  const seats = state.seats.map((s) => ({ ...s, committed: 0, acted: false, raiseLocked: false }));
  events.push({ type: 'street', data: { street, board } });
  return {
    ...state, street, board, deck, seats,
    round: {
      currentBet: 0, lastRaiseSize: state.cfg.bigBlind, bigBlind: state.cfg.bigBlind, seats,
      toAct: firstAble(seats, state.button),
    },
  };
}

function settle(state: HandState, events: HandEvent[]): HandState {
  const live = state.seats.filter((s) => !s.folded);
  const contribs = state.seats.map((s) => ({ seat: s.id, amount: s.totalCommitted, folded: s.folded }));
  const showdown = live.length > 1;
  const scores = new Map<number, HandScore>();
  if (showdown) for (const s of live) scores.set(s.id, evaluate([...s.hole, ...state.board]));
  const win = distribute(buildPots(contribs), scores, state.button, state.seats.length);
  const seats = state.seats.map((s) => ({ ...s, stack: s.stack + (win.get(s.id) ?? 0) }));
  const winnings: Record<number, number> = {};
  for (const [k, v] of win) winnings[k] = v;
  events.push({ type: showdown ? 'showdown' : 'award', data: winnings });
  return { ...state, seats, street: 'done', round: { ...state.round, seats, toAct: -1 }, result: { winnings, showdown } };
}

/** Advance streets / settle until a player must act or the hand is over. */
function progress(state: HandState, events: HandEvent[]): HandState {
  let s = state;
  for (;;) {
    if (s.street === 'done') return s;
    if (s.seats.filter((x) => !x.folded).length === 1) return settle(s, events);
    if (s.round.toAct !== -1 && !isRoundComplete(s.round)) return s;
    const able = s.seats.filter(ableToAct).length;
    if (s.street === 'river') return settle(s, events);
    const next: Street = s.street === 'preflop' ? 'flop' : s.street === 'flop' ? 'turn' : 'river';
    s = startStreet(s, next, next === 'flop' ? 3 : 1, events);
    // with fewer than two players able to bet there is no more action: run the board out
    if (able <= 1) s = { ...s, round: { ...s.round, toAct: -1 } };
  }
}

export function apply(
  state: HandState,
  action: Action,
): { ok: true; state: HandState; events: HandEvent[] } | { ok: false; error: string } {
  if (state.street === 'done') return { ok: false, error: 'hand is over' };
  const seat = state.round.toAct;
  const res = applyBet(state.round, seat, action);
  if (!res.ok) return res;
  const events: HandEvent[] = [{ type: 'action', data: { seat, action } }];
  const next: HandState = {
    ...state, seats: res.round.seats, round: res.round, log: [...state.log, { seat, action }],
  };
  return { ok: true, state: progress(next, events), events };
}

export function legalFor(state: HandState): LegalActions {
  return legalActions(state.round, state.round.toAct);
}

export function playerView(state: HandState, seat: number): PlayerView {
  const n = state.seats.length;
  return {
    seat,
    hole: state.seats[seat].hole,
    board: state.board,
    street: state.street,
    pot: state.seats.reduce((a, s) => a + s.totalCommitted, 0),
    currentBet: state.round.currentBet,
    bigBlind: state.cfg.bigBlind,
    button: state.button,
    toAct: state.round.toAct,
    position: positionOf(n, state.button, seat),
    seats: state.seats.map((s) => ({
      id: s.id, stack: s.stack, committed: s.committed, folded: s.folded, allIn: s.allIn,
    })),
    legal: state.round.toAct === seat && state.street !== 'done' ? legalFor(state) : null,
  };
}

export function finalStacks(state: HandState): Map<number, number> {
  return new Map(state.seats.map((s) => [s.id, s.stack]));
}

/** Returns a description of the first violated invariant, or null. */
export function checkInvariants(state: HandState): string | null {
  const stacks = state.seats.reduce((a, s) => a + s.stack, 0);
  const committed = state.seats.reduce((a, s) => a + s.totalCommitted, 0);
  const total = state.street === 'done' ? stacks : stacks + committed;
  if (total !== state.initialTotal) return `chips ${total} != initial ${state.initialTotal}`;
  if (state.seats.some((s) => s.stack < 0)) return 'negative stack';
  return null;
}
