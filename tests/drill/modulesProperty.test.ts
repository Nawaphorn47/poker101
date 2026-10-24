import { ALL_MODULES } from '../../src/drill/modules';
import { mulberry32 } from '../../src/engine/deck';

describe('every drill module', () => {
  it('lists the registered drill types', () => {
    expect(ALL_MODULES.map((m) => m.id)).toEqual(['odds', 'preflop', 'pushfold', 'madehand', 'outs']);
  });

  for (const module of ALL_MODULES) {
    for (let level = 1; level <= module.levels; level++) {
      it(`${module.id} level ${level}: 300 seeds generate, grade every option, and have a correct answer`, () => {
        for (let seed = 1; seed <= 300; seed++) {
          const q = module.generate(mulberry32(seed), level);
          expect(q.type).toBe(module.id);
          expect(q.level).toBe(level);
          expect(q.key.length).toBeGreaterThan(0);
          expect(q.prompt.length).toBeGreaterThan(0);
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          const grades = q.options.map((o) => module.grade(q, o.value));
          expect(grades.some((g) => g.correct)).toBe(true);
          for (const g of grades) {
            expect(g.explanation.length).toBeGreaterThan(0);
            expect(['exact', 'approximate']).toContain(g.certainty);
            if (g.ev) {
              expect(Number.isFinite(g.ev.chosen)).toBe(true);
              expect(Number.isFinite(g.ev.best)).toBe(true);
            }
          }
        }
      });
    }
  }

  it('same seed gives the same question for every module and level', () => {
    for (const m of ALL_MODULES)
      for (let level = 1; level <= m.levels; level++)
        expect(m.generate(mulberry32(9), level)).toEqual(m.generate(mulberry32(9), level));
  });
});
