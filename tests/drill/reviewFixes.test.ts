import { nextCardEquity, outsEquity, ruleOfEstimate } from '../../src/drill/oddsMath';
import { oddsDrill } from '../../src/drill/modules/oddsDrill';
import { preflopDrill } from '../../src/drill/modules/preflopDrill';
import { pushFoldDrill } from '../../src/drill/modules/pushFoldDrill';
import { mulberry32 } from '../../src/engine/deck';
import type { Question } from '../../src/drill/types';

describe('review fix: preflop never asks the big blind with no raise', () => {
  it('3000 seeds never produce position BB with facing none', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const sc = preflopDrill.generate(mulberry32(seed), 1).scenario as { position: string; facing: string };
      expect(sc.position === 'BB' && sc.facing === 'none').toBe(false);
    }
  });
  it('the big blind is still asked when facing a raise, and other positions still get both situations', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 3000; seed++) {
      const sc = preflopDrill.generate(mulberry32(seed), 1).scenario as { position: string; facing: string };
      seen.add(`${sc.position}:${sc.facing}`);
    }
    expect(seen.has('BB:raise')).toBe(true);
    expect(seen.has('BTN:none')).toBe(true);
    expect(seen.has('BTN:raise')).toBe(true);
  });
});

describe('review fix: call/fold uses one-card odds', () => {
  it('nextCardEquity is outs over the unseen cards', () => {
    expect(nextCardEquity(9, 'flop')).toBeCloseTo(9 / 47, 10);
    expect(nextCardEquity(9, 'turn')).toBeCloseTo(9 / 46, 10);
    expect(nextCardEquity(0, 'flop')).toBe(0);
  });
  it('a flop draw facing a pot-sized bet is a fold, not a call', () => {
    const q: Question = {
      type: 'odds', level: 3, key: 'odds:L3:flop', prompt: '', options: [],
      scenario: { variant: 'callfold', prePot: 100, pot: 200, call: 100, outs: 9, street: 'flop' },
    };
    const fold = oddsDrill.grade(q, 'fold');
    const call = oddsDrill.grade(q, 'call');
    expect(fold.correct).toBe(true);
    expect(call.correct).toBe(false);
    expect(call.ev!.chosen).toBeCloseTo((9 / 47) * 200 - (1 - 9 / 47) * 100, 6);
    expect(call.explanation).toMatch(/next card/i);
  });
  it('level 3 prompts say that only the next card is counted', () => {
    for (let seed = 1; seed <= 50; seed++) expect(oddsDrill.generate(mulberry32(seed), 3).prompt).toMatch(/next card/i);
  });
});

describe('review fix: level 2 can be answered with the rule it names', () => {
  it('the rule-of-4/2 estimate is within 5 points of the exact value for every generated question', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const q = oddsDrill.generate(mulberry32(seed), 2);
      const sc = q.scenario as { outs: number; street: 'flop' | 'turn' };
      expect(sc.outs).toBeLessThanOrEqual(12);
      const diff = Math.abs(ruleOfEstimate(sc.outs, sc.street) * 100 - outsEquity(sc.outs, sc.street) * 100);
      expect(diff).toBeLessThanOrEqual(5);
    }
  });
  it('following the rule picks the correct option', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const q = oddsDrill.generate(mulberry32(seed), 2);
      const sc = q.scenario as { outs: number; street: 'flop' | 'turn' };
      const estimate = String(Math.round(ruleOfEstimate(sc.outs, sc.street) * 100));
      const nearest = q.options.reduce((a, b) =>
        Math.abs(Number(b.value) - Number(estimate)) < Math.abs(Number(a.value) - Number(estimate)) ? b : a);
      expect(oddsDrill.grade(q, nearest.value).correct).toBe(true);
    }
  });
});

describe('review fix: push/fold explanation is honest about its shortcuts', () => {
  it('mentions the card-removal simplification', () => {
    const q: Question = {
      type: 'pushfold', level: 1, key: 'pushfold:sb:6-10', prompt: '', options: [],
      scenario: { role: 'sb', stack: 8, hole: [{ rank: 14, suit: 's' }, { rank: 13, suit: 'h' }] },
    };
    expect(pushFoldDrill.grade(q, 'push').explanation).toMatch(/card removal/i);
  });
});
