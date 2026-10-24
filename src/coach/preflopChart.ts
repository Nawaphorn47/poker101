import type { Card } from '../engine/cards';
import { chenScore } from '../engine/handClass';
import type { Position } from '../engine/hand';

/** Minimum Chen score to open-raise by position. */
const OPEN_MIN: Record<Position, number> = { EP: 9, MP: 8, CO: 7, BTN: 6, SB: 7, BB: 5 };
export const PREMIUM_SCORE = 12;

export type PreflopAdvice = 'fold' | 'call' | 'raise';

/** Minimum Chen score to open-raise from `position`. */
export function openMin(position: Position): number {
  return OPEN_MIN[position];
}

export function preflopAdvice(hole: Card[], position: Position, facing: 'none' | 'raise'): PreflopAdvice {
  const score = chenScore(hole);
  if (score >= PREMIUM_SCORE) return 'raise';
  if (facing === 'none') return score >= OPEN_MIN[position] ? 'raise' : 'fold';
  return score >= OPEN_MIN[position] + 2 ? 'call' : 'fold';
}
