import type { PlayerView } from '../engine/hand';
import type { LegalActions } from '../engine/types';
import { potOdds } from './potOdds';
import { preflopAdvice, type PreflopAdvice } from './preflopChart';

export type Hint = { potOdds: number | null; equity: number; preflop?: PreflopAdvice; text: string };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function hint(view: PlayerView, legal: LegalActions, equityValue: number): Hint {
  const needed = legal.callAmount > 0 ? potOdds(legal.callAmount, view.pot) : null;
  const parts: string[] = [`Equity about ${pct(equityValue)}.`];
  let preflop: PreflopAdvice | undefined;
  if (needed !== null) {
    parts.push(
      equityValue >= needed
        ? `Pot odds need ${pct(needed)}: a call is profitable.`
        : `Pot odds need ${pct(needed)}: a call loses money on average.`,
    );
  }
  if (view.street === 'preflop') {
    preflop = preflopAdvice(view.hole, view.position, view.currentBet > view.bigBlind ? 'raise' : 'none');
    parts.push(`Chart suggestion from ${view.position}: ${preflop}.`);
  }
  return { potOdds: needed, equity: equityValue, preflop, text: parts.join(' ') };
}
