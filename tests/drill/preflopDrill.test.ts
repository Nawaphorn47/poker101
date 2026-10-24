import { builtInRanges, type RangeSource } from '../../src/drill/rangeSource';
import { preflopDrill, makePreflopDrill } from '../../src/drill/modules/preflopDrill';
import { openMin, PREMIUM_SCORE } from '../../src/coach/preflopChart';
import { ALL_CLASSES, handClass } from '../../src/engine/handClass';
import { parseCard, type Card } from '../../src/engine/cards';
import { mulberry32 } from '../../src/engine/deck';
import type { Position } from '../../src/engine/hand';

const POSITIONS: Position[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];

/** concrete cards for a class name such as AA, AKs, T9o */
const holeFor = (name: string): Card[] => {
  if (name.length === 2) return [parseCard(name[0] + 's'), parseCard(name[1] + 'h')];
  return [parseCard(name[0] + 's'), parseCard(name[1] + (name[2] === 's' ? 's' : 'h'))];
};
const classWithScore = (score: number) => ALL_CLASSES.find((c) => c.score === score)!.name;
const question = (hole: Card[], position: Position, facing: 'none' | 'raise') => ({
  type: 'preflop' as const, level: 1, key: 'k', prompt: '', options: [],
  scenario: { hole, position, facing },
});

describe('builtInRanges', () => {
  it('AA raises from every position facing either situation', () => {
    for (const pos of POSITIONS)
      for (const facing of ['none', 'raise'] as const)
        expect(builtInRanges.advise(holeFor('AA'), pos, facing).best).toBe('raise');
  });
  it('72o from EP with nobody raising is a clear fold', () => {
    const a = builtInRanges.advise(holeFor('72o'), 'EP', 'none');
    expect(a.best).toBe('fold');
    expect(a.acceptable).toEqual(['fold']);
  });
  it('one point above the open threshold raises and also accepts fold; two points above raises only', () => {
    const one = builtInRanges.advise(holeFor(classWithScore(openMin('EP') + 1)), 'EP', 'none');
    expect(one.best).toBe('raise');
    expect(one.acceptable).toContain('fold');
    const two = builtInRanges.advise(holeFor(classWithScore(openMin('EP') + 2)), 'EP', 'none');
    expect(two.acceptable).toEqual(['raise']);
  });
  it('one point below the open threshold folds and also accepts raise', () => {
    const a = builtInRanges.advise(holeFor(classWithScore(openMin('MP') - 1)), 'MP', 'none');
    expect(a.best).toBe('fold');
    expect(a.acceptable).toContain('raise');
  });
  it('within one point of the premium score facing a raise: call is accepted next to raise', () => {
    const a = builtInRanges.advise(holeFor(classWithScore(PREMIUM_SCORE)), 'BTN', 'raise');
    expect(a.best).toBe('raise');
    expect(a.acceptable).toContain('call');
  });
});

describe('preflopDrill grading', () => {
  it('a clear raise answered with a limp is incorrect', () => {
    const g = preflopDrill.grade(question(holeFor('AA'), 'BTN', 'none'), 'call');
    expect(g.correct).toBe(false);
  });
  it('an acceptable non-best answer is correct and borderline', () => {
    const hole = holeFor(classWithScore(openMin('EP') + 1));
    const g = preflopDrill.grade(question(hole, 'EP', 'none'), 'fold');
    expect(g.correct).toBe(true);
    expect(g.borderline).toBe(true);
  });
  it('the best answer is correct and not borderline', () => {
    const g = preflopDrill.grade(question(holeFor('AA'), 'BTN', 'none'), 'raise');
    expect(g.correct).toBe(true);
    expect(g.borderline).toBe(false);
  });
  it('is approximate, carries no ev, and says it is a guideline', () => {
    const g = preflopDrill.grade(question(holeFor('AA'), 'BTN', 'none'), 'raise');
    expect(g.certainty).toBe('approximate');
    expect(g.ev).toBeUndefined();
    expect(g.explanation).toMatch(/guideline/i);
  });
  it('accepts a custom RangeSource', () => {
    const alwaysFold: RangeSource = { advise: () => ({ best: 'fold', acceptable: ['fold'] }) };
    const drill = makePreflopDrill(alwaysFold);
    expect(drill.grade(question(holeFor('AA'), 'BTN', 'none'), 'fold').correct).toBe(true);
  });
});

describe('preflopDrill generation', () => {
  it('yields two distinct valid cards and a key whose hand class matches', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const q = preflopDrill.generate(mulberry32(seed), 1);
      const { hole, position, facing } = q.scenario as { hole: Card[]; position: Position; facing: string };
      expect(hole).toHaveLength(2);
      expect(hole[0].rank + hole[0].suit).not.toBe(hole[1].rank + hole[1].suit);
      expect(q.key).toBe(`preflop:${position}:${facing}:${handClass(hole)}`);
      expect(q.options.map((o) => o.value)).toEqual(['fold', 'call', 'raise']);
    }
  });
  it('declares type preflop, one level', () => {
    expect(preflopDrill.id).toBe('preflop');
    expect(preflopDrill.levels).toBe(1);
  });
});
