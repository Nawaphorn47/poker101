import { ALL_CLASSES } from '../engine/handClass';
import { pushFoldRow } from '../drill/pushFoldData';

export type ChartCell = {
  name: string;
  /** 0..12 with A = 0 */
  row: number;
  col: number;
  action: 'push' | 'call' | 'fold';
  /** EV in bb of pushing (sb) or calling (bb) */
  ev: number;
  /** EV in bb of folding: -0.5 for the small blind, -1 for the big blind */
  foldEv: number;
  /** the two actions are within 0.1bb of each other */
  borderline: boolean;
};

export type Chart = { cells: ChartCell[]; pct: number; role: 'sb' | 'bb'; stack: number };

const LETTERS = '23456789TJQKA';
const rankIndex = (letter: string) => 14 - (LETTERS.indexOf(letter) + 2); // A = 0 ... 2 = 12
const combos = (name: string) => (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12);
const TOTAL_COMBOS = 1326;

/** Heads-up push/fold chart: pairs on the diagonal, suited above it, offsuit below. Throws for stacks outside 2-15. */
export function chartFor(stack: number, role: 'sb' | 'bb'): Chart {
  const data = pushFoldRow(stack);
  const range = role === 'sb' ? data.push : data.call;
  const evs = role === 'sb' ? data.evPush : data.evCall;
  const foldEv = role === 'sb' ? -0.5 : -1;
  let inRange = 0;
  const cells = ALL_CLASSES.map(({ name }): ChartCell => {
    const hi = rankIndex(name[0]);
    const lo = rankIndex(name[1]);
    const suited = name.endsWith('s');
    const [row, col] = name.length === 2 ? [hi, hi] : suited ? [hi, lo] : [lo, hi];
    const inIt = range.includes(name);
    if (inIt) inRange += combos(name);
    return {
      name, row, col,
      action: inIt ? (role === 'sb' ? 'push' : 'call') : 'fold',
      ev: evs[name],
      foldEv,
      borderline: Math.abs(evs[name] - foldEv) < 0.1,
    };
  });
  return { cells, pct: (inRange / TOTAL_COMBOS) * 100, role, stack };
}
