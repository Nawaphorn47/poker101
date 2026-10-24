import type { Card } from '../engine/cards';
import type { Position } from '../engine/hand';
import { chenScore } from '../engine/handClass';
import { openMin, preflopAdvice, PREMIUM_SCORE, type PreflopAdvice } from '../coach/preflopChart';

export type PreflopAction = PreflopAdvice;

/** Where preflop answers come from; a user-supplied source can replace the built-in one later. */
export interface RangeSource {
  advise(hole: Card[], position: Position, facing: 'none' | 'raise'): { best: PreflopAction; acceptable: PreflopAction[] };
}

/** The same table the in-game hint uses. A hand within 1 Chen point of a boundary also accepts the neighbouring action. */
export const builtInRanges: RangeSource = {
  advise(hole, position, facing) {
    const score = chenScore(hole);
    const best = preflopAdvice(hole, position, facing);
    const near = (threshold: number) => Math.abs(score - threshold) <= 1;
    const acceptable = new Set<PreflopAction>([best]);
    if (facing === 'none') {
      if (near(openMin(position))) acceptable.add(best === 'raise' ? 'fold' : 'raise');
    } else {
      const callLine = openMin(position) + 2;
      if (best === 'fold' && near(callLine)) acceptable.add('call');
      if (best === 'call') {
        if (near(callLine)) acceptable.add('fold');
        if (near(PREMIUM_SCORE)) acceptable.add('raise');
      }
      if (best === 'raise' && near(PREMIUM_SCORE)) acceptable.add('call');
    }
    return { best, acceptable: [...acceptable] };
  },
};
