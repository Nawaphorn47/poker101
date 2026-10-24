import { ALL_CLASSES } from '../engine/handClass';
import type { Position } from '../engine/hand';

export type BotStyle = 'tight' | 'loose' | 'aggressive';

/** Minimum Chen score to enter the pot, by position (before the style shift). */
const BASE: Record<Position, number> = { EP: 9, MP: 8, CO: 7, BTN: 6, SB: 7, BB: 5 };
const SHIFT: Record<BotStyle, number> = { tight: 2, loose: -2, aggressive: -1 };

export function minScore(style: BotStyle, position: Position): number {
  return BASE[position] + SHIFT[style];
}

export function preflopRange(style: BotStyle, position: Position): Set<string> {
  const min = minScore(style, position);
  return new Set(ALL_CLASSES.filter((c) => c.score >= min).map((c) => c.name));
}
