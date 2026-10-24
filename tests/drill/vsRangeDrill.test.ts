import { vsRangeDrill } from '../../src/drill/modules/vsRangeDrill';
import {
  callersAfter, isInPosition, openingCombos, rangeShare, type HeroPos, type OpenerPos,
} from '../../src/drill/postflop';
import { evCall } from '../../src/drill/oddsMath';
import { cardToString, parseCard, type Card } from '../../src/engine/cards';
import { mulberry32, shuffledDeck } from '../../src/engine/deck';
import { compareScores, evaluate } from '../../src/engine/handEvaluator';
import type { Question } from '../../src/drill/types';

type Sc = {
  villain: OpenerPos; hero: HeroPos; inPosition: boolean; hole: Card[]; board: Card[];
  potBefore: number; bet: number; filter: 'whole' | 'beatsBoard';
};
const gen = (level: number, seed: number) => vsRangeDrill.generate(mulberry32(seed), level);

/** independent computation written separately from the implementation */
function reference(sc: Sc): { equity: number; combos: number } {
  const dead = new Set([...sc.hole, ...sc.board].map(cardToString));
  let sum = 0;
  let n = 0;
  let combos = 0;
  for (const villain of openingCombos(sc.villain)) {
    if (villain.some((c) => dead.has(cardToString(c)))) continue;
    if (sc.filter === 'beatsBoard' && !(evaluate([...sc.board, ...villain]).category > evaluate(sc.board).category)) continue;
    combos++;
    const gone = new Set([...dead, ...villain.map(cardToString)]);
    const runouts = sc.board.length === 5 ? [[]] : shuffledDeck(0).filter((c) => !gone.has(cardToString(c))).map((c) => [c]);
    for (const extra of runouts) {
      const full = [...sc.board, ...extra];
      const cmp = compareScores(evaluate([...sc.hole, ...full]), evaluate([...villain, ...full]));
      sum += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
      n++;
    }
  }
  return { equity: n ? sum / n : 0, combos };
}

describe('vsrange positions and prompt', () => {
  it('hero acts after the villain preflop and inPosition follows the postflop order', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 300; seed++) {
        const sc = gen(level, seed).scenario as Sc;
        expect(callersAfter(sc.villain)).toContain(sc.hero);
        expect(sc.inPosition).toBe(isInPosition(sc.hero, sc.villain));
      }
    }
  });
  it('every valid opener and caller pair appears over many seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 1500; seed++) {
      const sc = gen(1, seed).scenario as Sc;
      seen.add(`${sc.villain}:${sc.hero}`);
    }
    const expected = (['EP', 'MP', 'CO', 'BTN', 'SB'] as OpenerPos[]).flatMap((v) => callersAfter(v).map((h) => `${v}:${h}`));
    expect(seen).toEqual(new Set(expected));
  });
  it('the prompt states both positions, in or out of position, the range share and the no-more-betting assumption', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const q = gen(1 + (seed % 2), seed);
      const sc = q.scenario as Sc;
      expect(q.prompt).toContain(sc.villain);
      expect(q.prompt).toContain(sc.hero);
      expect(q.prompt).toContain(sc.inPosition ? 'in position' : 'out of position');
      expect(q.prompt).toContain(`${(rangeShare(sc.villain) * 100).toFixed(1)}%`);
      expect(q.prompt.toLowerCase()).toContain('no further betting');
      expect(q.prompt).toContain(String(sc.bet));
    }
  });
  it('an out-of-position hero checks first and an in-position hero just faces the bet', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = gen(1, seed);
      const sc = q.scenario as Sc;
      expect(/You check/.test(q.prompt)).toBe(!sc.inPosition);
    }
  });
});

