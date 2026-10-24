import type { Card } from './cards';

export type Action = {
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  /** total bet-to for this street; all-in when equal to committed + stack */
  amount?: number;
};

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'done';

export type SeatState = {
  id: number;
  stack: number;
  committed: number;
  totalCommitted: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  acted: boolean;
  raiseLocked: boolean;
};

export type BettingRound = {
  currentBet: number;
  lastRaiseSize: number;
  /** seat to act, or -1 when the round is complete */
  toAct: number;
  seats: SeatState[];
  bigBlind: number;
};

export type LegalActions = {
  canCheck: boolean;
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canRaise: boolean;
};
