import { evaluate } from '../engine/handEvaluator';
import { chenScore, handClass } from '../engine/handClass';
import type { PlayerView } from '../engine/hand';
import type { Action } from '../engine/types';
import { preflopRange, type BotStyle } from './ranges';

export type { BotStyle };

const PREMIUM = 12;
const RAISE_PROB: Record<BotStyle, number> = { tight: 0.7, loose: 0.4, aggressive: 0.9 };
const BLUFF_PROB: Record<BotStyle, number> = { tight: 0.03, loose: 0.08, aggressive: 0.2 };
const CALL_LIMIT: Record<BotStyle, number> = { tight: 0.3, loose: 0.45, aggressive: 0.38 };

/** Raise (or bet) to `target`, clamped to the legal range; falls back to call/check. */
function raiseTo(view: PlayerView, target: number): Action {
  const legal = view.legal!;
  if (!legal.canRaise) return passive(view);
  const amount = Math.max(legal.minRaiseTo, Math.min(Math.round(target), legal.maxRaiseTo));
  return { type: view.currentBet === 0 ? 'bet' : 'raise', amount };
}

function passive(view: PlayerView): Action {
  return view.legal!.canCheck ? { type: 'check' } : { type: 'call' };
}

function checkOrFold(view: PlayerView): Action {
  return view.legal!.canCheck ? { type: 'check' } : { type: 'fold' };
}

function preflop(view: PlayerView, style: BotStyle, rng: () => number): Action {
  const legal = view.legal!;
  const score = chenScore(view.hole);
  const inRange = preflopRange(style, view.position).has(handClass(view.hole));
  const unopened = view.currentBet <= view.bigBlind;
  const stack = view.seats[view.seat].stack + view.seats[view.seat].committed;

  if (!inRange) return checkOrFold(view);
  if (score >= PREMIUM) return raiseTo(view, unopened ? view.bigBlind * 3 : view.currentBet * 3);
  if (unopened) {
    if (rng() < RAISE_PROB[style]) return raiseTo(view, view.bigBlind * 3);
    return passive(view);
  }
  // facing a raise with a non-premium hand: call only if cheap relative to the stack
  if (legal.callAmount <= stack * 0.15) return { type: 'call' };
  return checkOrFold(view);
}

type Strength = 'strong' | 'medium' | 'draw' | 'air';

function assess(view: PlayerView): Strength {
  const all = [...view.hole, ...view.board];
  const score = evaluate(all);
  if (score.category >= 2) return 'strong';
  if (score.category === 1) {
    const boardMax = Math.max(...view.board.map((c) => c.rank));
    return score.tiebreak[0] >= boardMax && view.hole.some((c) => c.rank === score.tiebreak[0]) ? 'medium' : 'air';
  }
  const bySuit = new Map<string, number>();
  for (const c of all) bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1);
  const flushDraw = view.board.length < 5 && view.hole.some((h) => (bySuit.get(h.suit) ?? 0) >= 4);
  return flushDraw ? 'draw' : 'air';
}

function postflop(view: PlayerView, style: BotStyle, rng: () => number): Action {
  const legal = view.legal!;
  const strength = assess(view);
  const needed = legal.callAmount / (view.pot + legal.callAmount || 1);
  const facing = legal.callAmount > 0;

  if (strength === 'strong') {
    return rng() < 0.85 ? raiseTo(view, view.currentBet + view.pot * 0.66) : passive(view);
  }
  if (strength === 'medium') {
    if (!facing) return rng() < RAISE_PROB[style] * 0.5 ? raiseTo(view, view.pot * 0.5) : { type: 'check' };
    return needed <= CALL_LIMIT[style] ? { type: 'call' } : { type: 'fold' };
  }
  if (strength === 'draw') {
    if (!facing) return rng() < BLUFF_PROB[style] * 3 ? raiseTo(view, view.pot * 0.5) : { type: 'check' };
    return needed <= 0.3 ? { type: 'call' } : { type: 'fold' };
  }
  if (!facing) return rng() < BLUFF_PROB[style] ? raiseTo(view, view.pot * 0.5) : { type: 'check' };
  return { type: 'fold' };
}

/** Only legal actions are returned; `view.legal` must be non-null (it is the bot's turn). */
export function decide(view: PlayerView, style: BotStyle, rng: () => number): Action {
  if (!view.legal) throw new Error('decide called when it is not the bot\'s turn');
  return view.street === 'preflop' ? preflop(view, style, rng) : postflop(view, style, rng);
}