describe('vsrange questions', () => {
  it('use a turn or river board with distinct cards, and both streets appear', () => {
    const streets = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = gen(1 + (seed % 2), seed);
      const sc = q.scenario as Sc;
      expect([4, 5]).toContain(sc.board.length);
      const all = [...sc.hole, ...sc.board].map(cardToString);
      expect(new Set(all).size).toBe(all.length);
      streets.add(sc.board.length === 4 ? 'turn' : 'river');
      expect(q.key).toBe(`vsrange:L${q.level}:${sc.villain}:${sc.hero}:${sc.board.length === 4 ? 'turn' : 'river'}`);
    }
    expect(streets).toEqual(new Set(['turn', 'river']));
  });
  it('the bet is 50%, 75% or 100% of the pot', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const sc = gen(1, seed).scenario as Sc;
      const ratio = sc.bet / sc.potBefore;
      expect([0.5, 0.75, 1].some((f) => Math.abs(ratio - f) < 0.05)).toBe(true);
    }
  });
  it('every generated question has at least 15 villain combinations under its own filter', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 400; seed++) {
        const sc = gen(level, seed).scenario as Sc;
        expect(reference(sc).combos).toBeGreaterThanOrEqual(15);
      }
    }
  });
  it('level 1 never filters; level 2 filters unless it had to fall back, and then narrows the range', () => {
    let filtered = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s1 = gen(1, seed).scenario as Sc;
      expect(s1.filter).toBe('whole');
      const s2 = gen(2, seed).scenario as Sc;
      if (s2.filter === 'beatsBoard') {
        filtered++;
        expect(reference(s2).combos).toBeLessThanOrEqual(reference({ ...s2, filter: 'whole' }).combos);
      }
    }
    expect(filtered).toBeGreaterThan(160);
  });
});

describe('vsrange grading', () => {
  it('equals an independent computation for 20 questions at each level', () => {
    for (const level of [1, 2]) {
      for (let seed = 1; seed <= 20; seed++) {
        const q = gen(level, seed * 7);
        const sc = q.scenario as Sc;
        const { equity } = reference(sc);
        const ev = evCall(equity, sc.potBefore + sc.bet, sc.bet);
        const call = vsRangeDrill.grade(q, 'call');
        const fold = vsRangeDrill.grade(q, 'fold');
        expect(call.ev!.chosen).toBeCloseTo(ev, 8);
        expect(call.ev).toEqual({ chosen: call.ev!.chosen, best: Math.max(ev, 0), unit: 'chips' });
        expect(fold.ev).toEqual({ chosen: 0, best: Math.max(ev, 0), unit: 'chips' });
        expect(call.correct).toBe(ev > 0);
        expect(fold.correct).toBe(ev <= 0);
      }
    }
  });
  it('is exact, never borderline, and its explanation states the assumptions honestly', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const q = gen(1 + (seed % 2), seed);
      const g = vsRangeDrill.grade(q, 'call');
      expect(g.certainty).toBe('exact');
      expect(g.borderline).toBe(false);
      expect(g.explanation).toMatch(/guideline/i);
      expect(g.explanation).toMatch(/no further betting/i);
      expect(g.explanation).toMatch(/position does not change/i);
    }
  });
  it('a hand-built question with no villain combinations is graded correct with a cannot-be-graded note', () => {
    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'].map(parseCard);
    const sc: Sc = {
      villain: 'BTN', hero: 'BB', inPosition: false, hole: ['2c', '3d'].map(parseCard), board,
      potBefore: 100, bet: 50, filter: 'beatsBoard',
    };
    const q: Question = { type: 'vsrange', level: 2, key: 'vsrange:L2:BTN:BB:river', prompt: '', options: [], scenario: sc };
    for (const answer of ['call', 'fold']) {
      const g = vsRangeDrill.grade(q, answer);
      expect(g.correct).toBe(true);
      expect(g.explanation).toMatch(/cannot be graded/i);
    }
  });
  it('declares its id, two levels and call/fold options', () => {
    expect(vsRangeDrill.id).toBe('vsrange');
    expect(vsRangeDrill.levels).toBe(2);
    expect(gen(1, 3).options.map((o) => o.value)).toEqual(['call', 'fold']);
    expect(gen(2, 11)).toEqual(gen(2, 11));
  });
});
