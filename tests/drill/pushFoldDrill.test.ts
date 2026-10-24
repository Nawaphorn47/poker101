import { pushFoldDrill } from '../../src/drill/modules/pushFoldDrill';
import { pushFoldRow, PUSHFOLD_STACKS } from '../../src/drill/pushFoldData';
import { ALL_CLASSES, handClass } from '../../src/engine/handClass';
import { parseCard, type Card } from '../../src/engine/cards';
import { mulberry32 } from '../../src/engine/deck';

type Role = 'sb' | 'bb';
const holeFor = (name: string): Card[] => {
  if (name.length === 2) return [parseCard(name[0] + 's'), parseCard(name[1] + 'h')];
  return [parseCard(name[0] + 's'), parseCard(name[1] + (name[2] === 's' ? 's' : 'h'))];
};
const q = (role: Role, stack: number, name: string) => ({
  type: 'pushfold' as const, level: 3, key: 'k', prompt: '', options: [],
  scenario: { role, stack, hole: holeFor(name) },
});
const gen = (level: number, seed: number) => pushFoldDrill.generate(mulberry32(seed), level);

describe('pushFoldDrill grading', () => {
  it('the data-best answer is correct and not borderline', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const question = gen(3, seed);
      const sc = question.scenario as { role: Role; stack: number; hole: Card[] };
      const row = pushFoldRow(sc.stack);
      const cls = handClass(sc.hole);
      const ev = sc.role === 'sb' ? row.evPush[cls] : row.evCall[cls];
      const threshold = sc.role === 'sb' ? -0.5 : -1;
      if (Math.abs(ev - threshold) < 0.002) continue;
      const best = sc.role === 'sb' ? (ev > threshold ? 'push' : 'fold') : ev > threshold ? 'call' : 'fold';
      const g = pushFoldDrill.grade(question, best);
      expect(g.correct).toBe(true);
      expect(g.borderline).toBe(false);
    }
  });
  it('carries ev from the data in bb', () => {
    const row = pushFoldRow(10);
    const g = pushFoldDrill.grade(q('sb', 10, 'AA'), 'push');
    expect(g.ev).toEqual({ chosen: row.evPush['AA'], best: Math.max(row.evPush['AA'], -0.5), unit: 'bb' });
    const f = pushFoldDrill.grade(q('sb', 10, 'AA'), 'fold');
    expect(f.ev!.chosen).toBe(-0.5);
    const bb = pushFoldDrill.grade(q('bb', 10, 'AA'), 'fold');
    expect(bb.ev!.chosen).toBe(-1);
  });
  it('the worse answer within 0.1bb is correct and borderline', () => {
    const row = pushFoldRow(8);
    const near = ALL_CLASSES.map((c) => c.name).find((n) => {
      const d = Math.abs(row.evPush[n] + 0.5);
      return d > 0.003 && d < 0.09;
    });
    expect(near).toBeDefined();
    const best = row.evPush[near!] > -0.5 ? 'push' : 'fold';
    const worse = best === 'push' ? 'fold' : 'push';
    const g = pushFoldDrill.grade(q('sb', 8, near!), worse);
    expect(g.correct).toBe(true);
    expect(g.borderline).toBe(true);
  });
  it('the worse answer further than 0.1bb is incorrect and not borderline', () => {
    const g = pushFoldDrill.grade(q('sb', 10, 'AA'), 'fold');
    expect(g.correct).toBe(false);
    expect(g.borderline).toBe(false);
    const bb = pushFoldDrill.grade(q('bb', 5, 'AA'), 'fold');
    expect(bb.correct).toBe(false);
  });
  it('is exact and the explanation names heads-up and the 0.1bb tolerance', () => {
    const g = pushFoldDrill.grade(q('sb', 10, 'AKo'), 'push');
    expect(g.certainty).toBe('exact');
    expect(g.explanation).toMatch(/heads-up/i);
    expect(g.explanation).toMatch(/0\.1\s?bb/);
  });
  it('never yields NaN at the stack extremes for any class, role or answer', () => {
    for (const stack of [2, 15]) {
      for (const c of ALL_CLASSES) {
        for (const [role, answers] of [['sb', ['push', 'fold']], ['bb', ['call', 'fold']]] as const) {
          for (const a of answers) {
            const g = pushFoldDrill.grade(q(role, stack, c.name), a);
            expect(Number.isFinite(g.ev!.chosen)).toBe(true);
            expect(Number.isFinite(g.ev!.best)).toBe(true);
          }
        }
      }
    }
  });
});

describe('pushFoldDrill generation', () => {
  it('stack is a whole number from 2 to 15 and hole is two distinct cards, at every level', () => {
    for (const level of [1, 2, 3]) {
      for (let seed = 1; seed <= 500; seed++) {
        const sc = gen(level, seed).scenario as { stack: number; hole: Card[] };
        expect(PUSHFOLD_STACKS).toContain(sc.stack);
        expect(sc.hole).toHaveLength(2);
        expect(sc.hole[0].rank + sc.hole[0].suit).not.toBe(sc.hole[1].rank + sc.hole[1].suit);
      }
    }
  });
  it('level 1 asks only the small blind and level 2 only the big blind', () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect((gen(1, seed).scenario as { role: Role }).role).toBe('sb');
      expect((gen(2, seed).scenario as { role: Role }).role).toBe('bb');
    }
  });
  it('level 3 asks both roles', () => {
    const roles = new Set(Array.from({ length: 100 }, (_, i) => (gen(3, i + 1).scenario as { role: Role }).role));
    expect(roles).toEqual(new Set(['sb', 'bb']));
  });
  it('options match the role and the key uses a stack bucket', () => {
    const sb = gen(1, 3);
    expect(sb.options.map((o) => o.value)).toEqual(['push', 'fold']);
    expect(sb.key).toMatch(/^pushfold:sb:(2-5|6-10|11-15)$/);
    const bb = gen(2, 3);
    expect(bb.options.map((o) => o.value)).toEqual(['call', 'fold']);
    expect(bb.key).toMatch(/^pushfold:bb:(2-5|6-10|11-15)$/);
  });
  it('declares type pushfold and three levels', () => {
    expect(pushFoldDrill.id).toBe('pushfold');
    expect(pushFoldDrill.levels).toBe(3);
  });
});
