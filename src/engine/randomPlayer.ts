import { legalFor, type HandState } from './hand';
import type { Action } from './types';

/** Picks a uniformly random legal action; used by tests and simulations. */
export function randomLegalAction(state: HandState, rng: () => number): Action {
  const legal = legalFor(state);
  const roll = rng();
  if (legal.canRaise && roll < 0.3) {
    const amount = legal.minRaiseTo + Math.floor(rng() * (legal.maxRaiseTo - legal.minRaiseTo + 1));
    return { type: state.round.currentBet === 0 ? 'bet' : 'raise', amount };
  }
  if (legal.canCheck) return { type: 'check' };
  if (roll < 0.65) return { type: 'call' };
  return { type: 'fold' };
}
