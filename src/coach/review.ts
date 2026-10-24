import type { Action } from '../engine/types';
import type { HandLog } from '../engine/handLog';
import { apply, createHand, playerView } from '../engine/hand';
import { mulberry32 } from '../engine/deck';
import { equity } from './equity';
import { potOdds } from './potOdds';

export type ReviewItem = {
  /** index into the hand log's action list */
  step: number;
  seat: number;
  action: Action;
  flag: 'ok' | 'questionable';
  reason: string;
  equity: number;
};

const REVIEW_SAMPLES = 1000;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Replays the hand and grades each decision of the human seat by equity against pot odds. */
export function reviewHand(log: HandLog): ReviewItem[] {
  let state = createHand({
    seed: log.seed, seats: log.seats, buttonSeat: log.button, smallBlind: log.blinds.sb, bigBlind: log.blinds.bb,
  });
  const items: ReviewItem[] = [];
  log.actions.forEach((entry, step) => {
    if (entry.seat === log.humanSeat) {
      const view = playerView(state, entry.seat);
      const opponents = state.seats.filter((s) => !s.folded && s.id !== entry.seat).length;
      const eq = equity(view.hole, view.board, opponents, REVIEW_SAMPLES, mulberry32(log.seed + step));
      const call = view.legal?.callAmount ?? 0;
      const needed = potOdds(call, view.pot);
      let flag: ReviewItem['flag'] = 'ok';
      let reason = '';
      if (entry.action.type === 'fold' && call === 0) {
        flag = 'questionable'; reason = 'Folded when checking was free.';
      } else if (entry.action.type === 'fold' && eq > needed + 0.15) {
        flag = 'questionable';
        reason = `Folded with ${pct(eq)} equity; the pot odds only required ${pct(needed)}.`;
      } else if (entry.action.type === 'call' && eq < needed - 0.02) {
        flag = 'questionable';
        reason = `Called with ${pct(eq)} equity; the pot odds required ${pct(needed)}.`;
      }
      items.push({ step, seat: entry.seat, action: entry.action, flag, reason, equity: eq });
    }
    const r = apply(state, entry.action);
    if (!r.ok) throw new Error(`log replay failed at step ${step}: ${r.error}`);
    state = r.state;
  });
  return items;
}
