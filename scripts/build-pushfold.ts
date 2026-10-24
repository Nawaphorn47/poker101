// One-off build script: computes the heads-up push/fold Nash tables and writes
// src/drill/data/pushFold.json. Run with `npm run build:pushfold` (several minutes).
// The class-vs-class equity matrix is cached in .cache/ so re-solving is quick.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ALL_CLASSES } from '../src/engine/handClass';
import { compareScores, evaluate } from '../src/engine/handEvaluator';
import { mulberry32 } from '../src/engine/deck';
import { solvePushFold } from '../src/drill/pushFoldSolver';
import type { Card, Suit } from '../src/engine/cards';

const SAMPLES = 2500;
const SEED = 20261024;
const STACKS = Array.from({ length: 14 }, (_, i) => i + 2);
const LETTERS = '23456789TJQKA';
const SUITS: Suit[] = ['c', 'd', 'h', 's'];
const CACHE = '.cache/pushfold-equity.json';

const deck: Card[] = [];
for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
const idx = (rank: number, suit: number) => suit * 13 + (rank - 2);

function combosOf(name: string): [number, number][] {
  const r1 = LETTERS.indexOf(name[0]) + 2;
  const r2 = LETTERS.indexOf(name[1]) + 2;
  const out: [number, number][] = [];
  if (name.length === 2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([idx(r1, a), idx(r2, b)]);
  } else if (name[2] === 's') {
    for (let s = 0; s < 4; s++) out.push([idx(r1, s), idx(r2, s)]);
  } else {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([idx(r1, a), idx(r2, b)]);
  }
  return out;
}

function matchup(ci: [number, number][], cj: [number, number][], rng: () => number): number {
  let total = 0;
  const rest: number[] = new Array(48);
  for (let n = 0; n < SAMPLES; n++) {
    const a = ci[Math.floor(rng() * ci.length)];
    let b: [number, number];
    do b = cj[Math.floor(rng() * cj.length)];
    while (b[0] === a[0] || b[0] === a[1] || b[1] === a[0] || b[1] === a[1]);
    let k = 0;
    for (let c = 0; c < 52; c++) if (c !== a[0] && c !== a[1] && c !== b[0] && c !== b[1]) rest[k++] = c;
    for (let m = 0; m < 5; m++) {
      const j = m + Math.floor(rng() * (48 - m));
      [rest[m], rest[j]] = [rest[j], rest[m]];
    }
    const board = [deck[rest[0]], deck[rest[1]], deck[rest[2]], deck[rest[3]], deck[rest[4]]];
    const sa = evaluate([deck[a[0]], deck[a[1]], ...board]);
    const sb = evaluate([deck[b[0]], deck[b[1]], ...board]);
    const cmp = compareScores(sa, sb);
    total += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
  }
  return total / SAMPLES;
}

function equityMatrix(names: string[]): number[][] {
  if (existsSync(CACHE)) {
    console.log(`using cached equity matrix ${CACHE}`);
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  const n = names.length;
  const combos = names.map(combosOf);
  const rng = mulberry32(SEED);
  const eq = Array.from({ length: n }, () => new Array<number>(n).fill(0.5));
  const started = Date.now();
  let done = 0;
  const totalPairs = (n * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const e = matchup(combos[i], combos[j], rng);
      eq[i][j] = e;
      eq[j][i] = 1 - e;
      if (++done % 1000 === 0)
        console.log(`pairs ${done}/${totalPairs}  ${Math.round((Date.now() - started) / 1000)}s elapsed`);
    }
  }
  mkdirSync('.cache', { recursive: true });
  writeFileSync(CACHE, JSON.stringify(eq));
  return eq;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

const names = ALL_CLASSES.map((c) => c.name);
const weights = names.map((n) => (n.length === 2 ? 6 : n.endsWith('s') ? 4 : 12));
const equity = equityMatrix(names);

const stacks: Record<string, unknown> = {};
for (const stack of STACKS) {
  const r = solvePushFold({ equity, weights, stack });
  const evPush: Record<string, number> = {};
  const evCall: Record<string, number> = {};
  names.forEach((n, i) => {
    evPush[n] = round3(r.evPush[i]);
    evCall[n] = round3(r.evCall[i]);
  });
  stacks[String(stack)] = {
    push: names.filter((_, i) => r.push[i]),
    call: names.filter((_, i) => r.call[i]),
    evPush,
    evCall,
  };
  const pushPct = (names.reduce((a, _n, i) => a + (r.push[i] ? weights[i] : 0), 0) / 1326) * 100;
  console.log(`stack ${stack}: push ${pushPct.toFixed(1)}% of combos`);
}

writeFileSync(
  'src/drill/data/pushFold.json',
  JSON.stringify({ version: 1, samplesPerPair: SAMPLES, seed: SEED, stacks }),
);
console.log('wrote src/drill/data/pushFold.json');
