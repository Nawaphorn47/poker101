import { oddsDrill } from '../../src/drill/modules/oddsDrill';
import { mulberry32 } from '../../src/engine/deck';

describe('odds prompt wording', () => {
  it('says "1 out", never "1 outs", and keeps "outs" for other counts', () => {
    let sawOne = false;
    let sawMany = false;
    for (const level of [2, 3]) {
      for (let seed = 1; seed <= 400; seed++) {
        const q = oddsDrill.generate(mulberry32(seed), level);
        const outs = (q.scenario as { outs: number }).outs;
        expect(q.prompt).not.toMatch(/\b1 outs\b/);
        if (outs === 1) {
          sawOne = true;
          expect(q.prompt).toMatch(/\b1 out\b/);
        } else {
          sawMany = true;
          expect(q.prompt).toMatch(new RegExp(`\\b${outs} outs\\b`));
        }
      }
    }
    expect(sawOne && sawMany).toBe(true);
  });
});
