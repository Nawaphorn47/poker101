import { apply, createHand } from '../engine/hand';
import type { HandLog } from '../engine/handLog';
import type { DrillResult } from './db';

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const idx = (x: unknown, len: number): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < len;
const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise'];
const DRILL_TYPES = ['odds', 'preflop', 'pushfold', 'madehand', 'outs', 'vsrange'];

/** Shape check for a stored or imported drill result. */
export function isValidDrillResult(x: any): x is DrillResult {
  return (
    !!x && typeof x.id === 'string' && DRILL_TYPES.includes(x.type) && num(x.level) &&
    typeof x.key === 'string' && x.key.length > 0 && typeof x.correct === 'boolean' &&
    typeof x.borderline === 'boolean' && num(x.timestamp) && (x.evLoss === undefined || num(x.evLoss))
  );
}

/**
 * True only for a hand log that is well formed AND replays cleanly through the engine,
 * so that stats and review can never meet a record they cannot process.
 */
export function isValidHandLog(h: any): h is HandLog {
  try {
    if (!h || typeof h.id !== 'string' || !num(h.seed) || (h.mode !== 'cash' && h.mode !== 'tournament')) return false;
    if (!Array.isArray(h.seats) || h.seats.length < 2) return false;
    if (!h.seats.every((s: any) => s && num(s.id) && num(s.stack) && s.stack > 0)) return false;
    const n = h.seats.length;
    if (!idx(h.button, n) || !idx(h.humanSeat, n)) return false;
    if (!h.blinds || !num(h.blinds.sb) || !num(h.blinds.bb) || h.blinds.sb <= 0 || h.blinds.bb <= 0) return false;
    if (typeof h.usedHint !== 'boolean' || !num(h.netBb) || !num(h.timestamp)) return false;
    if (!Array.isArray(h.actions)) return false;
    for (const e of h.actions) {
      if (!e || !idx(e.seat, n) || !e.action || !ACTIONS.includes(e.action.type)) return false;
      if (e.action.amount !== undefined && !num(e.action.amount)) return false;
    }
    let state = createHand({
      seed: h.seed, seats: h.seats, buttonSeat: h.button, smallBlind: h.blinds.sb, bigBlind: h.blinds.bb,
    });
    for (const e of h.actions) {
      const r = apply(state, e.action);
      if (!r.ok) return false;
      state = r.state;
    }
    return true;
  } catch {
    return false;
  }
}
