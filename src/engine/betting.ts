import type { Action, BettingRound, LegalActions, SeatState } from './types';

const canAct = (s: SeatState) => !s.folded && !s.allIn;

export function legalActions(round: BettingRound, seat: number): LegalActions {
  const s = round.seats[seat];
  const callAmount = Math.min(Math.max(round.currentBet - s.committed, 0), s.stack);
  const maxRaiseTo = s.committed + s.stack;
  const base = round.currentBet === 0 ? round.bigBlind : round.currentBet + round.lastRaiseSize;
  return {
    canCheck: s.committed >= round.currentBet,
    callAmount,
    minRaiseTo: Math.min(base, maxRaiseTo),
    maxRaiseTo,
    canRaise: !s.raiseLocked && s.stack > Math.max(round.currentBet - s.committed, 0),
  };
}

function nextToAct(seats: SeatState[], currentBet: number, from: number): number {
  for (let i = 1; i <= seats.length; i++) {
    const idx = (from + i) % seats.length;
    const s = seats[idx];
    if (canAct(s) && (!s.acted || s.committed < currentBet)) return idx;
  }
  return -1;
}

export function isRoundComplete(round: BettingRound): boolean {
  const live = round.seats.filter((s) => !s.folded);
  if (live.length <= 1) return true;
  const able = live.filter((s) => !s.allIn);
  if (able.length === 0) return true;
  if (able.length === 1 && able[0].committed >= round.currentBet) return true;
  return able.every((s) => s.acted && s.committed >= round.currentBet);
}

export function applyBet(
  round: BettingRound,
  seat: number,
  action: Action,
): { ok: true; round: BettingRound } | { ok: false; error: string } {
  if (round.toAct !== seat) return { ok: false, error: 'not your turn' };
  const legal = legalActions(round, seat);
  const seats = round.seats.map((s) => ({ ...s }));
  const me = seats[seat];
  let { currentBet, lastRaiseSize } = round;

  const pay = (n: number) => {
    me.stack -= n;
    me.committed += n;
    me.totalCommitted += n;
    if (me.stack === 0) me.allIn = true;
  };

  switch (action.type) {
    case 'fold':
      me.folded = true;
      break;
    case 'check':
      if (!legal.canCheck) return { ok: false, error: 'cannot check facing a bet' };
      me.acted = true;
      break;
    case 'call':
      if (legal.callAmount === 0) return { ok: false, error: 'nothing to call' };
      pay(legal.callAmount);
      me.acted = true;
      break;
    case 'bet':
    case 'raise': {
      const amount = action.amount;
      if (amount === undefined) return { ok: false, error: 'amount required' };
      if ((action.type === 'bet') !== (currentBet === 0)) return { ok: false, error: `use ${currentBet === 0 ? 'bet' : 'raise'}` };
      if (!legal.canRaise) return { ok: false, error: 'raising not allowed' };
      if (amount > legal.maxRaiseTo) return { ok: false, error: 'amount exceeds stack' };
      if (amount < legal.minRaiseTo) return { ok: false, error: 'below minimum raise' };
      pay(amount - me.committed);
      const increase = amount - currentBet;
      const full = increase >= lastRaiseSize;
      for (const s of seats) {
        if (s === me || !canAct(s)) continue;
        if (full) s.raiseLocked = false;
        else if (s.acted) s.raiseLocked = true;
        s.acted = false;
      }
      if (full) lastRaiseSize = increase;
      currentBet = amount;
      me.acted = true;
      break;
    }
  }

  const next: BettingRound = { ...round, seats, currentBet, lastRaiseSize, toAct: -1 };
  next.toAct = isRoundComplete(next) ? -1 : nextToAct(seats, currentBet, seat);
  return { ok: true, round: next };
}
